// src/ai/schemas/shopping-assistant-schemas-new.ts
import { z } from 'zod';

// Define a Zod schema for the Product, compatible with AppProductType
export const ProductAISchema = z.object({
  id: z.string(), // This is the cj_product_id
  page_id: z.string().optional(), // This will be the simple ID for Next.js page routes
  name: z.string(),
  description: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  category: z.string().optional().default('Uncategorized'), // Make category optional with default
  dataAiHint: z.string().optional().default(''), // Make dataAiHint optional with default
  productUrl: z.string().optional(),
  attributes: z.array(z.any()).optional(),
  inventory: z.object({
    stockQuantity: z.number().optional(),
    availability: z.string().optional()
  }).optional(),
  brand: z.string().optional(),
  currency: z.string().optional().default('USD'),
  sku: z.string().optional(),
});
export type ProductForAI = z.infer<typeof ProductAISchema>;

export const GetProductRecommendationsInputSchema = z.object({
  query: z.string().describe('The user query for product recommendations.'),
});
export type GetProductRecommendationsInput = z.infer<typeof GetProductRecommendationsInputSchema>;

export const GetProductRecommendationsOutputSchema = z.object({
  responseType: z.enum(['clarification', 'products', 'no_results', 'error']).describe("The type of response: 'clarification' if asking for more details, 'products' if products are found, 'no_results' if no products match, 'error' for issues."),
  responseText: z.string().describe("The AI's conversational text to display in the chat. This will accompany product listings, clarification questions, or error messages."),
  products: z.array(ProductAISchema).optional().describe('A list of product recommendations. Present if responseType is "products".'),
  clarificationMessage: z.string().optional().describe('Message asking for clarification if the query is too broad. Present if responseType is "clarification".'),
});
export type GetProductRecommendationsOutput = z.infer<typeof GetProductRecommendationsOutputSchema>;
