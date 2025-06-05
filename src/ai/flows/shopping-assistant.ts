
'use server';

/**
 * @fileOverview Provides product recommendations based on user queries.
 * Interacts with a product catalog tool and can ask for clarification.
 *
 * - getProductRecommendations - A function that takes a user query and returns product recommendations or a clarification request.
 * - GetProductRecommendationsInput - The input type for the getProductRecommendations function.
 * - GetProductRecommendationsOutput - The return type for the getProductRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { MOCK_PRODUCTS } from '@/lib/constants';
import type { Product as AppProductType } from '@/lib/types';

// Define a Zod schema for the Product, compatible with AppProductType
const ProductAISchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  category: z.string(),
  dataAiHint: z.string(),
});
export type ProductForAI = z.infer<typeof ProductAISchema>;


const GetProductRecommendationsInputSchema = z.object({
  query: z.string().describe('The user query for product recommendations.'),
});
export type GetProductRecommendationsInput = z.infer<typeof GetProductRecommendationsInputSchema>;

const GetProductRecommendationsOutputSchema = z.object({
  responseType: z.enum(['clarification', 'products', 'no_results', 'error']).describe("The type of response: 'clarification' if asking for more details, 'products' if products are found, 'no_results' if no products match, 'error' for issues."),
  responseText: z.string().describe("The AI's conversational text to display in the chat. This will accompany product listings, clarification questions, or error messages."),
  products: z.array(ProductAISchema).optional().describe('A list of product recommendations. Present if responseType is "products".'),
  clarificationMessage: z.string().optional().describe('Message asking for clarification if the query is too broad. Present if responseType is "clarification".'),
});
export type GetProductRecommendationsOutput = z.infer<typeof GetProductRecommendationsOutputSchema>;


const getProductsTool = ai.defineTool(
  {
    name: 'getProductsFromCatalog',
    description: 'Searches the product catalog based on a user query (e.g., category, keywords, supplier name) and returns matching products. Use this to find products to recommend.',
    inputSchema: z.object({
      searchQuery: z.string().describe("The core search term extracted from the user's query, such as a category (e.g., 'Electronics'), product type (e.g., 'laptop'), or specific keywords. This should be a concise term, not the full user query."),
    }),
    outputSchema: z.array(ProductAISchema),
  },
  async (input) => {
    console.log('[getProductsFromCatalog] Tool called with input:', JSON.stringify(input, null, 2));
    const { searchQuery } = input;

    if (typeof searchQuery !== 'string' || !searchQuery.trim()) {
      console.warn("[getProductsFromCatalog] Tool called with invalid or empty searchQuery:", searchQuery);
      return [];
    }

    // Construct query parameters for the API endpoint
    const queryParams = new URLSearchParams({
      searchQuery: searchQuery,
      limit: '10', // Default limit, can be adjusted or made part of tool input
    });

    // Assuming the Next.js app runs on localhost:3000 or a configurable URL
    // For server-side Genkit flows, direct import and function call might be an option if in the same project,
    // but using fetch keeps it aligned with a service-oriented approach.
    // Ensure this URL is correct for your environment (e.g., use an env variable for production)
    const baseUrl = typeof window === 'undefined'
      ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000')
      : ''; // Use relative path for client-side calls, or full for server if different origins

    const apiUrl = `${baseUrl}/api/products?${queryParams.toString()}`;
    console.log(`[getProductsFromCatalog] Calling API: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[getProductsFromCatalog] API request failed with status ${response.status}: ${errorBody}`);
        throw new Error(`API request failed: ${response.statusText} - ${errorBody}`);
      }
      const productsFromApi = await response.json();
      console.log(`[getProductsFromCatalog] Received ${productsFromApi.length} products from API.`);

      // Map API response to ProductAISchema (imageUrl, dataAiHint)
      const mappedProducts = productsFromApi.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '', // Ensure description is string
        price: p.price,
        imageUrl: p.image_url || '', // Map image_url to imageUrl
        category: p.category || '',   // Ensure category is string
        dataAiHint: p.data_ai_hint || '', // Map data_ai_hint to dataAiHint
      }));

      // Validate with Zod schema before returning
      const validationResult = z.array(ProductAISchema).safeParse(mappedProducts);
      if (!validationResult.success) {
          console.warn('[getProductsFromCatalog] API response validation failed:', validationResult.error.flatten());
          return []; // Return empty if validation fails
      }

      return validationResult.data;
    } catch (error) {
      console.error('[getProductsFromCatalog] Error fetching products from API:', error);
      return []; // Return empty array in case of any error
    }
  }
);


export async function getProductRecommendations(input: GetProductRecommendationsInput): Promise<GetProductRecommendationsOutput> {
  try {
    return await getProductRecommendationsFlow(input);
  } catch (e) {
    console.error("CRITICAL_ERROR_IN_GET_PRODUCT_RECOMMENDATIONS_WRAPPER:", e);
    return {
        responseType: 'error',
        responseText: "I'm having trouble connecting to my knowledge base right now. Please try again in a moment.",
        products: [],
    };
  }
}

const productRecommendationsPrompt = ai.definePrompt({
  name: 'productRecommendationsPrompt',
  tools: [getProductsTool],
  input: { schema: GetProductRecommendationsInputSchema },
  output: { schema: GetProductRecommendationsOutputSchema },
  prompt: `You are an AI Shopping Assistant for TAIC Showcase.
The platform has a diverse catalog of products. Your goal is to help users find what they're looking for.

User Query: {{{query}}}

Instructions:
1.  Analyze the user's query.
2.  If the user asks a meta-question about the conversation itself (e.g., "what did you just say?", "show me what you found earlier?", "can you repeat that?", "well then can you show me what you have found?") that is NOT a new product search:
    - Set 'responseType' to 'clarification'.
    - Set 'responseText' to a message like: "I process each request fresh! If you'd like to search for products, please tell me what you're looking for."
    - Set 'clarificationMessage' to the same message.
    - Do NOT call the 'getProductsFromCatalog' tool.
3.  If the user asks a general question about product availability or types you sell (e.g., 'do you have electronics?', 'what kind of tools do you offer?', 'what styles of shoes do you typically offer?', 'do you have electronics for sale?'), but it's not a direct command to show specific products:
    - Set 'responseType' to 'clarification'.
    - Set 'responseText' to a friendly affirmative response combined with a request for more specific details (e.g., 'Yes, we have a great selection of electronics! Are you looking for something in particular like laptops, headphones, or smart home devices?').
    - Set 'clarificationMessage' to the same message.
    - **Crucially, for this type of general inquiry, you MUST NOT attempt to use the 'getProductsFromCatalog' tool. Your response should directly be the clarification message structured according to the output schema.**
    Example output for this case:
    {
      "responseType": "clarification",
      "responseText": "Yes, we offer a variety of gadgets! To help me find the perfect one, could you tell me if you're looking for something for your home, office, or perhaps a toy?",
      "clarificationMessage": "Yes, we offer a variety of gadgets! To help me find the perfect one, could you tell me if you're looking for something for your home, office, or perhaps a toy?"
    }
4.  If the query *only* contains very broad, non-specific terms (e.g., "show me products", "what do you have?", "search items", "anything", "something") and *does not* contain any identifiable product types, categories, brand names, or specific features, then you MUST ask for clarification.
    For example, "show me products" is too broad. "show me *any* electronics" IS specific enough because "electronics" is an identifiable category.
    Your response should be a friendly question guiding the user to specify a category, type of product, brand, or other details.
    - Set 'responseType' to 'clarification'.
    - Provide your question in 'responseText'.
    - Set 'clarificationMessage' to the same question.
    - Do NOT call the 'getProductsFromCatalog' tool.
    Example output for this case:
    {
      "responseType": "clarification",
      "responseText": "We have a wide variety of items! To help me find the perfect products for you, could you tell me what category you're interested in, or perhaps a specific type of product or brand?",
      "clarificationMessage": "We have a wide variety of items! To help me find the perfect products for you, could you tell me what category you're interested in, or perhaps a specific type of product or brand?"
    }
5.  If the user provides a greeting (e.g., "hello", "hi", "hey"), conversational filler, an acknowledgment, or a polite closing that is NOT a product query (e.g., "ok thanks", "got it", "thank you", "alright", "sounds good", "nevermind"), respond appropriately:
    - Set 'responseType' to 'clarification'.
    - For greetings like "hello" or "hi", set 'responseText' to a friendly greeting like "Hello! How can I help you find something today?" or "Hi there! What can I help you look for?"
    - For acknowledgments or closings like "ok thanks", set 'responseText' to a friendly, non-committal reply like "You're welcome! Is there anything else I can help you find today?" or "Sounds good! Let me know if anything else comes to mind."
    - Set 'clarificationMessage' to the same as 'responseText'.
    - Do NOT call the 'getProductsFromCatalog' tool.
    Example output for a greeting:
    {
        "responseType": "clarification",
        "responseText": "Hello! How can I assist you with your shopping today?",
        "clarificationMessage": "Hello! How can I assist you with your shopping today?"
    }
    Example output for an acknowledgment:
    {
        "responseType": "clarification",
        "responseText": "You got it! Feel free to ask if you need help with anything else.",
        "clarificationMessage": "You got it! Feel free to ask if you need help with anything else."
    }
6.  If the query is specific enough to search for products (e.g., "show me shoes", "electronics under 100 TAIC", "garden tools", "any electronics", "show me electronics", "show me electronics please", "any laptops?"):
    - **IMPORTANT**: For the 'searchQuery' parameter of the 'getProductsFromCatalog' tool, extract ONLY the core product type, category name, or specific keywords.
        - Example: If user says "any electronics" or "show me electronics", the 'searchQuery' for the tool MUST be "electronics".
        - Example: If user says "garden tools", 'searchQuery' MUST be "garden tools".
        - Example: If user says "innovator's dream vr headset", 'searchQuery' MUST be "innovator's dream vr headset".
        - Example: If user says "show me electronics please", 'searchQuery' MUST be "electronics".
        - Example: If user says "show me laptopes" (with a typo), the 'searchQuery' for the tool MUST be "laptopes".
    - Call the 'getProductsFromCatalog' tool with this extracted, concise 'searchQuery'.
    - If the 'getProductsFromCatalog' tool is called and successfully returns a list of products:
        - Set 'responseType' to 'products'.
        - The tool will provide a JSON array of product objects. You MUST take these product objects *exactly as provided by the tool* and place them into the 'products' array of your JSON output.
        - **ABSOLUTELY CRITICAL**: Do NOT modify, alter, shorten, or regenerate ANY part of the product data received from the tool. This is especially important for the 'imageUrl' field – use the exact 'imageUrl' string from the tool's output for each product. All \`imageUrl\` strings in your \`products\` output array MUST be exactly what the \`getProductsFromCatalog\` tool provided for that product; these URLs will typically start with \`https://placehold.co\`. Do not use any other domain or path for images. Under NO circumstances should you invent new image URLs or use placeholders like 'example.com' or any other domain not present in the tool's output for a given product. Failure to adhere to this for 'imageUrl' will result in an error.
        - Craft a friendly 'responseText' like "Here are some products I found matching your query:" or "Okay, I found these items for you:".
    - If the tool returns an empty list (no products found for the specific search terms):
        - Set 'responseType' to 'no_results'.
        - Craft a 'responseText' explaining that no products were found for their specific query and perhaps suggest they try different terms or browse categories. For example: "I couldn't find any products based on '{{{query}}}'. Would you like to try a different search or browse categories?"
        - **Ensure the 'products' field in your JSON output is an empty array \`[]\`.**
        - **Under no circumstances should you respond as if products exist or ask for more details if the tool has returned no results for the user's specific query. You must inform the user directly that no products matching their search terms were found.**
7.  If you encounter an internal issue or cannot fulfill the request appropriately, set 'responseType' to 'error' and provide a helpful message in 'responseText'.

Strictly adhere to the output JSON schema. Do not omit any required fields for the chosen responseType.
Ensure 'responseText' is always populated.
If 'responseType' is 'products', the 'products' array must be present, even if empty (though if it's empty, 'responseType' should ideally be 'no_results').
If 'responseType' is 'clarification', 'clarificationMessage' should be populated.
`,
});

const getProductRecommendationsFlow = ai.defineFlow(
  {
    name: 'getProductRecommendationsFlow',
    inputSchema: GetProductRecommendationsInputSchema,
    outputSchema: GetProductRecommendationsOutputSchema,
  },
  async (input) => {
    console.log('[getProductRecommendationsFlow] Initiated with input:', JSON.stringify(input, null, 2));
    try {
      const llmResponse = await productRecommendationsPrompt(input);
      console.log('[getProductRecommendationsFlow] Raw LLM response:', JSON.stringify(llmResponse, null, 2));
      
      if (!llmResponse || !llmResponse.output) {
        console.error("[getProductRecommendationsFlow] LLM response output is invalid or null.", llmResponse);
        return {
          responseType: 'error' as const,
          responseText: "My apologies, I couldn't structure a response properly. Could you try rephrasing?",
          products: [],
        };
      }

      // Validate the output against our schema
      const result = GetProductRecommendationsOutputSchema.safeParse(llmResponse.output);
      
      if (!result.success) {
        console.error('[getProductRecommendationsFlow] Invalid response format:', result.error);
        return {
          responseType: 'error' as const,
          responseText: "I'm having trouble understanding the response. Please try again.",
          products: [],
        };
      }

      // Get the validated data
      let output = result.data;
      
      // Ensure responseType is one of the allowed values (should be handled by schema, but just in case)
      if (!['clarification', 'products', 'no_results', 'error'].includes(output.responseType)) {
        console.warn("[getProductRecommendationsFlow] Invalid responseType:", output.responseType);
        return {
          responseType: 'error' as const,
          responseText: "I encountered an issue processing your request. Please try again.",
          products: [],
        };
      }

      // Ensure products array is present for products response type
      if (output.responseType === 'products') {
        if (!output.products || output.products.length === 0) {
          return {
            responseType: 'no_results' as const,
            responseText: "I couldn't find any products matching your search. Could you try different keywords?",
            products: [],
          };
        }
      } else {
        // Clear products for non-products response types
        output.products = [];
      }

      // Ensure we have a clarification message for clarification response type
      if (output.responseType === 'clarification') {
        if (!output.clarificationMessage || output.clarificationMessage.trim() === "") {
          output.clarificationMessage = output.responseText || "Could you please provide more details?";
        }
        if (!output.responseText || output.responseText.trim() === "") {
          output.responseText = output.clarificationMessage;
        }
        console.log('[getProductRecommendationsFlow] Clarification response. Message:', output.clarificationMessage);
      }
      
      // Ensure products is empty for non-product responses
      if (output.responseType !== 'products') {
        output.products = [];
      }

      console.log('[getProductRecommendationsFlow] Final output:', JSON.stringify(output, null, 2));
      return output;
    } catch (flowError) {
      console.error("[getProductRecommendationsFlow] CRITICAL_ERROR in flow execution:", flowError);
      return {
        responseType: 'error' as const,
        responseText: "A critical error occurred within the shopping assistant flow. Please report this.",
        products: [],
      };
    }
  }
);