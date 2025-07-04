// src/ai/tools/get-products-new.ts
import { ProductAISchema, type ProductForAI } from '@/ai/schemas/shopping-assistant-schemas-new';

// Define the input type for the tool
type GetProductsToolInput = {
  query?: string;
  // category?: string;
  // brand?: string;
  // maxResults?: number;
};

/**
 * Fetches a list of available products from the catalog based on a search query or filters.
 * Use this to find products for recommendations or to answer user questions about product availability.
 */
export async function getProducts(input: GetProductsToolInput): Promise<ProductForAI[]> {
  console.log('[getProducts] Called with input:', JSON.stringify(input, null, 2));

  // Construct the query parameters for the API call
  const queryParams = new URLSearchParams();
  if (input.query) {
    queryParams.append('search', input.query);
  }
  // if (input.category) {
  //   queryParams.append('category', input.category);
  // }
  // if (input.brand) {
  //   queryParams.append('brand', input.brand);
  // }
  // if (input.maxResults) {
  //   queryParams.append('limit', input.maxResults.toString());
  // }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const apiUrl = `${appUrl}/api/products?${queryParams.toString()}`;

  console.log(`[getProducts] Fetching products from: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getProducts] API request failed with status ${response.status}: ${errorText}`);
      // For the AI, it's often better to return an empty list or a specific error structure it can understand
      // rather than throwing an error that halts the flow abruptly, unless the schema allows for error objects.
      // Since output schema is z.array(ProductAISchema), we return empty array for errors.
      return []; 
    }

    const productsData: any[] = await response.json(); 
    console.log('[getProducts] Received productsData:', JSON.stringify(productsData.slice(0, 2), null, 2)); // Log first 2 products

    // Validate and transform the products data if necessary
    // Assuming the /api/products endpoint returns data that might need mapping to ProductAISchema
    // For now, let's assume it returns an array of objects that are compatible or need validation.
    const validatedProducts: ProductForAI[] = [];
    for (const product of productsData) {
      // Map fields if necessary (e.g., snake_case from DB to camelCase for AI)
      const mappedProduct = {
        id: product.id?.toString(), // Ensure ID is a string
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price, // Ensure price is number
        currency: product.currency || 'USD',
        sku: product.sku,
        imageUrl: product.image_url || product.imageUrl, // Handle potential snake_case
        productUrl: product.product_url || product.productUrl,
        attributes: product.attributes || [],
        inventory: product.inventory || { stockQuantity: 0, availability: 'out of stock' },
        dataAiHint: product.dataAiHint || `Product: ${product.name}, Category: ${product.category}, Brand: ${product.brand}`
      };

      const validation = ProductAISchema.safeParse(mappedProduct);
      if (validation.success) {
        validatedProducts.push(validation.data);
      } else {
        console.warn(`[getProducts] Product ID ${product.id} failed validation:`, validation.error.flatten());
      }
    }
    
    console.log(`[getProducts] Returning ${validatedProducts.length} validated products.`);
    return validatedProducts;

  } catch (error: any) {
    console.error('[getProducts] CRITICAL_ERROR fetching or processing products:', error.message, error.stack);
    // Return empty array in case of any unexpected errors during fetch/processing
    return [];
  }
}
