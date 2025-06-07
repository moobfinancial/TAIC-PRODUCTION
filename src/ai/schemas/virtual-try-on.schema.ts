import { z } from 'zod';

export const VirtualTryOnInputSchema = z.object({
  userImageUrl: z.string().url().describe('Public URL of the user\'s image.'),
  productImageUrl: z.string().url().describe('Public URL of the product image.'),
  userDescription: z.string().optional().describe('Optional description of the user image (e.g., pose, key features).'),
  productDescription: z.string().optional().describe('Optional description of the product (e.g., "red t-shirt", "sunglasses").'),
  userId: z.string().optional().describe('User ID to associate the generated image with.'),
  productId: z.union([z.string(), z.number()]).optional().describe('Product ID for reference when saving the image. Can be a string or number.'),
});

export type VirtualTryOnInput = z.infer<typeof VirtualTryOnInputSchema>;

export const VirtualTryOnOutputSchema = z.object({
  generatedImageUrl: z.string().url().describe('Public URL of the generated virtual try-on image.'),
  originalGeneratedImageUrl: z.string().url().optional().describe('Original URL of the generated image before saving to user account.'),
  generatedTextPrompt: z.string().optional().describe('The detailed text prompt generated for a potential image generation model.'),
  errorMessage: z.string().optional().describe('Error or informational message about the process.'),
  saveErrorMessage: z.string().optional().describe('Error message if saving the image to user account failed.'),
});

export type VirtualTryOnOutput = z.infer<typeof VirtualTryOnOutputSchema>;
