'use server';

/**
 * @fileOverview AI flow for generating product ideas based on user input.
 *
 * - generateProductIdeas - A function that takes a product idea description and returns suggestions for improvement.
 * - GenerateProductIdeasInput - The input type for the generateProductIdeas function.
 * - GenerateProductIdeasOutput - The return type for the generateProductIdeas function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductIdeasInputSchema = z.object({
  productDescription: z
    .string()
    .describe('A textual description of the product idea or context for gift suggestions.'),
  imageUrl: z.string().url().optional().describe('Optional URL of an image to provide visual context for the idea generation.'),
  generatorMode: z.enum(['product', 'gift']).default('product').describe('Mode of operation: "product" for new product ideas, "gift" for gift suggestions.'),
});
export type GenerateProductIdeasInput = z.infer<typeof GenerateProductIdeasInputSchema>;

// Define ProductAISchema here or import from a shared location if used by other flows/tools in this file.
// For this refactor, let's assume it's specific enough to be here or route.ts.
// To make this file the SSoT for flow logic, we need the schemas here.
const ProductAISchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  image_url: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  data_ai_hint: z.string().nullable().optional(),
  source: z.enum(['MANUAL', 'CJ']).optional(), // Assuming source is one of these
});
export type ProductForAI = z.infer<typeof ProductAISchema>;

const GenerateProductIdeasOutputSchema = z.object({
  suggestions: z
    .string()
    .describe('Suggestions for improving the product idea or gift suggestions. This may also include a summary of any matching products found from the catalog.'),
  products: z.array(ProductAISchema).optional().describe('An optional list of existing products from the catalog that match or are relevant to the generated ideas/suggestions.'),
});
export type GenerateProductIdeasOutput = z.infer<typeof GenerateProductIdeasOutputSchema>;

export async function generateProductIdeas(input: GenerateProductIdeasInput): Promise<GenerateProductIdeasOutput> {
  // Ensure the flow is run with an AI instance that has getProductCatalogTool registered if in 'gift' mode.
  // This might involve passing the configured 'localAI' instance from route.ts into this function,
  // or ensuring the global 'ai' instance is appropriately configured.
  // For now, assuming the `ai` instance used by `generateProductIdeasFlow` can find the tool by name.
  return generateProductIdeasFlow(input);
}

// Removed ai.definePrompt for 'productIdeaGeneratorPrompt' as it's not used when constructing promptParts dynamically.

// Placeholder for getProductCatalogTool has been removed.
// The flow will refer to 'getProductCatalogTool' by name.
// It's the responsibility of the execution context (e.g., API route) to ensure a tool
// with this name is available to the Genkit AI instance running the flow.

// Helper function for constructing prompt parts (centralized logic)
export function constructPromptParts(input: GenerateProductIdeasInput): any[] {
  const { productDescription, imageUrl, generatorMode } = input;
  let promptParts: any[] = [];

  if (generatorMode === 'gift') {
    promptParts.push({ text: "You are an expert gift advisor. Your goal is to provide thoughtful gift suggestions based on the user's request, and to find relevant products from our catalog using the `getProductCatalogTool`." });
    promptParts.push({ text: `\nUser's request for gift ideas: "${productDescription}"` });
    if (imageUrl) {
      promptParts.push({ text: "\nAn image was provided for additional context. Analyze it carefully (e.g., person's appearance, items, style) when performing your analysis:" });
      promptParts.push({ media: { url: imageUrl } });
    }
    promptParts.push({ text: "\n**Your Process to Generate Gift Ideas:**" });
    promptParts.push({ text: "1. **Analyze Request:** Thoroughly analyze the user's request (text and image if provided) to understand the recipient (e.g., age, gender implied), occasion, interests, and any other relevant details." });
    promptParts.push({ text: "2. **Identify Search Terms:** Based on your analysis, determine 1-3 specific product categories (e.g., 'Electronics', 'Home Decor', 'Outdoor Gear') OR 1-3 descriptive search keywords (e.g., 'cozy blanket', 'beginner drone', 'unique kitchen gadgets') that are most likely to yield good gift options from our product catalog. These should be terms suitable for a product search." });
    promptParts.push({ text: "3. **Use Catalog Tool:** Execute a search using the `getProductCatalogTool` with the one *most promising* category OR keyword phrase you identified. For example, if 'hiking' and 'coffee' are interests, you might first search for 'hiking gear' OR 'gourmet coffee'. Choose only one primary search for the tool call to start. Input parameters for the tool are `searchQuery` (string, optional keywords), `platform_category_id` (number, optional category ID - you might need to infer this ID if you only have a category name from your analysis), and `limit` (number, optional, default 5)." });
    promptParts.push({ text: "4. **Generate Suggestions:** Based on your initial analysis AND any relevant products found from the catalog (from your tool call in step 3), provide 3-5 creative and fitting gift suggestions. For each suggestion:\n    - Explain *why* it is suitable for the recipient/occasion, referencing details from the user's request or image if applicable.\n    - If a specific product was found from the catalog that fits a suggestion, mention it by name and briefly describe it as part of your suggestion. Clearly state that this product is available in our catalog.\n    - If no specific catalog products match a particular creative idea you have, still suggest the idea generally." });
    promptParts.push({ text: "5. **No Products Fallback:** If the `getProductCatalogTool` returns no relevant products or an error, still provide 3-5 creative gift ideas based purely on your analysis of the user's request. Mention that you couldn't find specific items in the catalog for these ideas at this time." });
    // Note: The explicit TOOL USAGE GUIDELINES about `useTool()` syntax is removed as the flow itself dictates tool use now.
    // The description of the tool's input parameters is now part of step 3.
  } else { // 'product' mode
    promptParts.push({ text: "You are a product innovation expert. A user will provide a description of their product idea, possibly with an image for context. Your task is to provide suggestions for improving or expanding upon this product idea. Be creative and think outside the box." });
    promptParts.push({ text: `\nUser's product idea description: "${productDescription}"` });
      if (imageUrl) {
        promptParts.push({ text: "\nThe user also provided an image related to their product idea. Analyze the image and consider its content when generating suggestions for their product idea:" });
        promptParts.push({ media: { url: imageUrl } });
        promptParts.push({ text: "\nBased on the text description AND the image, provide innovative suggestions to enhance or complement the product idea." });
      } else {
        promptParts.push({ text: "\nBased on the text description, provide innovative suggestions to enhance or complement the product idea." });
      }
    }
  }
  promptParts.push({text: "\nFormat your response clearly. If suggesting multiple ideas, use bullet points or numbered lists. Ensure your final output is just the suggestions, without repeating your analysis steps unless it's part of the explanation for a gift or product idea."});
  return promptParts;
}

// Helper function for processing LLM response (centralized logic)
export function processLlmResponse(
  llmResponse: genkit.GenerateResponse<z.infer<typeof GenerateProductIdeasOutputSchema>>,
  rawTextFromLLMFromMessage: string | undefined // Text content from llmResponse.message.content[0].text
): GenerateProductIdeasOutput {
  let output = llmResponse.output; // This is the ideal case (structured output worked)
  let rawTextFromLLM = rawTextFromLLMFromMessage;

  if (!output) { // If structured output failed, try to parse from raw text
    console.warn('[processLlmResponse] Structured output failed, attempting to parse from raw LLM text.');
    if (rawTextFromLLM && rawTextFromLLM.trim()) {
      let jsonContent = '';
      let textBeforeJson = '';
      const jsonBlockMatch = rawTextFromLLM.match(/^(.*?)(```json\s*([\s\S]*?)\s*```)(.*)$/s);

      if (jsonBlockMatch && jsonBlockMatch[3]) {
        textBeforeJson = (jsonBlockMatch[1] || '').trim();
        jsonContent = jsonBlockMatch[3].trim();
      } else {
        jsonContent = rawTextFromLLM.trim();
      }

      try {
        const potentiallyFixedJsonContent = jsonContent.replace(/\\'/g, "'");
        let parsedJson = JSON.parse(potentiallyFixedJsonContent);

        if (parsedJson && Array.isArray(parsedJson.suggestions)) {
          parsedJson.suggestions = parsedJson.suggestions.join('\n- ');
        }

        const validationResult = GenerateProductIdeasOutputSchema.safeParse(parsedJson);
        if (validationResult.success) {
          output = validationResult.data;
        } else {
          console.warn('[processLlmResponse] Parsed JSON does not match schema:', JSON.stringify(validationResult.error.errors, null, 2));
          if (parsedJson && Array.isArray(parsedJson.products)) {
            let suggestionsText = textBeforeJson || "Suggestions provided (format may vary).";
            if (typeof parsedJson.suggestions === 'string' && parsedJson.suggestions.trim()) {
              suggestionsText = (textBeforeJson ? textBeforeJson + '\n\n' : '') + parsedJson.suggestions;
            } else if (textBeforeJson === '' && !parsedJson.suggestions) {
              suggestionsText = "Please see the product recommendations below.";
            }
            try {
              const validatedProducts = parsedJson.products.map((p: any) => ProductAISchema.parse(p));
              output = { suggestions: suggestionsText.trim(), products: validatedProducts };
            } catch (productParseError) {
              output = { suggestions: suggestionsText.trim(), products: [] };
            }
          }
        }
      } catch (jsonParseError: any) {
        console.warn('[processLlmResponse] LLM response content was not valid JSON. Using raw text for suggestions. Error:', jsonParseError.message);
        // rawTextFromLLM will be used in the !output block below
      }
    }
  }

  if (!output) {
    if (rawTextFromLLM && rawTextFromLLM.trim()) {
      output = { suggestions: rawTextFromLLM, products: [] };
    } else {
      console.error('[processLlmResponse] LLM response was empty or unusable:', JSON.stringify(llmResponse, null, 2));
      output = { suggestions: 'Sorry, I encountered an issue generating ideas. Please try again.', products: [] };
    }
  }

  // Process product image_urls
  if (output && output.products && Array.isArray(output.products)) {
    output.products = output.products.map(product => {
      let currentImageUrl = product.image_url;
      if (currentImageUrl && typeof currentImageUrl === 'string') {
        if (currentImageUrl.startsWith('[') && currentImageUrl.endsWith(']')) {
          try {
            const imageUrls = JSON.parse(currentImageUrl);
            currentImageUrl = (Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'string') ? imageUrls[0] : null;
          } catch (e) { currentImageUrl = null; }
        }
        if (typeof currentImageUrl === 'string' && currentImageUrl.trim() === '') {
          currentImageUrl = null;
        }
      } else if (currentImageUrl === '') { currentImageUrl = null; }
      return { ...product, image_url: (typeof currentImageUrl === 'string' && currentImageUrl.trim() !== '') ? currentImageUrl.trim() : null };
    });
  }
  return output;
}


const generateProductIdeasFlow = ai.defineFlow(
  {
    name: 'generateProductIdeasFlow',
    inputSchema: GenerateProductIdeasInputSchema,
    outputSchema: GenerateProductIdeasOutputSchema,
  },
  async (input) => {
    console.log('[generateProductIdeasFlow] Initiated with input:', JSON.stringify(input, null, 2));

    const promptParts = constructPromptParts(input);
    let toolsToUse : any[] = [];
    // The tool name here must match the name of the tool registered with the Genkit instance running this flow
    if (input.generatorMode === 'gift') {
        toolsToUse.push(ai.tool('getProductCatalogTool') || 'getProductCatalogTool');
        // Using ai.tool() is safer if tool is an object, else string name.
        // Or, if getProductCatalogTool (the actual function/object) were imported: toolsToUse.push(getProductCatalogTool);
    }

    console.log('[generateProductIdeasFlow] Constructed prompt parts:', JSON.stringify(promptParts.filter(p => p.text), null, 2));
    if (toolsToUse.length > 0) {
        console.log('[generateProductIdeasFlow] Tools to be used by name:', toolsToUse.map(t => typeof t === 'string' ? t : t.name));
    }

    try {
      const llmResponse = await ai.generate({
        messages: [{role: 'user', content: promptParts}], // Ensure structure is {role: 'user', content: ...}
        model: gemini('gemini-1.5-flash'), // Use the gemini utility for model name
        ...(toolsToUse.length > 0 && { tools: toolsToUse }),
        config: { temperature: 0.7 },
        // No outputSchema here, will rely on processLlmResponse for parsing and validation
      });

      const usage = llmResponse.usage;
      console.log('[generateProductIdeasFlow] LLM call successful. Usage:', JSON.stringify(usage, null, 2));
      console.log('[generateProductIdeasFlow] LLM Raw Response:', JSON.stringify(llmResponse, null, 2));

      const rawTextFromMessage = llmResponse.message.content[0]?.text;
      const finalOutput = processLlmResponse(llmResponse, rawTextFromMessage);

      console.log('[generateProductIdeasFlow] Succeeded. Processed Output:', JSON.stringify(finalOutput, null, 2));
      return finalOutput;

    } catch (error) {
      console.error('[generateProductIdeasFlow] Failed with error:', error);
      throw error;
    }
  }
);
