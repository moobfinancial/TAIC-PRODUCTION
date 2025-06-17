// src/app/api/ai/shopping-assistant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit'; // Import the configured ai instance

import { googleAI, gemini } from '@genkit-ai/googleai'; // To specify model instance and gemini helper

// Import schemas from the centralized file
import {
  GetProductRecommendationsInputSchema,
  GetProductRecommendationsOutputSchema,
  type ProductForAI,
  type GetProductRecommendationsInput,
  type GetProductRecommendationsOutput
} from '@/ai/schemas/shopping-assistant-schemas';

// Import the prompt builder
import { buildProductRecommendationsMessages } from '@/ai/prompts/shopping-assistant-prompts';
// Import the keyword extractor prompt and schema
import { buildKeywordExtractorMessages, KeywordExtractorOutputSchema } from '@/ai/prompts/keyword-extractor-prompt';
// ProductAISchema is needed for fetchProductsDirectly
import { ProductAISchema } from '@/ai/schemas/shopping-assistant-schemas';

// Helper function to fetch products directly (adapted from getProductsTool)
async function fetchProductsDirectly(userQuery: string | undefined): Promise<ProductForAI[]> {
  console.log('[fetchProductsDirectly] Called with query:', userQuery);

  const queryParams = new URLSearchParams();
  if (userQuery) {
    queryParams.append('search', userQuery);
  }

  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'development' && (!appUrl || !appUrl.includes(':9002'))) {
    console.log('[fetchProductsDirectly] Overriding appUrl for development to port 9002');
    appUrl = 'http://localhost:9002';
  } else if (!appUrl) {
    console.log('[fetchProductsDirectly] NEXT_PUBLIC_APP_URL not set, defaulting to http://localhost:3000');
    appUrl = 'http://localhost:3000';
  }
  const apiUrl = `${appUrl}/api/products?${queryParams.toString()}`;

  console.log(`[fetchProductsDirectly] Fetching products from: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetchProductsDirectly] API request failed with status ${response.status}: ${errorText}`);
      return [];
    }

    const responseJson = await response.json();
    const productsData: any[] = responseJson.data || []; // Ensure productsData is an array
    console.log('[fetchProductsDirectly] Received productsData count:', productsData.length);

    const validatedProducts: ProductForAI[] = [];
    for (const product of productsData) {
      let finalImageUrl = product.image_url || product.imageUrl;
      if (typeof finalImageUrl === 'string' && finalImageUrl.startsWith('[')) {
        try {
          const images = JSON.parse(finalImageUrl);
          if (Array.isArray(images) && images.length > 0) {
            finalImageUrl = images[0];
          } else {
            finalImageUrl = undefined;
          }
        } catch (e) {
          console.error(`[fetchProductsDirectly] Failed to parse imageUrl for product ID ${product.id}:`, e);
          finalImageUrl = undefined;
        }
      }

      const mappedProduct = {
        id: product.id?.toString(),
        name: product.name,
        description: product.description,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
        imageUrl: finalImageUrl,
        category: product.category, // Default is handled by Zod schema if undefined
        dataAiHint: product.dataAiHint || `Product: ${product.name}, Category: ${product.category || 'N/A'}`,
      };

      const validation = ProductAISchema.safeParse(mappedProduct);
      if (validation.success) {
        validatedProducts.push(validation.data);
      } else {
        console.warn(`[fetchProductsDirectly] Product ID ${product.id} failed validation:`, validation.error.flatten());
      }
    }
    console.log(`[fetchProductsDirectly] Returning ${validatedProducts.length} validated products.`);
    return validatedProducts;
  } catch (error: any) {
    console.error('[fetchProductsDirectly] CRITICAL_ERROR fetching or processing products:', error.message, error.stack);
    return [];
  }
}

// Define the flow using the central 'ai' instance
const shoppingAssistantFlow = ai.defineFlow({
  name: 'shoppingAssistantFlow',
  inputSchema: GetProductRecommendationsInputSchema,
  outputSchema: GetProductRecommendationsOutputSchema, // Output schema for the flow itself
}, async (input: GetProductRecommendationsInput): Promise<GetProductRecommendationsOutput> => {
  console.log('[API Shopping Assistant Flow] Initiated with input:', JSON.stringify(input, null, 2));

  // Step 1: Extract keywords from the user's query
  let extractedKeywords = input.query; // Default to original query if extraction fails
  try {
    const keywordMessages = buildKeywordExtractorMessages(input.query);
    const keywordLlmResponse = await ai.generate({
      model: gemini('gemini-2.0-flash'),
      messages: keywordMessages,
      config: { temperature: 0.1 }, // Low temperature for precise extraction
    });
    const rawKeywordResponseText = keywordLlmResponse.message?.content?.[0]?.text;
    if (rawKeywordResponseText) {
      let cleanedKeywordJsonString = rawKeywordResponseText;
      const keywordJsonBlockMatch = cleanedKeywordJsonString.match(/```json\s*([\s\S]*?)\s*```/s);
      if (keywordJsonBlockMatch && keywordJsonBlockMatch[1]) {
        cleanedKeywordJsonString = keywordJsonBlockMatch[1];
      }
      cleanedKeywordJsonString = cleanedKeywordJsonString.trim();
      const parsedKeywordJson = JSON.parse(cleanedKeywordJsonString);
      const validatedKeywords = KeywordExtractorOutputSchema.safeParse(parsedKeywordJson);
      if (validatedKeywords.success) {
        extractedKeywords = validatedKeywords.data.keywords;
        console.log('[API Shopping Assistant Flow] Extracted keywords:', extractedKeywords);
      } else {
        console.warn('[API Shopping Assistant Flow] Keyword extraction JSON did not match schema:', validatedKeywords.error.flatten());
      }
    } else {
      console.warn('[API Shopping Assistant Flow] Keyword extraction LLM response was empty.');
    }
  } catch (keywordError: any) {
    console.error('[API Shopping Assistant Flow] Error during keyword extraction:', keywordError.message);
    // Fallback to original query already handled by default assignment
  }

  // Step 2: Fetch products directly using the extracted keywords
  const productsFound = await fetchProductsDirectly(extractedKeywords);
  console.log('[API Shopping Assistant Flow] Products found directly (using extracted keywords):', JSON.stringify(productsFound.slice(0,2), null, 2)); // Log first 2

  // Step 3: Build messages for the LLM, using original input query for context and fetched product data
  const messages = buildProductRecommendationsMessages(input, productsFound);
  // Note: 'input' still contains the original user query, which is good for the LLM's final response generation.

  try {
    // Step 3: Call LLM to formulate the final JSON response based on fetched data
    const llmResponse = await ai.generate({
      model: gemini('gemini-2.0-flash'),
      messages: messages, // Pass messages that include context about fetched products
      // No 'tools' array here, as we are not asking the LLM to call tools anymore
      config: { temperature: 0.3 },
    });

    console.log('[API Shopping Assistant Flow] Raw llmResponse object:', JSON.stringify(llmResponse, null, 2));

    const rawResponseText = llmResponse.message?.content?.[0]?.text;
    console.log('[API Shopping Assistant Flow] Raw LLM response text:', rawResponseText);

    if (!rawResponseText) {
      console.error('[API Shopping Assistant Flow] LLM response or text content is missing.');
      return {
        responseType: 'error',
        responseText: 'The AI did not provide a response. Please try again.',
        products: [],
      };
    }

    try {
      let cleanedJsonString = rawResponseText;
      // Remove potential markdown fencing ```json ... ```
      const jsonBlockMatch = cleanedJsonString.match(/```json\s*([\s\S]*?)\s*```/s);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        cleanedJsonString = jsonBlockMatch[1];
        console.log('[API Shopping Assistant Flow] Extracted JSON from markdown block.');
      } 
      cleanedJsonString = cleanedJsonString.trim();
      
      // Attempt to fix common LLM quirks like escaped apostrophes or trailing commas if necessary
      // cleanedJsonString = cleanedJsonString.replace(/\\'/g, "'"); // Example for escaped apostrophes

      const parsedJson = JSON.parse(cleanedJsonString);
      const validationResult = GetProductRecommendationsOutputSchema.safeParse(parsedJson);

      if (validationResult.success) {
        console.log('[API Shopping Assistant Flow] Successfully parsed and validated JSON from LLM text.');
        return validationResult.data;
      } else {
        console.error('[API Shopping Assistant Flow] Parsed JSON does not match schema:', JSON.stringify(validationResult.error.errors, null, 2));
        return {
          responseType: 'error',
          responseText: `The AI's response was not in the expected format. Raw response: ${rawResponseText.substring(0, 500)}...`, // Truncate for safety
          products: [],
        };
      }
    } catch (parseError: any) {
      console.error('[API Shopping Assistant Flow] Failed to parse LLM response as JSON:', parseError.message);
      console.error('[API Shopping Assistant Flow] Raw text that failed parsing:', rawResponseText);
      return {
        responseType: 'error',
        responseText: `The AI returned a response that could not be processed. Raw response: ${rawResponseText.substring(0,500)}...`, // Truncate
        products: [],
      };
    }
  } catch (flowError: any) {
    console.error('[API Shopping Assistant Flow] Error during AI generation or processing:', flowError);
    const errorMessage = flowError.message || 'An unexpected error occurred with the AI assistant.';
    console.error('[API Shopping Assistant Flow] Full flow error object:', JSON.stringify(flowError, null, 2));
    
    return {
      responseType: 'error',
      responseText: `An error occurred: ${errorMessage.substring(0, 200)}`,
      products: [],
    };
  }
});

// API Route Handler
export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    console.log('[API Shopping Assistant POST] Received request with input:', JSON.stringify(input, null, 2));

    const validatedInput = GetProductRecommendationsInputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error('[API Shopping Assistant POST] Invalid input:', validatedInput.error.flatten());
      return NextResponse.json(
        {
          responseType: 'error',
          responseText: `Invalid input: ${validatedInput.error.flatten().fieldErrors.query?.[0] || 'Please provide a valid query.'}`,
          products: [],
        },
        { status: 400 }
      );
    }

    const result = await shoppingAssistantFlow.run(validatedInput.data);
    console.log('[API Shopping Assistant POST] Flow output:', JSON.stringify(result, null, 2));
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API Shopping Assistant POST] Unhandled error in POST handler:', error);
    console.error('[API Shopping Assistant POST] Full unhandled error object:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      {
        responseType: 'error',
        responseText: `An unexpected server error occurred: ${error.message || 'Unknown error'}. Please try again later.`,
        products: [],
      },
      { status: 500 }
    );
  }
}
