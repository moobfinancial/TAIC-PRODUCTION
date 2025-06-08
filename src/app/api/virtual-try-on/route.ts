import { NextRequest, NextResponse } from 'next/server';
import { virtualTryOn } from '@/ai/flows/virtual-try-on';
import { VirtualTryOnInputSchema } from '@/ai/schemas/virtual-try-on.schema';
import { z } from 'zod';
import jwt from 'jsonwebtoken'; // For JWT verification
import { Pool } from 'pg'; // For database interaction

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-jwt-secret';

interface UserPayload {
  userId: number;
}

// JWT Verification Helper
async function verifyAuth(request: NextRequest): Promise<{ valid: boolean; userId?: number; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed' };
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return { valid: false, error: 'Token missing from Authorization header' };
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    if (!decoded.userId) {
        return { valid: false, error: 'Invalid token payload (missing userId)' };
    }
    return { valid: true, userId: decoded.userId };
  } catch (error: any) {
    console.error('JWT verification error in virtual-try-on:', error.name, error.message);
    return { valid: false, error: `Token verification failed: ${error.message}` };
  }
}


export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] [VTO:${requestId}] ${message}`, data || '');
  };
  
  const logError = (message: string, error?: any) => {
    console.error(`[${new Date().toISOString()}] [VTO:${requestId}] ${message}`, {
      error: error?.message || error,
      stack: error?.stack,
      code: error?.code,
      name: error?.name,
      ...(error?.response?.data && { responseData: error.response.data })
    });
  };
  
  log('Received request');

  // Authenticate user
  const auth = await verifyAuth(request);
  if (!auth.valid || !auth.userId) {
    logError('Authentication failed', { reason: auth.error });
    return NextResponse.json({ error: 'Unauthorized', details: auth.error }, { status: 401 });
  }
  const authenticatedUserId = auth.userId;
  log('User authenticated', { userId: authenticatedUserId });
  
  try {
    let body;
    try {
      body = await request.json();
      log('Request body parsed successfully', {
        ...body,
        userImageUrl: body.userImageUrl ? `${body.userImageUrl.substring(0, 50)}...` : 'missing',
        productImageUrl: body.productImageUrl ? `${body.productImageUrl.substring(0, 50)}...` : 'missing',
        bodyKeys: Object.keys(body)
      });
    } catch (parseError) {
      console.error('[api/virtual-try-on] Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' }, 
        { status: 400 }
      );
    }

    // Validate input against the Zod schema
    log('Validating input against schema');
    const validationResult = VirtualTryOnInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten();
      logError('Invalid input', { errors: errorDetails });
      
      return NextResponse.json({
        requestId,
        error: 'Invalid input',
        message: 'The request data is invalid',
        details: errorDetails,
        timestamp: new Date().toISOString()
      }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const inputData = validationResult.data;
    
    // userId is now from JWT (authenticatedUserId), not from body.
    // productId is still from body if provided by client.
    const productId = body.productId ? String(body.productId) : undefined;
    
    const enrichedInputData = {
      ...inputData,
      // userId: authenticatedUserId, // Pass authenticated userId to VTO flow if it needs it
      // productId: productId // Pass productId if VTO flow needs it
    };
    
    log('Input validation successful, calling virtualTryOn', { 
      hasUserImage: !!enrichedInputData.userImageUrl,
      hasProductImage: !!enrichedInputData.productImageUrl,
      hasUserDescription: !!enrichedInputData.userDescription,
      hasProductDescription: !!enrichedInputData.productDescription,
    });

    const result = await virtualTryOn(enrichedInputData); // Call VTO flow
    
    log('Virtual try-on AI flow completed', { hasGeneratedImage: !!result.generatedImageUrl });
    
    let storagePath = '';
    let publicUrl = result.generatedImageUrl; // Use AI-generated URL if GCS save fails
    let galleryImageId: number | null = null;

    if (result.generatedImageUrl) {
      try {
        const { adminStorage } = await import('@/lib/firebaseAdmin');
        const bucket = adminStorage().bucket();
        const timestamp = Date.now();
        const filename = `vto_result_${authenticatedUserId}_${timestamp}.jpg`;
        // Use authenticatedUserId for storage path
        storagePath = `user_uploads/${authenticatedUserId}/virtual_try_on_results/${filename}`;
        
        const imageResponse = await fetch(result.generatedImageUrl);
        if (!imageResponse.ok) throw new Error(`Failed to fetch generated image from AI: ${imageResponse.statusText}`);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        const file = bucket.file(storagePath);
        await file.save(Buffer.from(imageBuffer), {
          metadata: {
            contentType: 'image/jpeg', // Assuming JPEG, adjust if AI returns different
            metadata: { // Custom metadata for GCS object
              vtoUserId: String(authenticatedUserId),
              vtoProductId: productId || 'N/A',
              vtoProductName: body.productName || 'N/A',
              vtoRequestId: requestId,
              vtoCreatedAt: new Date().toISOString(),
            }
          }
        });
        await file.makePublic();
        publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        log('Saved generated image to GCS', { storagePath, publicUrl });

        // Save to user_gallery_images table
        let dbClient;
        try {
          dbClient = await pool.connect();
          const vtoDescription = `Virtual Try-On: ${body.productName || 'Product'}${productId ? ` (ID: ${productId})` : ''}`;
          const galleryInsertRes = await dbClient.query(
            `INSERT INTO user_gallery_images (user_id, image_url, image_type, description)
             VALUES ($1, $2, 'vto_result', $3) RETURNING id;`,
            [authenticatedUserId, publicUrl, vtoDescription]
          );
          if (galleryInsertRes.rows.length > 0) {
            galleryImageId = galleryInsertRes.rows[0].id;
            log('Saved VTO image metadata to user_gallery_images', { galleryImageId });
          }
        } catch (dbError: any) {
          logError('Failed to save VTO image metadata to DB', dbError);
          // Do not fail the entire request if DB save fails, GCS part was successful.
        } finally {
          if (dbClient) dbClient.release();
        }

      } catch (storageOrFetchError) {
        logError('Error saving generated image to GCS or fetching from AI URL', storageOrFetchError);
        // If storage fails, publicUrl remains the original AI-generated URL (if any)
        // This is a fallback; ideally, we'd handle this more gracefully.
      }
    }
    
    const duration = Date.now() - startTime;
    log('Request processing finished', { durationMs: duration });
    
    return NextResponse.json({
      requestId,
      success: true,
      message: 'Virtual try-on completed successfully.',
      generatedImageUrl: publicUrl, // This will be GCS URL if save succeeded, else original AI URL
      galleryImageId: galleryImageId, // ID from user_gallery_images table
      storagePath: storagePath || null, // GCS path if save succeeded
      metadata: { ...result.metadata, processingTime: duration, storagePath, galleryImageId },
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log the error with request context
    logError('Error processing request', {
      error,
      duration: `${duration}ms`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // Prepare error response
    let status = 500;
    let errorData: any = {
      requestId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request.'
    };
    
    // Handle specific error types
    if (error instanceof z.ZodError) {
      status = 400;
      errorData = {
        ...errorData,
        error: 'Validation Error',
        message: 'The request data is invalid',
        details: error.flatten()
      };
    } else if (error.name === 'TypeError') {
      errorData.message = 'A type error occurred while processing the request';
    } else if (error.code === 'ENOTFOUND') {
      status = 503;
      errorData.error = 'Service Unavailable';
      errorData.message = 'Could not connect to the required service';
    } else if (error.response?.status) {
      status = error.response.status;
      errorData.error = error.response.statusText || 'API Error';
      errorData.message = error.message || 'Error from external service';
    }
    
    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorData.stack = error.stack;
    }
    
    return NextResponse.json(errorData, {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Error-Type': error.name || 'UnknownError'
      }
    });
  }
}
