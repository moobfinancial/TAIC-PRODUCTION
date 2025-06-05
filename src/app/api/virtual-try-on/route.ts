import { NextRequest, NextResponse } from 'next/server';
import { virtualTryOn } from '@/ai/flows/virtual-try-on';
import { VirtualTryOnInputSchema, VirtualTryOnOutput } from '@/ai/schemas/virtual-try-on.schema';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  console.log('[api/virtual-try-on] Received request');
  try {
    const body = await request.json();
    console.log('[api/virtual-try-on] Request body:', body);

    // Validate input against the Zod schema
    const validationResult = VirtualTryOnInputSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('[api/virtual-try-on] Invalid input:', validationResult.error.flatten());
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const inputData = validationResult.data;

    // Call the Genkit flow
    console.log('[api/virtual-try-on] Calling virtualTryOnFlow with validated data:', inputData);
    const flowOutput: VirtualTryOnOutput = await virtualTryOn(inputData);
    console.log('[api/virtual-try-on] Received output from flow:', flowOutput);

    // Return the flow's output
    return NextResponse.json(flowOutput, { status: 200 });

  } catch (error: any) {
    console.error('[api/virtual-try-on] Error processing request:', error);
    // Check if the error is a ZodError for more specific client messages if needed
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid request payload structure.', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
