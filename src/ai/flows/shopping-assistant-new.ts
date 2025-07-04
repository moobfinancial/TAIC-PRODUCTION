// src/ai/flows/shopping-assistant-new.ts
import { OpenAI } from 'openai';
import { z } from 'zod';
import { 
  GetProductRecommendationsInputSchema,
  GetProductRecommendationsOutputSchema,
  type GetProductRecommendationsInput,
  type GetProductRecommendationsOutput
} from '@/ai/schemas/shopping-assistant-schemas-new';
import { getProducts } from '@/ai/tools/get-products-new';
import { extractKeywords } from '@/ai/prompts/keyword-extractor-prompt-new';

/**
 * Generate product recommendations based on a user query
 */
export async function getProductRecommendations(
  input: GetProductRecommendationsInput
): Promise<GetProductRecommendationsOutput> {
  console.log('[getProductRecommendations] Initiated with input:', JSON.stringify(input, null, 2));
  
  try {
    // 1. Extract keywords from the user query to optimize product search
    const keywords = await extractKeywords(input.query);
    console.log(`[getProductRecommendations] Extracted keywords: "${keywords}" from query: "${input.query}"`);
    
    // 2. Use the extracted keywords to fetch products
    const products = await getProducts({ query: keywords });
    console.log(`[getProductRecommendations] Found ${products.length} products for keywords: "${keywords}"`);
    
    // 3. Generate a response based on the products found
    if (products.length === 0) {
      // No products found
      return {
        responseType: 'no_results',
        responseText: `I couldn't find any products matching "${input.query}". Would you like to try different search terms?`,
        products: [],
      };
    }
    
    // 4. If products were found, use OpenAI to generate a personalized response
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const systemPrompt = `
You are a helpful shopping assistant for an e-commerce store. Your task is to recommend products based on the user's query and the available product data.

You will be provided with:
1. The user's original query
2. A list of products that match their search

Your job is to create a friendly, helpful response that presents these products in a way that feels personalized to the user's needs.

Rules:
- If the user's query is too vague or could benefit from clarification, ask for more specific details about what they're looking for.
- If you have products to show, present them in a friendly, conversational way.
- NEVER make up or invent product details that aren't in the provided product data.
- NEVER modify product data (especially image URLs) - use exactly what's provided.
- Format your response according to the output schema.

Output as JSON with the following structure:
{
  "responseType": "clarification" | "products" | "no_results" | "error",
  "responseText": "Your conversational response text here",
  "products": [array of product objects, exactly as provided],
  "clarificationMessage": "Optional question asking for more details"
}
`;
    
    const userMessage = `
User query: "${input.query}"

Available products: ${JSON.stringify(products, null, 2)}
`;
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[getProductRecommendations] No content in response');
      return {
        responseType: 'error',
        responseText: "I'm sorry, I couldn't structure a response properly. Could you try rephrasing?",
        products: [],
      };
    }
    
    try {
      const parsedContent = JSON.parse(content);
      const result = GetProductRecommendationsOutputSchema.safeParse(parsedContent);
      
      if (!result.success) {
        console.error('[getProductRecommendations] Invalid response format:', result.error);
        return {
          responseType: 'error',
          responseText: "I'm having trouble understanding the response. Please try again.",
          products: [],
        };
      }
      
      // Get the validated data
      let output = result.data;
      
      // Ensure responseType is one of the allowed values (should be handled by schema, but just in case)
      if (!['clarification', 'products', 'no_results', 'error'].includes(output.responseType)) {
        console.warn("[getProductRecommendations] Invalid responseType:", output.responseType);
        return {
          responseType: 'error',
          responseText: "I encountered an issue processing your request. Please try again.",
          products: [],
        };
      }

      // Ensure products array is present for products response type
      if (output.responseType === 'products') {
        if (!output.products || output.products.length === 0) {
          return {
            responseType: 'no_results',
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
        console.log('[getProductRecommendations] Clarification response. Message:', output.clarificationMessage);
      }
      
      // Ensure products is empty for non-product responses
      if (output.responseType !== 'products') {
        output.products = [];
      }

      console.log('[getProductRecommendations] Final output:', JSON.stringify(output, null, 2));
      return output;
      
    } catch (parseError) {
      console.error('[getProductRecommendations] Error parsing JSON response:', parseError);
      return {
        responseType: 'error',
        responseText: "I'm having trouble processing your request. Please try again.",
        products: [],
      };
    }
    
  } catch (flowError: any) {
    console.error("[getProductRecommendations] CRITICAL_ERROR in flow execution:", flowError);
    return {
      responseType: 'error',
      responseText: "A critical error occurred within the shopping assistant flow. Please report this.",
      products: [],
    };
  }
}
