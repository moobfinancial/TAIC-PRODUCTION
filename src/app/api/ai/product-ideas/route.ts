import { NextRequest, NextResponse } from 'next/server';
import { z, genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

// Local Genkit Initialization
const localAI = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GOOGLE_API_KEY }),
  ],
  model: 'gemini-2.0-flash',
});

import {
  GenerateProductIdeasInputSchema,
  GenerateProductIdeasOutputSchema,
  // GenerateProductIdeasInput, // Type is inferred by schema
  constructPromptParts,
  processLlmResponse
} from '@/ai/flows/product-idea-generator'; // Import centralized logic and schemas
// ProductAISchema is now defined in product-idea-generator.ts and used by GenerateProductIdeasOutputSchema

// Tool Definition remains here as it's tied to localAI and API calls
const ProductAISchemaForTool = z.object({ // Renamed to avoid conflict if imported, though ProductAISchema is now canonical in flow file
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  image_url: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  data_ai_hint: z.string().nullable().optional(),
  source: z.enum(['MANUAL', 'CJ']).optional(),
});

const getProductCatalogTool = localAI.defineTool(
  {
    name: 'getProductCatalog',
    description: 'Searches the product catalog for items matching a query and/or category. Use this to find existing products relevant to the user\'s idea or request.',
    inputSchema: z.object({
      searchQuery: z.string().optional().describe('Keywords to search for in product names, descriptions, or categories.'),
      platform_category_id: z.number().int().positive().optional().describe('The specific platform category ID to filter by. Obtain this from product data if seen before, or infer if highly confident.'), // This matches the /api/products endpoint
      limit: z.number().int().min(1).max(10).optional().default(5).describe('Maximum number of products to return.'),
    }),
    outputSchema: z.object({
      products: z.array(ProductAISchemaForTool).describe('An array of products found, or an empty array if none match.'), // Use renamed schema here
      error: z.string().optional().describe('An error message if the API call failed.')
    }),
  },
  async (input) => {
    const { searchQuery, platform_category_id, limit } = input;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Use the app's own URL, ensure NEXT_PUBLIC_APP_URL is set
    const apiUrl = new URL('/api/products', baseUrl);

    if (searchQuery) apiUrl.searchParams.append('searchQuery', searchQuery);
    if (platform_category_id) apiUrl.searchParams.append('platform_category_id', String(platform_category_id));
    if (limit) apiUrl.searchParams.append('limit', String(limit));
    apiUrl.searchParams.append('offset', '0');

    console.log('[API Route - getProductCatalogTool] Calling API:', apiUrl.toString());
    try {
      const response = await fetch(apiUrl.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API Route - getProductCatalogTool] API Error:', response.status, errorText);
        return { products: [], error: `API request failed with status ${response.status}: ${errorText}` };
      }
      const result = await response.json();
      // The /api/products endpoint returns { data: Product[] }, so result.data is correct.
      const validatedProducts = z.array(ProductAISchemaForTool).safeParse(result.data); // Use renamed schema here
      if (validatedProducts.success) {
        console.log('[API Route - getProductCatalogTool] Products found:', validatedProducts.data.length);
        return { products: validatedProducts.data };
      } else {
        console.error('[API Route - getProductCatalogTool] API response validation error:', validatedProducts.error.flatten());
        return { products: [], error: `API response validation failed: ${validatedProducts.error.message}` };
      }
    } catch (error: any) {
      console.error('[API Route - getProductCatalogTool] Fetch error:', error);
      return { products: [], error: `Failed to fetch products: ${error.message}` };
    }
  }
);

// Define the API flow that uses the centralized logic builders
const apiProductIdeasExecutionFlow = localAI.defineFlow(
  {
    name: 'apiProductIdeasExecutionFlow', // Different name for clarity
    inputSchema: GenerateProductIdeasInputSchema, // Imported
    outputSchema: GenerateProductIdeasOutputSchema, // Imported
  },
  async (input) => {
    console.log('[API Route - apiProductIdeasExecutionFlow] Initiated with input:', JSON.stringify(input, null, 2));

    const promptParts = constructPromptParts(input); // Use imported helper
    let toolsToUse : any[] = [];
    if (input.generatorMode === 'gift') {
      toolsToUse.push(getProductCatalogTool); // Use the real tool defined in this file
    }

    console.log('[API Route - apiProductIdeasExecutionFlow] Constructed prompt parts (text only):', JSON.stringify(promptParts.filter(p => p.text), null, 2));
    if (toolsToUse.length > 0) {
        console.log('[API Route - apiProductIdeasExecutionFlow] Tools to be used:', toolsToUse.map(t => t.name));
    }

    try {
      const llmResponse = await localAI.generate({ // Use localAI instance
        messages: [{ role: 'user', content: promptParts }],
        model: gemini('gemini-1.5-flash'),
        config: { temperature: 0.7 },
        ...(toolsToUse.length > 0 && { tools: toolsToUse }),
        // Output schema is not set here, relying on processLlmResponse
      });
      
      console.log('[API Route - apiProductIdeasExecutionFlow] Raw llmResponse:', JSON.stringify(llmResponse, null, 2));
      const rawTextFromMessage = llmResponse.message.content[0]?.text;
      const finalOutput = processLlmResponse(llmResponse, rawTextFromMessage); // Use imported helper

      console.log('[API Route - apiProductIdeasExecutionFlow] Successfully processed output:', JSON.stringify(finalOutput, null, 2));
      return finalOutput;

    } catch (error: any) {
      console.error('[API Route - apiProductIdeasExecutionFlow] Error during AI generation or processing:', error);
      throw error;
    }
  }
);

// API Route Handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = GenerateProductIdeasInputSchema.parse(body); // Use imported schema

    console.log('[API /ai/product-ideas] Received valid input:', JSON.stringify(input, null, 2));

    const result = await apiProductIdeasExecutionFlow.run(input); // Run the new lean API flow

    console.log('[API /ai/product-ideas] Flow run successful, result:', JSON.stringify(result, null, 2));
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
