import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getSupplierAccessToken } from '../../../../../lib/supplierAuth'; // Updated import
import { translateText } from '../../../../../lib/translationUtils';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// CJ Dropshipping API configuration (This URL is specific to CJ, so constant name can remain)
const CJ_API_BASE_URL_V2 = 'https://developers.cjdropshipping.com/api2.0/v1/product';

// Zod schema for input validation
const ImportProductInputSchema = z.object({
  cjProductId: z.string().min(1, "Supplier Product ID is required."), // Updated description
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

  // Get Supplier access token using the auth module
  let supplierAccessToken: string; // Renamed variable
  try {
    supplierAccessToken = await getSupplierAccessToken(); // Updated function call
  } catch (error) {
    console.error('[Supplier Import] Failed to get access token:', error); // Updated log
    return NextResponse.json({ 
      error: 'Failed to authenticate with Supplier API.', // Updated message
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

    // Step 1: Fetch product details from Supplier API (CJ)
    const detailApiUrl = `${CJ_API_BASE_URL_V2}/query?pid=${encodeURIComponent(cjProductId)}`; // URL remains CJ specific
    console.log(`[Supplier Import] Calling Supplier Product Detail API (CJ): ${detailApiUrl}`);

    const response = await fetch(detailApiUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': supplierAccessToken, // Header key is CJ specific
        'Content-Type': 'application/json',
      },
    });

    const supplierProductData = await response.json(); // Renamed variable
    console.log(`[Supplier Import] Product detail response:`, { // Updated log
      status: response.status,
      code: supplierProductData?.code,
      result: supplierProductData?.result,
      hasData: !!supplierProductData?.data,
      dataType: supplierProductData?.data ? (Array.isArray(supplierProductData.data) ? 'array' : typeof supplierProductData.data) : 'none'
    });

    if (!response.ok || !supplierProductData || supplierProductData.result !== true || String(supplierProductData.code) !== "200") {
      console.error(`[Supplier Import] Supplier Product Detail API (CJ) request failed. Status: ${response.status}, Code: ${supplierProductData?.code}, Message: ${supplierProductData?.message}`, supplierProductData); // Updated log
      return NextResponse.json(
        {
          error: `Supplier API (CJ) request failed: ${supplierProductData?.message || response.statusText || 'Unknown error'}`, // Updated message
          details: supplierProductData || {},
          cjProductId, // Keep cjProductId for error context as it's the input ID
        },
        { status: response.status || 500 }
      );
    }

    let productData = supplierProductData.data;
    if (Array.isArray(productData) && productData.length > 0) {
      productData = productData[0];
    } else if (typeof productData !== 'object' || productData === null) {
      console.error('[Supplier Import] Invalid product data format:', productData); // Updated log
      return NextResponse.json(
        {
          error: 'Invalid product data format in Supplier API (CJ) response', // Updated message
          details: supplierProductData,
          cjProductId,
        },
        { status: 422 }
      );
    }

    const supplierProduct = productData; // Renamed variable
    console.log(`[Supplier Import] Processing product:`, { // Updated log
      pid: supplierProduct.pid,
      name: supplierProduct.productName || supplierProduct.productNameEn,
      price: supplierProduct.sellPrice || supplierProduct.productPrice
    });

    if (!supplierProduct.pid || supplierProduct.pid !== cjProductId) {
      console.error('[Supplier Import] Product ID mismatch:', { requested: cjProductId, received: supplierProduct.pid }); // Updated log
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

      // Insert into cj_products table - let PostgreSQL handle the platform_product_id auto-increment
      const insertProductQuery = `
        INSERT INTO cj_products (
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
          approval_status, 
          cashback_percentage,
          original_name,
          original_description,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, 
          $13, 
          $14, 
          $15, 
          $16, 
          NOW(), NOW()
        )
        RETURNING platform_product_id, cj_product_id, platform_category_id, selling_price, display_name, is_active, approval_status;`;

      // Prepare product data for insertion
      const cjApiImageSource = cjProduct.productImageSet?.productImage || cjProduct.productImage;
      let imageUrl = DEFAULT_IMAGE_URL;
      if (Array.isArray(cjApiImageSource) && cjApiImageSource.length > 0) {
        imageUrl = cjApiImageSource[0];
      } else if (typeof cjApiImageSource === 'string' && cjApiImageSource.trim() !== '') {
        imageUrl = cjApiImageSource;
      }
      // If still DEFAULT_IMAGE_URL, it means no valid image was found or provided.

      const variants = cjProduct.variants || [];

      // Prepare the main product image (use first image if available)
      const mainImage = imageUrl;

      // Prepare additional images (all except the first one)
      const additionalImages = productImages.length > 1 ? productImages.slice(1) : [];
      
      // Determine product name and description, prioritizing English versions if available
      const originalName = cjProduct.productName || 'Unnamed Product';
      const originalDescription = cjProduct.productDescription || '';
      
      // Translate product name and description if they appear to be in Chinese
      // We'll use a simple heuristic: if the text contains Chinese characters, translate it
      const needsTranslation = (text: string) => /[\u4E00-\u9FFF]/.test(text);
      
      let displayName = inputDisplayName || cjProduct.productNameEn || originalName;
      let displayDescription = inputDisplayDescription || cjProduct.productDescriptionEn || originalDescription;
      
      try {
        // Translate name if needed and not already provided as input
        if (!inputDisplayName && needsTranslation(displayName)) {
          const translatedName = await translateText(displayName, 'en');
          displayName = translatedName || displayName;
          console.log(`[Supplier Import] Translated product name from '${displayName}' to '${translatedName}'`); // Updated log
        }
        
        // Translate description if needed and not already provided as input
        if (!inputDisplayDescription && needsTranslation(displayDescription)) {
          const translatedDescription = await translateText(displayDescription, 'en');
          displayDescription = translatedDescription || displayDescription;
          console.log(`[Supplier Import] Translated product description`); // Updated log
        }
      } catch (translationError) {
        console.error('[Supplier Import] Translation error:', translationError); // Updated log
        // Continue with original text if translation fails
      }
      
      const queryParams = [
        // $1: cj_product_id
        cjProduct.pid || cjProductId,
        // $2: cj_product_data_json (store the complete product data)
        cjProduct,
        // $4: display_name
        displayName, // This has translation logic applied
        // $5: display_description
        displayDescription, // This has translation logic applied
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
        // $12: is_active - set to false by default
        false,
        // $13: approval_status - set to 'pending' by default
        'pending',
        // $14: cashback_percentage
        0.00,
        // $15: original_name
        originalName,
        // $16: original_description
        originalDescription
      ];
      console.log('[CJ Import] Executing insert with params:', JSON.stringify(queryParams, null, 2));
      const insertResult = await client.query(insertProductQuery, queryParams);

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
        supplierProductDetails: { // Renamed for clarity
          pid: supplierProduct.pid,
          sku: supplierProduct.productSku || supplierProduct.sku,
          name: supplierProduct.productName || supplierProduct.productNameEn,
          price: supplierProduct.sellPrice,
          original_price: supplierProduct.originalPrice,
          category_id: supplierProduct.categoryId,
          category_name: supplierProduct.categoryName,
          images: productImages,
          variants: variants
        }
      }, { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('[Supplier Import] Error importing product:', error); // Updated log
    const cjIdForError = validatedData?.cjProductId || 'unknown'; // Keep cjIdForError as it's input context
    const catIdForError = validatedData?.platform_category_id || 'unknown';

    if (error.code === '23505') {
      return NextResponse.json({ error: 'Product already imported.', details: `Supplier Product ID ${cjIdForError} already exists.` }, { status: 409 });
    }
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Invalid platform_category_id.', details: `Category ID ${catIdForError} does not exist.` }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to import product.', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      await client.release();
    }
  }
}
