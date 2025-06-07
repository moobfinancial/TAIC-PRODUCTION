import { NextResponse } from 'next/server';
import { validateAdminApiKey } from '@/lib/adminAuth';

// Force this route to use Node.js runtime
export const runtime = 'nodejs';

// Don't cache this endpoint
export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
  console.log('[Admin Verify] Request received');
  
  try {
    // Try different possible header names
    const headerNames = ['X-Admin-API-Key', 'x-admin-api-key', 'authorization'];
    let apiKey = null;
    
    // Try each header name
    for (const headerName of headerNames) {
      const value = request.headers.get(headerName);
      if (value) {
        // If using Authorization header, strip 'Bearer ' prefix if present
        apiKey = headerName.toLowerCase() === 'authorization' 
          ? value.replace(/^Bearer\s+/i, '') 
          : value;
        console.log(`[Admin Verify] Found API key in header: ${headerName}`);
        break;
      }
    }
    
    if (!apiKey) {
      console.log('[Admin Verify] No API key provided in any known header');
      console.log('[Admin Verify] Available headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
      return NextResponse.json(
        { success: false, message: 'API key is required' },
        { status: 401 }
      );
    }

    console.log('[Admin Verify] Validating API key...');
    console.log(`[Admin Verify] API Key (first 8 chars): ${apiKey.substring(0, 8)}...`);
    
    try {
      const result = await validateAdminApiKey(apiKey);
      const { valid, username } = result;
      
      if (!valid) {
        console.log('[Admin Verify] Invalid API key');
        return NextResponse.json(
          { success: false, message: 'Invalid API key' },
          { status: 401 }
        );
      }

      console.log(`[Admin Verify] Successfully authenticated as ${username}`);
      return NextResponse.json({ 
        success: true,
        user: { username }
      });
    } catch (dbError) {
      console.error('[Admin Verify] Database error:', dbError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Database error during authentication',
          error: dbError instanceof Error ? dbError.message : String(dbError)
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[Admin Verify] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
