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

const GenerateProductIdeasOutputSchema = z.object({
  suggestions: z
    .string()
    .describe('Suggestions for improving the product idea, based on the provided description.'),
});
export type GenerateProductIdeasOutput = z.infer<typeof GenerateProductIdeasOutputSchema>;

export async function generateProductIdeas(input: GenerateProductIdeasInput): Promise<GenerateProductIdeasOutput> {
  return generateProductIdeasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productIdeaGeneratorPrompt',
  input: {schema: GenerateProductIdeasInputSchema},
  output: {schema: GenerateProductIdeasOutputSchema},
  // The prompt template itself is now dynamic based on input.
  // This will be handled directly in the flow using ai.generate() with constructed parts.
  // So, removing the static 'prompt' field here.
  // prompt: `...`,
});

const generateProductIdeasFlow = ai.defineFlow(
  {
    name: 'generateProductIdeasFlow',
    inputSchema: GenerateProductIdeasInputSchema,
    outputSchema: GenerateProductIdeasOutputSchema,
  },
  async (input) => {
    console.log('[generateProductIdeasFlow] Initiated with input:', JSON.stringify(input, null, 2));

    const { productDescription, imageUrl, generatorMode } = input;

    let promptParts: any[] = [];

    if (generatorMode === 'gift') {
      promptParts.push({ text: "You are an expert gift advisor. A user will provide a description of a recipient, occasion, or context, possibly with an image. Your task is to suggest thoughtful and relevant gift ideas." });
      promptParts.push({ text: `\nUser's request for gift ideas: "${productDescription}"` });
      if (imageUrl) {
        promptParts.push({ text: "\nThe user also provided an image for additional context. Analyze the image and consider its content (e.g., person's appearance, items in a room, style) when suggesting gifts:" });
        promptParts.push({ media: { url: imageUrl } });
        promptParts.push({ text: "\nBased on the text description AND the image, provide creative and fitting gift suggestions. Explain why each suggestion is suitable." });
      } else {
        promptParts.push({ text: "\nBased on the text description, provide creative and fitting gift suggestions. Explain why each suggestion is suitable." });
      }
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

    promptParts.push({text: "\nFormat your response clearly. If suggesting multiple ideas, use bullet points or numbered lists."});


    console.log('[generateProductIdeasFlow] Constructed prompt parts:', JSON.stringify(promptParts.filter(p => p.text), null, 2)); // Log text parts for brevity

    try {
      // Using ai.generate with the correct format
      const llmResponse = await ai.generate({
        messages: promptParts,
        model: 'gemini-2.0-flash', // Default model for product idea generation
        config: { temperature: 0.7 }, // Adjust temperature as needed
        output: { schema: GenerateProductIdeasOutputSchema } // Ensure output is structured
      });

      const output = llmResponse.output; // This should be structured per GenerateProductIdeasOutputSchema
      const usage = llmResponse.usage;

      console.log('[generateProductIdeasFlow] LLM call successful. Usage:', JSON.stringify(usage, null, 2));

      if (!output) {
        console.error('[generateProductIdeasFlow] Failed: Output from LLM was null or undefined after structured output attempt.');
        throw new Error('Failed to generate ideas: No structured output from AI model.');
      }

      console.log('[generateProductIdeasFlow] Succeeded. Output:', JSON.stringify(output, null, 2));
      return output;

    } catch (error) {
      console.error('[generateProductIdeasFlow] Failed with error:', error);
      throw error; // Re-throw to be handled by caller or Genkit's error handling
    }
  }
);
