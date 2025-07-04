import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  GenerateProductIdeasInputSchema,
  generateProductIdeas
} from '@/ai/flows/product-idea-generator'; // Import the new implementation

// Define a simple product schema for the API
const ProductSchema = z.object({
  id: z.string().describe('Unique product identifier'),
  name: z.string().describe('Product name'),
  description: z.string().describe('Product description'),
  price: z.number().describe('Product price in USD'),
  image_url: z.string().optional().describe('URL to product image'),
  category: z.string().optional().describe('Product category'),
  rating: z.number().min(0).max(5).optional().describe('Average product rating from 0-5'),
  in_stock: z.boolean().optional().describe('Whether the product is in stock'),
});

// API Route Handler
export async function POST(req: NextRequest) {
  try {
    console.log('[API /ai/product-ideas] Received request');
    
    const body = await req.json();
    console.log('[API /ai/product-ideas] Request body:', JSON.stringify(body, null, 2));
    
    // Parse and validate input
    const input = GenerateProductIdeasInputSchema.parse(body);

    // Use our new implementation
    const result = await generateProductIdeas(input);

    console.log('[API /ai/product-ideas] Generation successful, result:', JSON.stringify(result, null, 2));
    return NextResponse.json(result, { status: 200 });

  } catch (e: any) {
    console.error("[API /ai/product-ideas] Error:", e);
    let errorMessage = 'An unexpected error occurred.';
    let errorDetails;
    if (e instanceof z.ZodError) {
      errorMessage = 'Invalid input.';
      errorDetails = e.errors;
      return NextResponse.json({ message: errorMessage, details: errorDetails }, { status: 400 });
    }
    // Check if it's an error from the flow with a message property
    if (e.message) {
      errorMessage = e.message;
    }
    return NextResponse.json({ message: errorMessage, details: e.stack }, { status: 500 }); // Include stack for debugging
  }
}
