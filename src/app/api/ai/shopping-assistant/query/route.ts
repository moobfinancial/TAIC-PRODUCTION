import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth'; // Assuming verifyAuth is now in this path
import type { ChatMessage } from '@/lib/types'; // Use 'type' import for interfaces

interface FrontendRequestBody {
  query: string;
  conversation_history?: ChatMessage[];
}

// This interface matches ShoppingAssistantRequestSchema in FastAPI
interface FastApiRequestBody {
  query: string;
  user_id: string; // FastAPI service expects user_id as string
  conversation_history?: ChatMessage[];
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.valid || !authResult.userId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  // Ensure userId is string for FastAPI payload
  const authenticatedUserId = String(authResult.userId);

  let frontendRequestBody: FrontendRequestBody;
  try {
    frontendRequestBody = await request.json();
  } catch (e) {
    console.error("Error parsing request JSON:", e);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { query, conversation_history } = frontendRequestBody;

  if (!query || typeof query !== 'string' || query.trim() === "") {
    return NextResponse.json({ error: 'Query is required and must be a non-empty string' }, { status: 400 });
  }
  if (conversation_history && !Array.isArray(conversation_history)) {
    return NextResponse.json({ error: 'conversation_history must be an array if provided' }, { status: 400 });
  }


  const fastApiPayload: FastApiRequestBody = {
    query: query,
    user_id: authenticatedUserId, // Pass authenticated user ID
    conversation_history: conversation_history || [], // Default to empty array if undefined
  };

  const aiServiceBaseUrl = process.env.AI_SERVICE_BASE_URL;
  if (!aiServiceBaseUrl) {
    console.error('CRITICAL: AI_SERVICE_BASE_URL environment variable is not configured in Next.js.');
    return NextResponse.json({ error: 'AI service endpoint is not configured on the server.' }, { status: 500 });
  }

  const fastApiUrl = `${aiServiceBaseUrl}/api/v1/shopping_assistant/query`;

  try {
    console.log(`Proxying request to FastAPI: ${fastApiUrl} for user ${authenticatedUserId}`);
    const fastApiResponse = await fetch(fastApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Potentially add an API key/secret for server-to-server auth with FastAPI if needed in future
        // 'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY
      },
      body: JSON.stringify(fastApiPayload),
      // Consider adding a timeout for this server-to-server request
      // signal: AbortSignal.timeout(15000) // e.g., 15 seconds, requires Node 16+
    });

    const responseBody = await fastApiResponse.json();

    return NextResponse.json(responseBody, { status: fastApiResponse.status });

  } catch (error: any) {
    console.error(`Error calling FastAPI AI service at ${fastApiUrl} for user ${authenticatedUserId}:`, error);

    // Handle network errors (e.g., FastAPI service is down)
    // Specific error codes depend on the environment (Node fetch vs browser fetch polyfill)
    if (error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
        const errorCode = (error.cause as {code: string}).code;
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
            return NextResponse.json({ error: 'AI service is currently unavailable. Please try again later.' }, { status: 503 });
        }
    }
    // Handle cases where fastApiResponse.json() might fail if FastAPI returns non-JSON (e.g., HTML error page)
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
         return NextResponse.json({ error: 'Received an invalid (non-JSON) response from the AI service.' }, { status: 502 });
    }
    // Generic error for other fetch-related issues or unexpected errors
    return NextResponse.json({ error: 'Failed to communicate with AI service.', details: error.message || 'Unknown error' }, { status: 502 });
  }
}
