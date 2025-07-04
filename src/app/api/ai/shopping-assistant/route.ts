// src/app/api/ai/shopping-assistant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getProductRecommendations } from '@/ai/flows/shopping-assistant-new';
import { GetProductRecommendationsInputSchema } from '@/ai/schemas/shopping-assistant-schemas-new';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate the input using our schema
    const parseResult = GetProductRecommendationsInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }
    
    // Process the request using our new non-Genkit implementation
    const result = await getProductRecommendations(parseResult.data);
    
    // Return the result
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('[/api/ai/shopping-assistant] Error processing request:', error);
    
    return NextResponse.json(
      {
        responseType: 'error',
        responseText: 'An unexpected error occurred while processing your request. Please try again later.',
        products: [],
      },
      { status: 500 }
    );
  }
}
