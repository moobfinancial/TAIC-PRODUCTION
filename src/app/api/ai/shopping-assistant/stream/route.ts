import { NextRequest } from 'next/server';

// This is a proxy route to communicate with the FastAPI backend.
// It's required to avoid CORS issues and to hide the backend URL from the client.
export const dynamic = 'force-dynamic'; // Ensures the route is not cached

const handleStreamRequest = async (query: string | null, userId: string | null) => {
  if (!query) {
    return new Response('Query parameter is missing', { status: 400 });
  }

  // The URL of your FastAPI backend stream endpoint
  const backendUrl = `http://127.0.0.1:8001/api/v1/agent/invoke_agent_for_stream?query=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId || 'default-user')}`;

  try {
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      // @ts-ignore
      duplex: 'half', // Required for streaming in Node.js v18+
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`[API Route] Backend error: ${backendResponse.status} ${backendResponse.statusText}`, errorText);
      return new Response(`Error from backend: ${errorText}`, { status: backendResponse.status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        if (!backendResponse.body) {
          controller.close();
          return;
        }
        const reader = backendResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('[API Route] Error reading from backend stream:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API Route] Error fetching from backend:', error);
    return new Response('Failed to connect to the backend service.', { status: 500 });
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const userId = searchParams.get('userId');
  return handleStreamRequest(query, userId);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId } = body;
    return handleStreamRequest(query, userId);
  } catch (error) {
    console.error('[API Route] Invalid JSON in POST request:', error);
    return new Response('Invalid JSON in request body.', { status: 400 });
  }
}

