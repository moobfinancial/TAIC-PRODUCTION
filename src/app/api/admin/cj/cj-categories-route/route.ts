import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { fetchAndTransformCjCategories } from '../../../../../lib/cjUtils'; // Import the new helper

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Validate admin API key
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }
  
  try {
    console.log(`[Supplier Category API] Fetching and transforming categories via cjUtils helper.`);
    const categories = await fetchAndTransformCjCategories();
    // The helper now returns the transformed structure directly
    return NextResponse.json(categories);

  } catch (error: any) {
    console.error('[Supplier Category API] Exception from fetchAndTransformCjCategories:', error);
    return NextResponse.json({ error: 'Failed to fetch and transform categories from Supplier API.', details: error.message }, { status: 500 });
  }
}