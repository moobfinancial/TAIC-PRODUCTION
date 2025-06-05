import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getCjAccessToken } from '../../../../../lib/cjAuth';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// CJ Dropshipping API configuration
const CJ_API_BASE_URL_V2 = 'https://developers.cjdropshipping.com/api2.0/v1/product';

// Zod schema for input validation
const ImportProductInputSchema = z.object({
  cjProductId: z.string().min(1, "CJ Product ID is required."),
  platform_category_id: z.number().int().positive("Platform category ID must be a positive integer."),
  selling_price: z.number().positive("Selling price must be a positive number."),
  display_name: z.string().optional(),
  display_description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Check admin API key directly in the route handler
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  // Get CJ access token using the auth module
  let cjAccessToken: string;
  try {
    cjAccessToken = await getCjAccessToken();
  } catch (error) {
    console.error('[CJ Import] Failed to get access token:', error);
    return NextResponse.json({ 
      error: 'Failed to authenticate with CJ Dropshipping API.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }

  let client; // For database connection
  let validatedData: z.infer<typeof ImportProductInputSchema> | null = null;
  
  try {
    const body = await request.json();
    const validationResult = ImportProductInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    validatedData = validationResult.data;
    const {
      cjProductId,
      platform_category_id,
      selling_price,
      display_name: inputDisplayName,
      display_description: inputDisplayDescription
    } = validatedData;

    // Step 1: Fetch product details from CJ API (using v2.0 product/query)
    const cjDetailApiUrl = `${CJ_API_BASE_URL_V2}/query?pid=${encodeURIComponent(cjProductId)}`;
    console.log(`[CJ Import] Calling CJ Product Detail API: ${cjDetailApiUrl}`);

    const response = await fetch(cjDetailApiUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': cjAccessToken,
        'Content-Type': 'application/json',
      },
    });

    const cjProductData = await response.json();
    console.log(`[CJ Import] Product detail response:`, {
      status: response.status,
      cjCode: cjProductData?.code,
      cjResult: cjProductData?.result,
      hasData: !!cjProductData?.data,
      dataType: cjProductData?.data ? (Array.isArray(cjProductData.data) ? 'array' : typeof cjProductData.data) : 'none'
    });

    // According to CJ API v2.0 docs, successful response has result: true and code: 200
    if (!response.ok || !cjProductData || cjProductData.result !== true || String(cjProductData.code) !== "200") {
      console.error(`[CJ Import] CJ Product Detail API request failed. Status: ${response.status}, CJ Code: ${cjProductData?.code}, Message: ${cjProductData?.message}`, cjProductData);
      return NextResponse.json(
        {
          error: `CJ API request failed: ${cjProductData?.message || response.statusText || 'Unknown error'}`,
          details: cjProductData || {},
          cjProductId,
        },
        { status: response.status || 500 }
      );
    }

    // Handle different response formats - sometimes data is an object, sometimes an array
    let productData = cjProductData.data;
    if (Array.isArray(productData) && productData.length > 0) {
      productData = productData[0]; // Take first item if array
    } else if (typeof productData !== 'object' || productData === null) {
      console.error('[CJ Import] Invalid product data format:', productData);
      return NextResponse.json(
        {
          error: 'Invalid product data format in CJ API response',
          details: cjProductData,
          cjProductId,
        },
        { status: 422 }
      );
    }

    const cjProduct = productData;
    console.log(`[CJ Import] Processing product:`, {
      pid: cjProduct.pid,
      name: cjProduct.productName || cjProduct.productNameEn,
      price: cjProduct.sellPrice || cjProduct.productPrice
    });

    // If we get here, we have valid product data
    if (!cjProduct.pid || cjProduct.pid !== cjProductId) {
      console.error('[CJ Import] Product ID mismatch:', { requested: cjProductId, received: cjProduct.pid });
      return NextResponse.json(
        { 
          error: 'Product ID in response does not match requested ID',
          requestedId: cjProductId,
          receivedId: cjProduct.pid,
          details: cjProduct
        },
        { status: 422 }
      );
    }

    // Get a client from the pool
    client = await pool.connect();

    try {
      // Begin transaction
      await client.query('BEGIN');

      // Get the maximum existing ID and increment it by 1
      const maxIdResult = await client.query(`
        SELECT COALESCE(MAX(platform_product_id), 0) + 1 as next_id FROM cj_products;
      `);
      const nextId = maxIdResult.rows[0].next_id;

      // Insert into cj_products table with manually generated ID
      const insertProductQuery = `
        INSERT INTO cj_products (
          platform_product_id,
          cj_product_id,
          cj_product_data_json,
          display_name,
          display_description,
          platform_category_id,
          selling_price,
          cj_base_price,
          image_url,
          additional_image_urls_json,
          variants_json,
          is_active,
          cashback_percentage,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.00,
          NOW(), NOW()
        )
        RETURNING platform_product_id, cj_product_id, platform_category_id, selling_price, display_name;`;

      // Prepare product data for insertion
      const productImages = Array.isArray(cjProduct.productImage) 
        ? cjProduct.productImage 
        : cjProduct.productImage ? [cjProduct.productImage] : [];

      const variants = cjProduct.variants || [];

      // Prepare the main product image (use first image if available)
      const mainImage = productImages.length > 0 ? productImages[0] : '';
      
      // Prepare additional images (all except the first one)
      const additionalImages = productImages.length > 1 ? productImages.slice(1) : [];
      
      const insertResult = await client.query(insertProductQuery, [
        // $1: platform_product_id (manually generated)
        nextId,
        // $2: cj_product_id
        cjProduct.pid || cjProductId,
        // $3: cj_product_data_json (store the complete product data)
        cjProduct,
        // $4: display_name
        inputDisplayName || cjProduct.productName || cjProduct.productNameEn || 'Unnamed Product',
        // $5: display_description
        inputDisplayDescription || cjProduct.description || cjProduct.productDesc || '',
        // $6: platform_category_id
        platform_category_id,
        // $7: selling_price
        selling_price,
        // $8: cj_base_price
        parseFloat(cjProduct.originalPrice) || parseFloat(cjProduct.sellPrice) || 0,
        // $9: image_url (main image)
        mainImage,
        // $10: additional_image_urls_json
        additionalImages.length > 0 ? JSON.stringify(additionalImages) : null,
        // $11: variants_json
        variants.length > 0 ? JSON.stringify(variants) : null,
        // $12: is_active (set to true by default when importing)
        true
      ]);

      // Commit the transaction
      await client.query('COMMIT');

      const insertedProduct = insertResult.rows[0];

      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Product imported successfully',
        product: {
          id: insertedProduct.platform_product_id,
          cj_product_id: insertedProduct.cj_product_id,
          platform_category_id: insertedProduct.platform_category_id,
          selling_price: insertedProduct.selling_price,
          display_name: insertedProduct.display_name
        },
        cjProduct: {
          pid: cjProduct.pid,
          sku: cjProduct.productSku || cjProduct.sku,
          name: cjProduct.productName || cjProduct.productNameEn,
          price: cjProduct.sellPrice,
          original_price: cjProduct.originalPrice,
          category_id: cjProduct.categoryId,
          category_name: cjProduct.categoryName,
          images: productImages,
          variants: variants
        }
      }, { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('[CJ Import] Error importing product:', error);
    const cjIdForError = validatedData?.cjProductId || 'unknown';
    const catIdForError = validatedData?.platform_category_id || 'unknown';

    if (error.code === '23505') { // Unique violation for cj_product_id
      return NextResponse.json({ error: 'Product already imported.', details: `CJ Product ID ${cjIdForError} already exists in the database.` }, { status: 409 });
    }
    if (error.code === '23503') { // Foreign key violation (e.g. platform_category_id does not exist)
      return NextResponse.json({ error: 'Invalid platform_category_id.', details: `Category ID ${catIdForError} does not exist.` }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to import product.', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      await client.release();
    }
  }
}
