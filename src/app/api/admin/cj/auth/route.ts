import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getSupplierAccessToken } from '../../../../../lib/supplierAuth'; // Updated import

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

/**
 * GET handler for Supplier authentication (currently CJ)
 * This endpoint returns a valid supplier access token after validating the admin API key
 */
export async function GET(request: NextRequest) {
  // Check admin API key directly in the route handler
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json(
      { success: false, message: 'Invalid or missing Admin API Key.' }, 
      { status: 401 }
    );
  }
  
  try {
    const accessToken = await getSupplierAccessToken(); // Updated function call
    
    return NextResponse.json({
      success: true,
      accessToken,
    });
  } catch (error: any) {
    console.error('[Supplier Auth API] Error:', error); // Updated log prefix
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to authenticate with Supplier API', // Updated message
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
