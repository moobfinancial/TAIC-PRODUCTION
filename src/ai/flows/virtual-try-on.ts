'use server';

import { openai, generateVirtualTryOnImage, saveGeneratedImageToUserAccount } from '@/lib/openai';
import { 
  VirtualTryOnInput, 
  VirtualTryOnInputSchema, 
  VirtualTryOnOutput, 
  VirtualTryOnOutputSchema 
} from '@/ai/schemas/virtual-try-on.schema';

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.');
}

/**
 * Virtual try-on flow that uses OpenAI's API to create
 * a realistic image of a user wearing/using a product.
 */
const virtualTryOnFlow = async (input: VirtualTryOnInput): Promise<VirtualTryOnOutput> => {
  // Initialize variables at the function scope
  let generationPrompt: string;
  let generatedImageUrl: string;
  
  console.log('[virtualTryOnFlow] Initiated with input:', JSON.stringify({
    ...input,
    userImageUrl: input.userImageUrl ? `${input.userImageUrl.substring(0, 50)}...` : 'missing',
    productImageUrl: input.productImageUrl ? `${input.productImageUrl.substring(0, 50)}...` : 'missing',
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    nodeEnv: process.env.NODE_ENV
  }, null, 2));
  
  // Verify required environment variables
  if (!process.env.OPENAI_API_KEY) {
    const errorMsg = 'OPENAI_API_KEY is not set in environment variables';
    console.error('[virtualTryOnFlow] Configuration error:', errorMsg);
    throw new Error('Server configuration error. Please contact support.');
  }

  const { userImageUrl, productImageUrl, userDescription, productDescription } = input;
  
  // Validate URLs
  if (!userImageUrl || !productImageUrl) {
    const errorMsg = `Missing required image URLs. User: ${!!userImageUrl}, Product: ${!!productImageUrl}`;
    console.error('[virtualTryOnFlow] Validation error:', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Generate a detailed prompt using GPT-4o
    // This prompt will be used for true image-to-image composition via OpenAI's /v1/images/edits endpoint (gpt-image-1)
    console.log('[virtualTryOnFlow] Generating prompt using GPT-4o...');
    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert prompt engineer for an advanced image editing AI.\nYour task is to generate a concise and highly descriptive text prompt.\nThis prompt will be given to an image editing AI that has ALREADY received an image of a user.\nThe prompt you generate MUST instruct the image editing AI to ADD a specific product (which will be described to you) onto the user in their existing image.\nThe image editing AI will NOT receive a separate product image, so your prompt is the ONLY source of information about the product\'s appearance and how it should be worn.\nVERY IMPORTANT: The prompt MUST explicitly instruct the AI to PRESERVE the user\'s face and facial features EXACTLY as they appear in the original image. The user\'s identity must remain unchanged.\nFocus on visual details of the product and its integration.\nOutput ONLY the prompt itself, with no additional commentary or explanation.'
        },
        {
          role: 'user',
          content: `Generate a detailed prompt for an image editing AI.\nThe AI has already received an image of a user, described as: ${userDescription || 'A person'}.\nYour prompt needs to instruct the AI to add the following product onto that user:\nProduct details: ${productDescription || 'A product'}.\nDesired outcome: A photorealistic image where the user from their original image is now realistically wearing or using the described product.\nVERY IMPORTANT: Explicitly instruct the AI to preserve the user's face and facial features EXACTLY as they appear in the original image. The user's identity, facial structure, and expressions must remain completely unchanged.\nBe very specific about the product\'s appearance (e.g., color, material, style, shape, any text or logos if mentioned in product details) and how it should fit or be positioned on the user.\nDescribe how the product should interact with the user\'s existing clothing, hair, or pose in their image.\nEnsure the lighting and shadows on the added product match the original user image.\nThe final image should look like a single, cohesive photograph.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    generationPrompt = promptResponse.choices[0]?.message?.content?.trim() || 
      `A photorealistic image of a person wearing/using the product naturally. The person should be in a neutral pose with good lighting.`;
    
    console.log('[virtualTryOnFlow] Generated prompt:', generationPrompt);

    console.log('[virtualTryOnFlow] Generated image generation prompt:', generationPrompt);

    // Generate the virtual try-on image using OpenAI's /v1/images/edits endpoint (gpt-image-1)
    // Both user and product images are uploaded for true image-to-image composition
    console.log('[virtualTryOnFlow] Generating virtual try-on image using OpenAI\'s /v1/images/edits endpoint (gpt-image-1)');
    console.log('[virtualTryOnFlow] Both user and product images are uploaded for true image-to-image composition');
    generatedImageUrl = await generateVirtualTryOnImage({
      userImageUrl,
      // productImageUrl is no longer passed as it's not used by generateVirtualTryOnImage
      prompt: generationPrompt,
      model: 'gpt-image-1',
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
      n: 1
    });

    console.log('[virtualTryOnFlow] Successfully generated virtual try-on image');
    
    // Save the generated image to the user's account
    // Extract userId from input or use anonymous
    const userId = input.userId || 'anonymous';
    
    try {
      // Save the image to Firebase Storage with product info
      const savedImageUrl = await saveGeneratedImageToUserAccount(
        generatedImageUrl,
        userId,
        {
          productId: input.productId,
          productName: productDescription?.substring(0, 100) // Truncate long descriptions
        }
      );
      
      console.log('[virtualTryOnFlow] Saved generated image to user account:', savedImageUrl);
      
      // Return the saved image URL instead of the original generated URL
      return {
        generatedImageUrl: savedImageUrl, // Use the saved image URL
        originalGeneratedImageUrl: generatedImageUrl, // Keep the original URL for reference
        generatedTextPrompt: generationPrompt,
      };
    } catch (saveError: any) {
      // If saving fails, still return the original generated image
      console.error('[virtualTryOnFlow] Error saving image to user account:', saveError);
      return {
        generatedImageUrl, // Return the original generated image URL
        generatedTextPrompt: generationPrompt,
        saveErrorMessage: `Failed to save image to account: ${saveError.message}`,
      };
    }
  } catch (error: any) {
    console.error('[virtualTryOnFlow] Error during virtual try-on:', error);
    return {
      generatedImageUrl: userImageUrl, // Fallback to original image
      generatedTextPrompt: undefined,
      errorMessage: `Failed to generate virtual try-on: ${error.message || 'Unknown error'}`,
    };
  }
};

// Main function to be called from API
async function virtualTryOn(input: VirtualTryOnInput): Promise<VirtualTryOnOutput> {
  try {
    console.log('[virtualTryOn] Starting virtual try-on process');
    const result = await virtualTryOnFlow(input);
    console.log('[virtualTryOn] Completed virtual try-on process');
    return result;
  } catch (error: any) {
    console.error('[virtualTryOn] Error in virtualTryOn:', error);
    return {
      generatedImageUrl: input.userImageUrl,
      generatedTextPrompt: undefined,
      errorMessage: `Failed to execute virtual try-on: ${error.message || 'Unknown error'}`,
    };
  }
}

export { virtualTryOnFlow, virtualTryOn };
