// Using .js extension instead of .ts to avoid any TypeScript compilation issues
export const dynamic = 'force-dynamic'; // Ensures the route is not cached
export const runtime = 'nodejs'; // Use Node.js runtime instead of Edge runtime

// Comprehensive mock product catalog with proper frontend format
const mockProducts = [
  // Electronics Category
  {
    id: 'e001',
    name: 'Wireless Noise-Cancelling Headphones',
    description: 'Premium over-ear headphones with active noise cancellation and 30-hour battery life',
    price: 249.99,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    brand: 'SonicWave',
    category: 'Electronics',
    dataAiHint: 'High-quality audio equipment with noise cancellation technology'
  },
  {
    id: 'e002',
    name: 'True Wireless Earbuds',
    description: 'Compact earbuds with noise isolation and touch controls',
    price: 129.99,
    imageUrl: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb',
    brand: 'AudioTech',
    category: 'Electronics',
    dataAiHint: 'Portable audio solution with wireless connectivity'
  },
  {
    id: 'e003',
    name: 'Ultra HD Smart TV - 55"',
    description: '4K resolution with HDR and built-in streaming apps',
    price: 699.99,
    imageUrl: 'https://images.unsplash.com/photo-1593784991095-a205069470b6',
    brand: 'VisionClear',
    category: 'Electronics',
    dataAiHint: 'Home entertainment system with smart features'
  },
  {
    id: 'e004',
    name: 'Smartphone Pro Max',
    description: 'Latest model with triple camera system and all-day battery life',
    price: 999.99,
    imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd',
    brand: 'TechGiant',
    category: 'Electronics',
    dataAiHint: 'Premium mobile device with advanced camera system'
  },
  
  // Clothing Category
  {
    id: 'c001',
    name: 'Premium Cotton T-Shirt',
    description: 'Soft, breathable 100% organic cotton t-shirt',
    price: 29.99,
    imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820',
    brand: 'EcoWear',
    category: 'Clothing',
    dataAiHint: 'Sustainable fashion made from organic materials'
  },
  {
    id: 'c002',
    name: 'Slim Fit Jeans',
    description: 'Classic blue denim with stretch for comfort',
    price: 59.99,
    imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d',
    brand: 'UrbanStyle',
    category: 'Clothing',
    dataAiHint: 'Versatile denim apparel for everyday wear'
  },
  {
    id: 'c003',
    name: 'Waterproof Hiking Jacket',
    description: 'Lightweight, breathable jacket for outdoor adventures',
    price: 149.99,
    imageUrl: 'https://images.unsplash.com/photo-1547949003-9792a18a2601',
    brand: 'OutdoorPro',
    category: 'Clothing',
    dataAiHint: 'Weather-resistant outerwear for outdoor activities'
  },
  
  // Footwear Category
  {
    id: 'f001',
    name: 'Premium Running Shoes',
    description: 'Lightweight running shoes with superior cushioning and support',
    price: 129.99,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    brand: 'SportMax',
    category: 'Footwear',
    dataAiHint: 'Athletic footwear designed for running performance'
  },
  {
    id: 'f002',
    name: 'Casual Leather Sneakers',
    description: 'Versatile sneakers for everyday wear',
    price: 89.99,
    imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77',
    brand: 'UrbanStep',
    category: 'Footwear',
    dataAiHint: 'Stylish casual footwear for daily use'
  },
  {
    id: 'f003',
    name: 'Waterproof Hiking Boots',
    description: 'Durable boots with excellent traction for rough terrain',
    price: 159.99,
    imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa',
    brand: 'TrailMaster',
    category: 'Footwear',
    dataAiHint: 'Rugged footwear for hiking and outdoor exploration'
  },
  
  // Wearables Category
  {
    id: 'w001',
    name: 'Smart Fitness Watch',
    description: 'Track your workouts, heart rate, and sleep with this water-resistant fitness tracker',
    price: 199.99,
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12',
    brand: 'FitTech',
    category: 'Wearables',
    dataAiHint: 'Fitness tracking device with health monitoring features'
  },
  {
    id: 'w002',
    name: 'Health Monitor Smartwatch',
    description: 'Complete health tracking with ECG, blood oxygen, and stress monitoring',
    price: 299.99,
    imageUrl: 'https://images.unsplash.com/photo-1617043786394-f977fa12eddf',
    brand: 'HealthGuard',
    category: 'Wearables',
    dataAiHint: 'Advanced wearable device with comprehensive health metrics'
  },
  
  // Home Goods Category
  {
    id: 'h001',
    name: 'Smart Home Speaker',
    description: 'Voice-controlled speaker with premium sound quality',
    price: 129.99,
    imageUrl: 'https://images.unsplash.com/photo-1589003077984-894e133dabab',
    brand: 'EchoTech',
    category: 'Home Goods',
    dataAiHint: 'Smart home audio device with voice assistant'
  },
  {
    id: 'h002',
    name: 'Robot Vacuum Cleaner',
    description: 'Automated cleaning with smart mapping technology',
    price: 349.99,
    imageUrl: 'https://images.unsplash.com/photo-1589721212631-13efc9aabd8e',
    brand: 'CleanBot',
    category: 'Home Goods',
    dataAiHint: 'Automated cleaning solution for modern homes'
  },
  {
    id: 'h003',
    name: 'Espresso Coffee Machine',
    description: 'Barista-quality coffee at home with 15-bar pressure system',
    price: 199.99,
    imageUrl: 'https://images.unsplash.com/photo-1585232351009-aa87416fca90',
    brand: 'BrewMaster',
    category: 'Home Goods',
    dataAiHint: 'Premium coffee brewing equipment for home use'
  }
];

export async function GET(request) {
  console.log('[API Route] GET request received at /api/stream');
  
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  const userId = url.searchParams.get('userId');
  
  if (!query) {
    return new Response('Query parameter is missing', { status: 400 });
  }

  try {
    console.log(`[API Route] Processing query: ${query}`);
    
    // Generate a response based on the query - now awaiting the async function
    const responseData = await generateResponse(query);
    
    // Return as a single SSE event
    return new Response(`data: ${JSON.stringify(responseData)}\n\n`, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[API Route] Error generating response:', error);
    return new Response('Failed to generate a response.', { status: 500 });
  }
}

export async function POST(request) {
  console.log('[API Route] POST request received at /api/stream');
  
  try {
    const requestData = await request.json();
    const { query, userId } = requestData;
    
    if (!query) {
      return new Response('Query parameter is missing', { status: 400 });
    }

    try {
      console.log(`[API Route] Processing query: ${query}`);
      
      // Generate a response based on the query - now awaiting the async function
      const responseData = await generateResponse(query);
      
      // Return as a single SSE event
      return new Response(`data: ${JSON.stringify(responseData)}\n\n`, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } catch (error) {
      console.error('[API Route] Error generating response:', error);
      return new Response('Failed to generate a response.', { status: 500 });
    }
  } catch (error) {
    console.error('[API Route] Invalid JSON in POST request:', error);
    return new Response('Invalid JSON in request body.', { status: 400 });
  }
}

// Import the database utility functions
const { getProducts } = require('../utils/db');

// Helper function to get products from the database based on the query
async function generateResponse(query) {
  query = query.toLowerCase();
  let responseText = '';
  let category = null;
  let priceMin = null;
  let priceMax = null;
  
  // Parse query for category keywords
  if (query.includes('shoe') || query.includes('sneaker') || query.includes('footwear')) {
    category = 'Footwear';
    responseText = 'Here are some shoes that might interest you:';
  } 
  else if (query.includes('headphone') || query.includes('earbud') || query.includes('audio')) {
    category = 'Electronics';
    responseText = 'Check out these audio products:';
  } 
  else if (query.includes('watch') || query.includes('fitness') || query.includes('tracker')) {
    category = 'Wearables';
    responseText = 'Here are some fitness trackers that might help:';
  }
  else if (query.includes('tv') || query.includes('television') || query.includes('screen')) {
    category = 'Electronics';
    responseText = 'Here are some TVs you might like:';
  }
  else if (query.includes('phone') || query.includes('smartphone') || query.includes('mobile')) {
    category = 'Electronics';
    responseText = 'Check out these smartphones:';
  }
  else if (query.includes('clothing') || query.includes('clothes') || query.includes('shirt') || query.includes('jacket')) {
    category = 'Clothing';
    responseText = 'Here are some clothing items you might like:';
  }
  else if (query.includes('home') || query.includes('house') || query.includes('kitchen')) {
    category = 'Home Goods';
    responseText = 'Here are some home products you might enjoy:';
  }
  else {
    responseText = `Here are some products related to "${query}":`;
  }
  
  // Parse price filtering
  if (query.includes('under $')) {
    const priceMatch = query.match(/under \$(\d+)/);
    if (priceMatch && priceMatch[1]) {
      priceMax = parseInt(priceMatch[1]);
      responseText = `Here are products under $${priceMax}:`;
    }
  }
  else if (query.includes('over $')) {
    const priceMatch = query.match(/over \$(\d+)/);
    if (priceMatch && priceMatch[1]) {
      priceMin = parseInt(priceMatch[1]);
      responseText = `Here are products over $${priceMin}:`;
    }
  }
  
  try {
    // Fetch products from the database
    console.log(`[API Route] Querying database with: query=${query}, category=${category}, priceMin=${priceMin}, priceMax=${priceMax}`);
    
    const dbProducts = await getProducts({
      query: query,
      category: category,
      priceMin: priceMin,
      priceMax: priceMax,
      limit: 4 // Limit to 4 products
    });
    
    console.log(`[API Route] Database returned ${dbProducts.length} products`);
    
    // Transform database products to the format expected by the frontend
    const transformedProducts = dbProducts.map(product => {
      // Ensure the image URL is a valid string and not a JSON string
      let imageUrl = product.image_url;
      
      // If image_url is already processed by db.js, it should be a string
      // This is just an extra safeguard in case the processing in db.js didn't happen
      if (imageUrl && typeof imageUrl === 'string') {
        try {
          // Check if it's still a JSON string that needs parsing
          if (imageUrl.startsWith('[') && imageUrl.endsWith(']')) {
            const parsedUrls = JSON.parse(imageUrl);
            imageUrl = Array.isArray(parsedUrls) && parsedUrls.length > 0 ? parsedUrls[0] : '';
          }
        } catch (error) {
          // If parsing fails, keep the original value
          console.error(`Error parsing image URL for product ${product.id}:`, error);
        }
      }
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        imageUrl: imageUrl,
        category: product.category || 'Uncategorized',
        brand: product.brand || '',
        dataAiHint: 'Product from our store'
      };
    });
    
    if (transformedProducts.length === 0) {
      // If no products found in database, use fallback message
      responseText = `I couldn't find exact matches for "${query}" in our database. Please try a different search term.`;
      
      // Fall back to mock products only if absolutely necessary
      return {
        responseType: 'products',
        responseText,
        products: [], // Empty products array
        error: null,
        done: true
      };
    }
    
    const productsResponse = {
      responseType: 'products',
      responseText: responseText,
      products: transformedProducts,
      error: null,
      done: true
    };

    return productsResponse;
  } catch (error) {
    console.error('[API Route] Database error:', error);
    
    // Return error response
    return {
      responseType: 'error',
      responseText: 'Sorry, there was an error retrieving products from our database.',
      products: [],
      error: error.message,
      done: true
    };
  }
}
