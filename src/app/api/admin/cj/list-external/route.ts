import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getCjAccessToken } from '../../../../../lib/cjAuth';

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
  
  // Get a valid CJ access token using our authentication flow
  let cjAccessToken;
  try {
    cjAccessToken = await getCjAccessToken();
  } catch (error: any) {
    console.error('[CJ API List] Failed to get CJ access token:', error.message);
    return NextResponse.json({ error: 'Failed to authenticate with CJ Dropshipping. ' + error.message }, { status: 500 });
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

    const cjApiUrl = `${CJ_API_BASE_URL_V2}/list?${cjApiParams.toString()}`;
    console.log(`[CJ API List] Calling CJ API: ${cjApiUrl}`);

    const response = await fetch(cjApiUrl, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': cjAccessToken,
        'Content-Type': 'application/json', // Usually good to have, though GET might not strictly need it
      },
    });

    const cjData = await response.json();

    // According to CJ API v2.0 docs, successful response has result: true and code: 200
    if (!response.ok || cjData.result !== true || String(cjData.code) !== "200") {
      console.error(`[CJ API List] CJ API request failed or returned error. Status: ${response.status}, CJ Code: ${cjData.code}, Message: ${cjData.message}`, cjData);
      return NextResponse.json(
        {
          error: `CJ API request failed: ${cjData.message || response.statusText}`,
          details: cjData
        },
        { status: response.ok ? 422 : response.status } // Use 422 if CJ reports error, else original status
      );
    }

    // Return the data part of the CJ response (usually cjData.data which contains list, total, etc.)
    return NextResponse.json(cjData.data || {}); // Default to empty object if data is missing

  } catch (error: any) {
    console.error('[CJ API List] Exception while listing products from CJ:', error);
    return NextResponse.json({ error: 'Failed to list products from CJ Dropshipping.', details: error.message }, { status: 500 });
  }
}
