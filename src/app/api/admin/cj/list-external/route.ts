import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getSupplierAccessToken } from '../../../../../lib/supplierAuth'; // Updated import

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

// CJ Dropshipping API configuration
const CJ_API_BASE_URL_V2 = 'https://developers.cjdropshipping.com/api2.0/v1/product';

// Zod schema for expected query parameters from our admin frontend
const CjListRequestSchema = z.object({
  keyword: z.string().optional(),      // Will be mapped to productNameEn
  categoryId: z.string().optional(),   // CJ's category ID
  page: z.coerce.number().int().min(1).optional().default(1),         // Will be pageNum
  limit: z.coerce.number().int().min(1).max(200).optional().default(20), // Will be pageSize (max 200 for CJ)
  productType: z.string().optional(), // Example: 'NORMAL', 'VIRTUAL_PRODUCT', 'COMBINATION_PRODUCT'
  warehouseCountryCode: z.string().optional(), // Example: 'US', 'CN', 'DE' (will be sent as 'countryCode' to CJ API)
  // Add other potential filters if needed, e.g., minPrice, maxPrice, etc.
});

export async function GET(request: NextRequest) {
  // Check admin API key directly in the route handler
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }
  
  // Get a valid Supplier access token using our authentication flow
  let supplierAccessToken; // Renamed variable
  try {
    supplierAccessToken = await getSupplierAccessToken(); // Updated function call
  } catch (error: any) {
    console.error('[Supplier API List] Failed to get Supplier access token:', error.message); // Updated log
    return NextResponse.json({ error: 'Failed to authenticate with Supplier API. ' + error.message }, { status: 500 }); // Updated message
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const params = Object.fromEntries(searchParams.entries());

    const validationResult = CjListRequestSchema.safeParse(params);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { keyword, categoryId, page, limit, productType, warehouseCountryCode } = validationResult.data;

    // Construct query parameters for CJ API
    // Construct query parameters for CJ API v2.0 product/list
    const cjApiParams = new URLSearchParams({
      pageNum: String(page),
      pageSize: String(limit),
    });

    if (keyword) {
      cjApiParams.append('productNameEn', keyword); // As per new requirement
    }
    if (categoryId) {
      cjApiParams.append('categoryId', categoryId);
    }
    if (productType) {
      cjApiParams.append('productType', productType);
    }
    if (warehouseCountryCode) {
      cjApiParams.append('countryCode', warehouseCountryCode); // Using 'countryCode' as per CJ's likely parameter name for warehouse filtering
    }
    // Add other parameters like minPrice, maxPrice as needed

    const supplierApiUrl = `${CJ_API_BASE_URL_V2}/list?${cjApiParams.toString()}`; // URL is CJ specific
    console.log(`[Supplier API List] Calling Supplier API (CJ): ${supplierApiUrl}`); // Updated log

    const response = await fetch(supplierApiUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': supplierAccessToken, // Header key is CJ specific
        'Content-Type': 'application/json',
      },
    });

    const supplierData = await response.json(); // Renamed variable

    if (!response.ok || supplierData.result !== true || String(supplierData.code) !== "200") {
      console.error(`[Supplier API List] Supplier API (CJ) request failed or returned error. Status: ${response.status}, Code: ${supplierData.code}, Message: ${supplierData.message}`, supplierData); // Updated log
      return NextResponse.json(
        {
          error: `Supplier API (CJ) request failed: ${supplierData.message || response.statusText}`, // Updated message
          details: supplierData
        },
        { status: response.ok ? 422 : response.status }
      );
    }

    // Return the data part of the Supplier (CJ) response
    return NextResponse.json(supplierData.data || {});

  } catch (error: any) {
    console.error('[Supplier API List] Exception while listing products from Supplier (CJ):', error); // Updated log
    return NextResponse.json({ error: 'Failed to list products from Supplier API (CJ).', details: error.message }, { status: 500 }); // Updated message
  }
}
