import { NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebaseAdmin';
import { headers } from 'next/headers';

// Helper to get user ID from headers
function getUserIdFromHeaders(headers: Headers): string | null {
  // In a real implementation, you would validate the session token
  // For now, we'll just get the user ID from the headers
  const userId = headers.get('x-user-id');
  return userId || null;
}

export async function GET(request: Request) {
  try {
    // Get user ID from headers
    const headersList = headers();
    const userId = getUserIdFromHeaders(headersList);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - No user ID provided' },
        { status: 401 }
      );
    }
    const bucket = adminStorage().bucket();
    
    // List all files in the user's virtual try-on directory
    const [files] = await bucket.getFiles({
      prefix: `user_uploads/${userId}/virtual_try_on/`
    });

    // Process each file to get its metadata and public URL
    const images = await Promise.all(
      files.map(async (file) => {
        try {
          // Get file metadata
          const [metadata] = await file.getMetadata();
          
                // For now, we'll use the public URL if the file is public
          // In production, you should use signed URLs or ensure proper access control
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
          
          // Extract product info from metadata
          const productInfo = metadata.metadata?.customMetadata || {};
          
          return {
            url: publicUrl,
            name: file.name.split('/').pop(),
            createdAt: metadata.timeCreated,
            metadata: {
              ...metadata.metadata,
              productInfo: {
                productId: productInfo.productId || 'unknown',
                productName: productInfo.productName || 'Unknown Product',
                productImage: productInfo.productImage || ''
              }
            }
          };
        } catch (error) {
          console.error('Error processing file:', file.name, error);
          return null;
        }
      })
    );

    // Filter out any failed file processing
    const validImages = images.filter(Boolean);

    return NextResponse.json({ 
      success: true,
      images: validImages 
    });
    
  } catch (error) {
    console.error('Error in GET /api/user/images:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
