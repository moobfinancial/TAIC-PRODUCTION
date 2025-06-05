import { z } from 'zod';

export const VirtualTryOnInputSchema = z.object({
  userImageUrl: z.string().url().describe('Public URL of the user\'s image.'),
  productImageUrl: z.string().url().describe('Public URL of the product image.'),
  userDescription: z.string().optional().describe('Optional description of the user image (e.g., pose, key features).'),
  productDescription: z.string().optional().describe('Optional description of the product (e.g., "red t-shirt", "sunglasses").'),
});

export type VirtualTryOnInput = z.infer<typeof VirtualTryOnInputSchema>;

export const VirtualTryOnOutputSchema = z.object({
  generatedImageUrl: z.string().url().describe('Public URL of the generated virtual try-on image (currently a placeholder).'),
  generatedTextPrompt: z.string().optional().describe('The detailed text prompt generated for a potential image generation model.'),
  errorMessage: z.string().optional().describe('Error or informational message about the process.'),
});

export type VirtualTryOnOutput = z.infer<typeof VirtualTryOnOutputSchema>;
