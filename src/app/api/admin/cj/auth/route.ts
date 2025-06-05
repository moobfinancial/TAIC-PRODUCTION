import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';
import { getCjAccessToken } from '../../../../../lib/cjAuth';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

/**
 * GET handler for CJ authentication
 * This endpoint returns a valid CJ access token after validating the admin API key
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
    const accessToken = await getCjAccessToken();
    
    return NextResponse.json({
      success: true,
      accessToken,
    });
  } catch (error: any) {
    console.error('[CJ Auth API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to authenticate with CJ Dropshipping',
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
