import { NextRequest, NextResponse } from 'next/server';
import { z } from 'genkit';
import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

// Local Genkit Initialization
const localAI = genkit({
  enableTracingAndMetrics: false,
  plugins: [
    googleAI({ apiKey: process.env.GOOGLE_API_KEY }),
  ],
  model: 'gemini-2.0-flash',
});

// Schema Definitions (copied from product-idea-generator.ts)
const GenerateProductIdeasInputSchema = z.object({
  productDescription: z
    .string()
    .describe('A textual description of the product idea or context for gift suggestions.'),
  imageUrl: z.string().url().optional().describe('Optional URL of an image to provide visual context for the idea generation.'),
  generatorMode: z.enum(['product', 'gift']).default('product').describe('Mode of operation: "product" for new product ideas, "gift" for gift suggestions.'),
});
export type GenerateProductIdeasInput = z.infer<typeof GenerateProductIdeasInputSchema>;

const ProductAISchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  image_url: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  data_ai_hint: z.string().nullable().optional(),
  source: z.enum(['MANUAL', 'CJ']).optional(),
});
export type ProductForAI = z.infer<typeof ProductAISchema>;

const GenerateProductIdeasOutputSchema = z.object({
  suggestions: z
    .string()
    .describe('Suggestions for improving the product idea or gift suggestions. This may also include a summary of any matching products found from the catalog.'),
  products: z.array(ProductAISchema).optional().describe('An optional list of existing products from the catalog that match or are relevant to the generated ideas/suggestions.'),
});
export type GenerateProductIdeasOutput = z.infer<typeof GenerateProductIdeasOutputSchema>;

// Tool Definition (copied from product-idea-generator.ts)
const getProductCatalogTool = localAI.defineTool(
  {
    name: 'getProductCatalog',
    description: 'Searches the product catalog for items matching a query and/or category. Use this to find existing products relevant to the user\'s idea or request.',
    inputSchema: z.object({
      searchQuery: z.string().optional().describe('Keywords to search for in product names, descriptions, or categories.'),
      platform_category_id: z.number().int().positive().optional().describe('The specific platform category ID to filter by. Obtain this from product data if seen before, or infer if highly confident.'),
      limit: z.number().int().min(1).max(10).optional().default(5).describe('Maximum number of products to return.'),
    }),
    outputSchema: z.object({
      products: z.array(ProductAISchema).describe('An array of products found, or an empty array if none match.'),
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
      const validatedProducts = z.array(ProductAISchema).safeParse(result.data);
      if (validatedProducts.success) {
        console.log('[API Route - getProductCatalogTool] Products found:', validatedProducts.data.length);
        return { products: validatedProducts.data };
      } else {
        console.error('[API Route - getProductCatalogTool] API response validation error:', validatedProducts.error);
        return { products: [], error: `API response validation failed: ${validatedProducts.error.message}` };
      }
    } catch (error: any) {
      console.error('[API Route - getProductCatalogTool] Fetch error:', error);
      return { products: [], error: `Failed to fetch products: ${error.message}` };
    }
  }
);

// Flow Definition (copied from product-idea-generator.ts and adapted to use main 'ai' instance)
const generateProductIdeasFlow = localAI.defineFlow(
  {
    name: 'generateProductIdeasFlow_APIRoute',
    inputSchema: GenerateProductIdeasInputSchema,
    outputSchema: GenerateProductIdeasOutputSchema,
  },
  async (input) => {
    console.log('[API Route - generateProductIdeasFlow] Initiated with input:', JSON.stringify(input, null, 2));
    const { productDescription, imageUrl, generatorMode } = input;
    let promptParts: any[] = [];

    if (generatorMode === 'gift') {
      promptParts.push({ text: "You are an expert gift advisor. A user will provide a description of a recipient, occasion, or context, possibly with an image. Your task is to suggest thoughtful and relevant gift ideas." });
      promptParts.push({ text: `\nUser's request for gift ideas: \"${productDescription}\"` });
      if (imageUrl) {
        promptParts.push({ text: "\nThe user also provided an image for additional context. Analyze the image and consider its content (e.g., person's appearance, items in a room, style) when suggesting gifts:" });
        promptParts.push({ media: { url: imageUrl } });
        promptParts.push({ text: "\nBased on the text description AND the image, provide creative and fitting gift suggestions. Explain why each suggestion is suitable." });
      } else {
        promptParts.push({ text: "\nBased on the text description, provide creative and fitting gift suggestions. Explain why each suggestion is suitable." });
      }
    } else { // 'product' mode
      promptParts.push({ text: "You are a product innovation expert. A user will provide a description of their product idea, possibly with an image for context. Your task is to provide suggestions for improving or expanding upon this product idea. Be creative and think outside the box." });
      promptParts.push({ text: `\nUser's product idea description: \"${productDescription}\"` });
      if (imageUrl) {
        promptParts.push({ text: "\nThe user also provided an image related to their product idea. Analyze the image and consider its content when generating suggestions for their product idea:" });
        promptParts.push({ media: { url: imageUrl } });
        promptParts.push({ text: "\nBased on the text description AND the image, provide innovative suggestions to enhance or complement the product idea." });
      } else {
        promptParts.push({ text: "\nBased on the text description, provide innovative suggestions to enhance or complement the product idea." });
      }
    }
    promptParts.push({text: "\nFormat your response clearly. If suggesting multiple ideas, use bullet points or numbered lists."});
    promptParts.push({ text: "\n\nTOOL USAGE GUIDELINES:" });
    promptParts.push({ text: "You have a tool called `getProductCatalog` to search our product catalog. Input parameters for the tool are `searchQuery` (string, optional keywords), `platform_category_id` (number, optional category ID), and `limit` (number, optional, default 5)."});
    promptParts.push({ text: "After you have generated your initial creative ideas and suggestions, ALWAYS attempt to use the `getProductCatalog` tool to find relevant items from our catalog that align with your suggestions." });
    promptParts.push({ text: "To do this, identify 1-2 key themes or item types from your suggestions and use those as `searchQuery` values for the tool. For example, if you suggest 'a cozy blanket', try searching for 'blanket'. If you suggest 'gardening tools', try searching for 'gardening tools'." });
    promptParts.push({ text: "Even if the user's initial request is broad, try to narrow down potential product categories from your suggestions to make effective use of the search tool." });
    promptParts.push({ text: "When you use the `getProductCatalog` tool, it will return products with fields: `id`, `name`, `description`, `price`, `image_url`, `category_name`, `data_ai_hint`, `source`." });
    promptParts.push({ text: "If the tool returns relevant products:" });
    promptParts.push({ text: "1. Briefly mention these products in your main `suggestions` text (e.g., 'We also have a [Product Name] that you might like.')" });
    promptParts.push({ text: "2. Populate the `products` array in your final JSON output with the full details of these matched products (id, name, description, price, image_url, category_name, data_ai_hint, source)." });
    promptParts.push({ text: "If no relevant products are found, or if your ideas are too novel, simply omit the `products` array or leave it empty. Only include products if they are a good match." });

    console.log('[API Route - generateProductIdeasFlow] Constructed prompt parts (text only):', JSON.stringify(promptParts.filter(p => p.text), null, 2));

    try {
      const llmResponse = await localAI.generate({
        messages: [{ role: 'user', content: promptParts }],
        model: gemini('gemini-2.0-flash'), 
        config: { temperature: 0.7 },
        tools: [getProductCatalogTool]
        // output: { schema: GenerateProductIdeasOutputSchema }, // Removed to handle raw LLM output manually
      });

      console.log('[API Route - generateProductIdeasFlow] Raw llmResponse:', JSON.stringify(llmResponse, null, 2));

      let output: z.infer<typeof GenerateProductIdeasOutputSchema> | undefined;
      let rawTextFromLLM: string | undefined;

      // Check for tool calls first if applicable in future versions
      // For now, we expect either a text response or a JSON object in the text response.

      if (llmResponse && llmResponse.message && llmResponse.message.content && llmResponse.message.content[0] && llmResponse.message.content[0].text) {
        rawTextFromLLM = llmResponse.message.content[0].text;
        let jsonContent = '';
        let textBeforeJson = '';
        const jsonBlockMatch = rawTextFromLLM.match(/^(.*?)(```json\s*([\s\S]*?)\s*```)(.*)$/s);

        if (jsonBlockMatch && jsonBlockMatch[3]) {
          textBeforeJson = (jsonBlockMatch[1] || '').trim();
          jsonContent = jsonBlockMatch[3].trim();
          console.log('[API Route - generateProductIdeasFlow] Extracted JSON block from LLM text.');
        } else {
          // If no markdown fence, assume the whole string might be JSON (or not JSON at all)
          jsonContent = rawTextFromLLM.trim();
          console.log('[API Route - generateProductIdeasFlow] No JSON block detected, attempting to parse entire LLM text.');
        }

        try {
          // Attempt to fix a common LLM quirk where it might escape apostrophes as \'
          const potentiallyFixedJsonContent = jsonContent.replace(/\\'/g, "'");
          let parsedJson = JSON.parse(potentiallyFixedJsonContent);
          if (jsonContent !== potentiallyFixedJsonContent) {
            console.log('[API Route - generateProductIdeasFlow] Applied pre-parse fix for escaped apostrophes.');
          }
          console.log('[API Route - generateProductIdeasFlow] Successfully parsed string to JSON object.');

          // Pre-process suggestions if it's an array
          if (parsedJson && Array.isArray(parsedJson.suggestions)) {
            console.log('[API Route - generateProductIdeasFlow] LLM provided suggestions as an array, converting to string.');
            parsedJson.suggestions = parsedJson.suggestions.join('\n- '); 
          }

          const validationResult = GenerateProductIdeasOutputSchema.safeParse(parsedJson);
          if (validationResult.success) {
            output = validationResult.data;
            console.log('[API Route - generateProductIdeasFlow] Successfully parsed and validated JSON from LLM text.');
          } else {
            console.warn('[API Route - generateProductIdeasFlow] Parsed JSON does not match schema after potential modifications:', JSON.stringify(validationResult.error.errors, null, 2));
            // Attempt to salvage if products are present but overall schema failed (e.g. suggestions format still off)
            if (parsedJson && Array.isArray(parsedJson.products)) {
              console.log('[API Route - generateProductIdeasFlow] Attempting to salvage products from schema-failed JSON.');
              let suggestionsText = textBeforeJson || "Suggestions provided (format may vary)."; // Default or text before JSON block
              
              if (typeof parsedJson.suggestions === 'string' && parsedJson.suggestions.trim()) {
                suggestionsText = (textBeforeJson ? textBeforeJson + '\n\n' : '') + parsedJson.suggestions;
              } else if (textBeforeJson === '' && !parsedJson.suggestions) {
                 // If no text before and no suggestions in JSON, use a generic one if products exist
                 suggestionsText = "Please see the product recommendations below.";
              }

              try {
                const validatedProducts = parsedJson.products.map((p: any) => ProductAISchema.parse(p));
                output = {
                  suggestions: suggestionsText.trim(),
                  products: validatedProducts,
                };
                console.log('[API Route - generateProductIdeasFlow] Successfully salvaged products with potentially non-schema-compliant suggestions.');
              } catch (productParseError) {
                console.error('[API Route - generateProductIdeasFlow] Error parsing individual products during salvage:', productParseError);
                // Fallback to no products if individual product parsing fails
                output = { suggestions: suggestionsText.trim(), products: [] };
              }
            } else {
                 console.log('[API Route - generateProductIdeasFlow] Could not salvage products, JSON structure issue or no products array.');
            }
          }
        } catch (jsonParseError: any) {
          console.log('[API Route - generateProductIdeasFlow] LLM response content was not valid JSON. Error:', jsonParseError.message);
          // rawTextFromLLM will be used in the !output block below
        }
      }

      // Fallback logic if no output has been successfully parsed or salvaged
      if (!output) {
        if (rawTextFromLLM && rawTextFromLLM.trim()) {
          console.log('[API Route - generateProductIdeasFlow] Using raw LLM text as suggestion because no valid structured output was parsed/salvaged:', rawTextFromLLM);
          output = { suggestions: rawTextFromLLM, products: [] };
        } else {
          console.error('[API Route - generateProductIdeasFlow] LLM response was empty or unusable after all parsing attempts:', JSON.stringify(llmResponse, null, 2));
          output = { suggestions: 'Sorry, I encountered an issue generating ideas. Please try again or rephrase your request.', products: [] };
        }
      }
      
      // Process product image_urls to extract single URL from stringified array or handle empty strings
      if (output && output.products && Array.isArray(output.products)) {
        output.products = output.products.map(product => {
          let currentImageUrl = product.image_url;

          if (currentImageUrl && typeof currentImageUrl === 'string') {
            // Attempt to parse if it looks like a stringified array
            if (currentImageUrl.startsWith('[') && currentImageUrl.endsWith(']')) {
              try {
                const imageUrls = JSON.parse(currentImageUrl);
                if (Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'string') {
                  currentImageUrl = imageUrls[0]; // Use the first URL
                } else {
                  // Stringified array was empty, didn't contain strings, or was invalid format after parsing
                  console.warn(`[API Route - generateProductIdeasFlow] Product ID ${product.id} image_url was stringified empty/invalid array: ${product.image_url}`);
                  currentImageUrl = null;
                }
              } catch (e) {
                // JSON.parse failed for the stringified array
                console.warn(`[API Route - generateProductIdeasFlow] Failed to parse stringified image_url for product ID ${product.id}: ${product.image_url}`, e);
                currentImageUrl = null;
              }
            }
            // After potential array parsing, or if it was a plain string, check if it's an empty string
            if (typeof currentImageUrl === 'string' && currentImageUrl.trim() === '') {
              currentImageUrl = null;
            }
          } else if (currentImageUrl === '') {
            // Handles cases where image_url was initially an empty string (not null/undefined)
            currentImageUrl = null;
          }
          // Ensure final image_url is either a non-empty string or null
          return { ...product, image_url: (typeof currentImageUrl === 'string' && currentImageUrl.trim() !== '') ? currentImageUrl.trim() : null };
        });
      }

      console.log('[API Route - generateProductIdeasFlow] Successfully parsed output (with image_url processing):', JSON.stringify(output, null, 2));
      return output;

    } catch (error: any) {
      console.error('[API Route - generateProductIdeasFlow] Error during AI generation or processing:', error);
      throw error; // Re-throw to be caught by POST handler
    }
  }
);

// API Route Handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = GenerateProductIdeasInputSchema.parse(body);

    console.log('[API /ai/product-ideas] Received valid input:', JSON.stringify(input, null, 2));

    const result = await generateProductIdeasFlow.run(input);

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
