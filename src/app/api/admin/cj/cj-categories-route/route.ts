import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getCjAccessToken } from '../../../../../lib/cjAuth';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

const CJ_CATEGORY_API_URL = 'https://developers.cjdropshipping.com/api2.0/v1/product/getCategory';

export async function GET(request: NextRequest) {
  // Validate admin API key
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }
  
  // Get a valid CJ access token
  let cjAccessToken;
  try {
    cjAccessToken = await getCjAccessToken();
  } catch (error: any) {
    console.error('[CJ Category API] Failed to get CJ access token:', error.message);
    return NextResponse.json({ error: 'Failed to authenticate with CJ Dropshipping. ' + error.message }, { status: 500 });
  }

  try {
    console.log(`[CJ Category API] Calling CJ Category API: ${CJ_CATEGORY_API_URL}`);

    const response = await fetch(CJ_CATEGORY_API_URL, {
      method: 'GET',
      headers: {
        'CJ-Access-Token': cjAccessToken,
        'Content-Type': 'application/json',
      },
    });

    const cjData = await response.json();

    if (!response.ok || cjData.result !== true || String(cjData.code) !== "200") {
      console.error(`[CJ Category API] CJ API request failed or returned error. Status: ${response.status}, CJ Code: ${cjData.code}, Message: ${cjData.message}`, cjData);
      return NextResponse.json(
        {
          error: `CJ API request failed: ${cjData.message || response.statusText}`,
          details: cjData
        },
        { status: response.ok ? 422 : response.status } 
      );
    }

    // Return the data part of the CJ response, which contains the categories
    return NextResponse.json(cjData.data || []); // Default to empty array if data is missing

  } catch (error: any) {
    console.error('[CJ Category API] Exception while fetching categories from CJ:', error);
    return NextResponse.json({ error: 'Failed to fetch categories from CJ Dropshipping.', details: error.message }, { status: 500 });
  }
}