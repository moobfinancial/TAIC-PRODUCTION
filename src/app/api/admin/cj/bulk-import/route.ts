import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getSupplierAccessToken } from '../../../../../lib/supplierAuth'; // Updated import
import { translateText } from '../../../../../lib/translationUtils'; // Assuming this utility exists

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const CJ_API_BASE_URL_V2 = 'https://developers.cjdropshipping.com/api2.0/v1/product';

const BulkImportInputSchema = z.object({
  cjProductIds: z.array(z.string().min(1)).min(1, "At least one CJ Product ID is required."),
  platformCategoryId: z.number().int().positive("Platform category ID must be a positive integer."),
  pricingMarkupPercentage: z.number().min(0, "Pricing markup percentage cannot be negative."),
});

interface ErrorDetail {
  cjProductId: string;
  error: string;
  details?: any;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  let supplierAccessToken: string; // Renamed variable
  try {
    supplierAccessToken = await getSupplierAccessToken(); // Updated function call
  } catch (error) {
    console.error('[Supplier Bulk Import] Failed to get access token:', error); // Updated log
    return NextResponse.json({ error: 'Failed to authenticate with Supplier API.', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); // Updated message
  }

  const results = {
    successfullyImported: 0,
    failedImports: 0,
    errors: [] as ErrorDetail[],
    alreadyExists: 0,
  };

  let validatedData: z.infer<typeof BulkImportInputSchema>;
  try {
    const body = await request.json();
    const validationResult = BulkImportInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    validatedData = validationResult.data;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { cjProductIds, platformCategoryId, pricingMarkupPercentage } = validatedData;

  for (const cjProductId of cjProductIds) {
    let client;
    try {
      // Check if product already exists (optional, but good practice)
      client = await pool.connect();
      const checkExist = await client.query('SELECT 1 FROM cj_products WHERE cj_product_id = $1', [cjProductId]);
      if (checkExist.rowCount > 0) {
        results.alreadyExists++;
        results.errors.push({ cjProductId, error: 'Product already imported.' });
        client.release(); // Release before continuing loop
        continue;
      }
      // Release client before potentially long API call if not using it immediately
      client.release();
      client = undefined;


      // Fetch product details from Supplier API (CJ)
      const detailApiUrl = `${CJ_API_BASE_URL_V2}/query?pid=${encodeURIComponent(cjProductId)}`; // URL is CJ specific
      const response = await fetch(detailApiUrl, {
        method: 'GET',
        headers: { 'CJ-Access-Token': supplierAccessToken, 'Content-Type': 'application/json' }, // Header key is CJ specific
      });
      const supplierProductData = await response.json(); // Renamed variable

      if (!response.ok || !supplierProductData || supplierProductData.result !== true || String(supplierProductData.code) !== "200") {
        throw new Error(`Supplier API (CJ) request failed for ${cjProductId}: ${supplierProductData?.message || response.statusText || 'Unknown error'}`); // Updated message
      }

      let productData = supplierProductData.data;
      if (Array.isArray(productData) && productData.length > 0) productData = productData[0];
      else if (typeof productData !== 'object' || productData === null) {
        throw new Error(`Invalid product data format from Supplier API (CJ) for ${cjProductId}`); // Updated message
      }
      const supplierProduct = productData; // Renamed variable

      if (supplierProduct.pid !== cjProductId) {
         throw new Error(`Product ID mismatch for ${cjProductId}. Received from Supplier API (CJ): ${supplierProduct.pid}`); // Updated message
      }

      client = await pool.connect(); // Reconnect for this product's transaction
      await client.query('BEGIN');

      const maxIdResult = await client.query(`SELECT COALESCE(MAX(platform_product_id), 0) + 1 as next_id FROM cj_products;`);
      const nextId = maxIdResult.rows[0].next_id;

      const originalPrice = parseFloat(cjProduct.originalPrice) || parseFloat(cjProduct.sellPrice) || 0;
      const sellingPrice = originalPrice * (1 + pricingMarkupPercentage / 100.0);

      const originalName = cjProduct.productName || 'Unnamed Product';
      const originalDescription = cjProduct.productDescription || '';

      let displayName = cjProduct.productNameEn || originalName;
      let displayDescription = cjProduct.productDescriptionEn || originalDescription;

      const needsTranslation = (text: string) => /[\u4E00-\u9FFF]/.test(text);
      if (needsTranslation(displayName)) {
        displayName = (await translateText(displayName, 'en')) || displayName;
      }
      if (needsTranslation(displayDescription)) {
        displayDescription = (await translateText(displayDescription, 'en')) || displayDescription;
      }

      const productImages = Array.isArray(cjProduct.productImage) ? cjProduct.productImage : (cjProduct.productImage ? [cjProduct.productImage] : []);
      const mainImage = productImages.length > 0 ? productImages[0] : '';
      const additionalImages = productImages.length > 1 ? productImages.slice(1) : [];
      const variants = cjProduct.variants || [];

      const insertQuery = `
        INSERT INTO cj_products (
          platform_product_id, cj_product_id, cj_product_data_json, display_name, display_description,
          platform_category_id, selling_price, cj_base_price, image_url, additional_image_urls_json,
          variants_json, is_active, approval_status, cashback_percentage, original_name, original_description,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, 'pending', 0.00, $12, $13, NOW(), NOW()
        );`;

      await client.query(insertQuery, [
        nextId, cjProduct.pid, cjProduct, displayName, displayDescription,
        platformCategoryId, sellingPrice, originalPrice, mainImage,
        additionalImages.length > 0 ? JSON.stringify(additionalImages) : null,
        variants.length > 0 ? JSON.stringify(variants) : null,
        originalName, originalDescription
      ]);

      await client.query('COMMIT');
      results.successfullyImported++;

    } catch (error: any) {
      if (client) await client.query('ROLLBACK').catch(rbError => console.error('Rollback error:', rbError));
      results.failedImports++;
      results.errors.push({ cjProductId, error: error.message, details: error.response?.data || error.stack });
      console.error(`[Supplier Bulk Import] Failed to import ${cjProductId}:`, error.message); // Updated log
    } finally {
      if (client) client.release();
    }
  }

  return NextResponse.json(results, { status: results.failedImports > 0 && results.successfullyImported === 0 ? 500 : 200 });
}
