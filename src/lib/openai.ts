import axios from 'axios';
import OpenAI from 'openai';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { adminStorage } from './firebaseAdmin';

// Initialize the OpenAI client with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: false, // This should be false for server-side usage
});

// Type definitions for OpenAI image generation parameters
type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
type ImageQuality = 'standard' | 'hd';
type ImageStyle = 'vivid' | 'natural';

interface GenerateVirtualTryOnImageParams {
  userImageUrl: string;
  productImageUrl: string;
  prompt: string;
  model?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
}

/**
 * Downloads an image from a URL and returns it as a base64 string
 */
async function downloadImageAsBase64(url: string): Promise<string> {
  try {
    console.log(`[downloadImageAsBase64] Downloading image from: ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VirtualTryOnBot/1.0; +https://yourdomain.com)'
      }
    });
    const buffer = Buffer.from(response.data);
    return buffer.toString('base64');
  } catch (error: unknown) {
    console.error('[downloadImageAsBase64] Error downloading image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to download image: ${errorMessage}`);
  }
}

// Helper function to download an image from a URL and return it as a Buffer
async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  try {
    console.log(`[downloadImageAsBuffer] Downloading image from ${url} using fetch`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VirtualTryOnBot/1.0; +https://yourdomain.com)' // Ensure User-Agent is set
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '[no body]');
      console.error(`[downloadImageAsBuffer] Failed to download image (fetch): ${response.status} ${response.statusText} - ${text}`);
      throw new Error(`Failed to download image (fetch): ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: unknown) {
    console.error('[downloadImageAsBuffer] Error downloading image (fetch):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to download image (fetch): ${errorMessage}`);
  }
}

async function generateVirtualTryOnImage({
  userImageUrl,
  productImageUrl,
  prompt,
  model = 'gpt-image-1',
  size = '1024x1024',
  quality = 'hd',
  style = 'vivid',
  n = 1
}: GenerateVirtualTryOnImageParams): Promise<string> {
  console.log('[generateVirtualTryOnImage] Starting image-to-image generation with params:', {
    model,
    size,
    quality,
    style,
    n,
    promptLength: prompt.length,
    hasUserImage: !!userImageUrl,
    hasProductImage: !!productImageUrl
  });

  try {
    console.log('[generateVirtualTryOnImage] Downloading user and product images as buffers using top-level fetch-based downloadImageAsBuffer...');
    // Download only the user image as a buffer
    console.log('[generateVirtualTryOnImage] Downloading user image as buffer...');
    const userImageBuffer = await downloadImageAsBuffer(userImageUrl);
    // productImageBuffer is no longer downloaded or sent directly
    console.log('[generateVirtualTryOnImage] User image downloaded successfully');

    // Prepare multipart/form-data using form-data (Node.js compatible)
    const formData = new FormData();
    formData.append('image', userImageBuffer, { filename: 'user.png', contentType: 'image/png' });
    // 'reference_image' (productImageBuffer) is no longer sent as a separate parameter
    formData.append('model', model);
    // The prompt must now fully describe the product and how it should be placed on the user
    formData.append('prompt', prompt); // The prompt from virtualTryOnFlow should already be descriptive enough
    formData.append('n', n.toString());
    formData.append('size', size);
    // quality and style parameters are not supported by /v1/images/edits with gpt-image-1
    // if (quality) formData.append('quality', quality);
    // if (style) formData.append('style', style);

    // Send request to OpenAI /v1/images/edits endpoint
    const apiUrl = 'https://api.openai.com/v1/images/edits';
    const response = await axios.post(apiUrl, formData, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(), // Pass form-data generated headers, including Content-Type with boundary
      },
      maxBodyLength: Infinity, // Recommended for large file uploads
      maxContentLength: Infinity, // Recommended for large file uploads
    });

    if (!response.data) {
      throw new Error('No data returned from OpenAI API');
    }

    const result = response.data;
    if (!result.data || !result.data[0] || !(result.data[0].url || result.data[0].b64_json)) {
      throw new Error('No image returned from OpenAI API');
    }
    // Prefer URL, fallback to base64
    if (result.data[0].url) {
      return result.data[0].url;
    }
    if (result.data[0].b64_json) {
      return `data:image/png;base64,${result.data[0].b64_json}`;
    }
    throw new Error('Image response from OpenAI did not contain url or b64_json');
  } catch (error: any) {
    console.error('[generateVirtualTryOnImage] Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('OpenAI API error (axios):', error.response.status, error.response.data);
      throw new Error(`OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error('Error calling OpenAI API (axios):', error);
      throw new Error(`Failed to call OpenAI API: ${error.message}`);
    }
  }
}

/**
 * Saves a generated image to the user's account in Firebase Storage
 * @param imageUrl URL of the generated image
 * @param userId User ID to associate the image with
 * @param productInfo Optional product information for reference
 * @returns Promise with the saved image URL in Firebase Storage
 */
async function saveGeneratedImageToUserAccount(
  imageUrl: string,
  userId: string = 'anonymous', // Default to anonymous if no user ID provided
  productInfo?: { productId?: string; productName?: string }
): Promise<string> {
  try {
    console.log('[saveGeneratedImageToUserAccount] Saving generated image to user account', { userId });
    
    // Download the image
    const imageBuffer = await downloadImageAsBuffer(imageUrl);
    
    // Generate a unique filename
    const uniqueFilename = `${uuidv4()}.png`;
    
    // Create a folder structure that organizes virtual try-on images
    const folderPath = `user_uploads/${userId}/virtual_try_on`;
    const filePath = `${folderPath}/${uniqueFilename}`;
    
    // Get Firebase storage bucket
    const bucket = adminStorage().bucket();
    const gcsFile = bucket.file(filePath);
    
    // Save the image to Firebase Storage
    await gcsFile.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          source: 'virtual-try-on',
          timestamp: new Date().toISOString(),
          ...(productInfo && { productInfo: JSON.stringify(productInfo) })
        }
      },
      public: true, // Make the file publicly readable
    });
    
    // Construct the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log('[saveGeneratedImageToUserAccount] Image saved successfully', { publicUrl });
    return publicUrl;
  } catch (error: any) {
    console.error('[saveGeneratedImageToUserAccount] Error saving image:', error);
    throw new Error(`Failed to save generated image: ${error.message}`);
  }
}

export { openai, downloadImageAsBase64, downloadImageAsBuffer, generateVirtualTryOnImage, saveGeneratedImageToUserAccount };
