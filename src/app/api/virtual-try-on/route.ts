import { NextRequest, NextResponse } from 'next/server';
import { virtualTryOn } from '@/ai/flows/virtual-try-on';
import { VirtualTryOnInputSchema } from '@/ai/schemas/virtual-try-on.schema';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  // Note: Client-side authentication is handled by the client
  // The userId should be passed in the request body from the authenticated client

  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] [${requestId}] ${message}`, data || '');
  };
  
  const logError = (message: string, error?: any) => {
    console.error(`[${new Date().toISOString()}] [${requestId}] ${message}`, {
      error: error?.message || error,
      stack: error?.stack,
      code: error?.code,
      name: error?.name,
      ...(error?.response?.data && { responseData: error.response.data })
    });
  };
  
  log('Received request', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });
  
  try {
    // Parse and validate the request body
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
    
    // Get userId from the request body (passed from client-side)
    const userId = body.userId || 'anonymous';
    
    // Log the user ID (masked for security)
    log('Using user ID for image saving', { 
      hasUserId: !!userId && userId !== 'anonymous',
      userIdLength: userId?.length || 0 
    });
    
    // Ensure productId is a string if it exists
    const productId = body.productId ? String(body.productId) : undefined;
    
    // Add userId and productId to input data
    const enrichedInputData = {
      ...inputData,
      userId,
      productId
    };
    
    log('Input validation successful, calling virtualTryOn', { 
      hasUserImage: !!enrichedInputData.userImageUrl,
      hasProductImage: !!enrichedInputData.productImageUrl,
      hasUserDescription: !!enrichedInputData.userDescription,
      hasProductDescription: !!enrichedInputData.productDescription,
      hasUserId: !!enrichedInputData.userId,
      hasProductId: !!enrichedInputData.productId
    });
    
    // Process the virtual try-on
    log('Starting virtual try-on processing');
    const result = await virtualTryOn(enrichedInputData);
    
    log('Virtual try-on completed successfully', {
      hasGeneratedImage: !!result.generatedImageUrl,
      hasMetadata: !!result.metadata,
      processingTime: result.metadata?.processingTime
    });
    
    // Save the generated image to Firebase Storage with metadata
    let storagePath = '';
    let publicUrl = result.generatedImageUrl;
    
    if (result.generatedImageUrl) {
      try {
        const { adminStorage } = await import('@/lib/firebaseAdmin');
        const bucket = adminStorage().bucket();
        
        // Create a unique filename with timestamp and user ID
        const timestamp = Date.now();
        const filename = `virtual_try_on_${timestamp}.jpg`;
        storagePath = `user_uploads/${userId}/virtual_try_on/${filename}`;
        
        // Download the generated image
        const imageResponse = await fetch(result.generatedImageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        // Upload to Firebase Storage with metadata
        const file = bucket.file(storagePath);
        await file.save(Buffer.from(imageBuffer), {
          metadata: {
            contentType: 'image/jpeg',
            metadata: {
              productId: enrichedInputData.productId || '',
              productName: body.productName || '',
              productImage: body.productImageUrl || '',
              userId: userId,
              createdAt: new Date().toISOString(),
              processingTime: result.metadata?.processingTime || 0,
              requestId
            }
          }
        });
        
        // Make the file publicly accessible
        await file.makePublic();
        
        // Get the public URL
        publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        
        log('Saved generated image to storage', {
          storagePath,
          publicUrl,
          size: imageBuffer.byteLength
        });
        
      } catch (storageError) {
        logError('Error saving generated image to storage', storageError);
        // Don't fail the request if storage fails, just log it
      }
    }
    
    // Calculate request duration
    const duration = Date.now() - startTime;
    
    // Return the successful response with the generated image URL and metadata
    return NextResponse.json({
      requestId,
      success: true,
      message: 'Virtual try-on completed successfully',
      generatedImageUrl: publicUrl,
      storagePath: storagePath || null,
      metadata: {
        ...result.metadata,
        storagePath: storagePath || null,
        storageUrl: publicUrl,
        processingTime: duration
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    }, { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Duration': `${duration}ms`
      }
    });
    
    return response;

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
