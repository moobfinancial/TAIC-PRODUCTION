import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();

    // Get the product details
    const query = `
      SELECT 
        cp.platform_product_id as id,
        cp.display_name as name,
        cp.display_description as description,
        cp.original_name as original_name,
        cp.original_description as original_description,
        cp.selling_price as price,
        cp.cj_base_price as base_price,
        cp.image_url as image_urls,
        cp.additional_image_urls_json as additional_images,
        cp.variants_json as variants,
        cp.cashback_percentage as cashback_percentage,
        c.name as category,
        cp.is_active
      FROM cj_products cp
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.platform_product_id = $1 AND cp.is_active = true
    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = result.rows[0];

    // Handle image URLs
    let imageUrls: string[] = [];
    let additionalImages: string[] = [];
    let variants: any[] = [];
    
    try {
      // Handle main image URL
      if (product.image_urls) {
        if (typeof product.image_urls === 'string') {
          if (product.image_urls.startsWith('http')) {
            imageUrls = [product.image_urls];
          } else if (product.image_urls.startsWith('[') || product.image_urls.startsWith('{')) {
            const parsedImages = JSON.parse(product.image_urls);
            if (Array.isArray(parsedImages)) {
              imageUrls = parsedImages.filter(url => typeof url === 'string' && url.startsWith('http'));
            } else if (typeof parsedImages === 'object' && parsedImages !== null) {
              const urls = Object.values(parsedImages).filter(url => 
                typeof url === 'string' && url.startsWith('http')
              );
              if (urls.length > 0) {
                imageUrls = urls;
              }
            }
          }
        }
      }
      
      // Handle additional images
      if (product.additional_images) {
        const parsed = typeof product.additional_images === 'string' ? 
          JSON.parse(product.additional_images) : product.additional_images;
          
        if (Array.isArray(parsed)) {
          additionalImages = parsed.filter(url => 
            typeof url === 'string' && url.startsWith('http')
          );
        }
      }

      // Handle variants
      if (product.variants) {
        const parsedVariants = typeof product.variants === 'string' ?
          JSON.parse(product.variants) : product.variants;
          
        if (Array.isArray(parsedVariants)) {
          variants = parsedVariants;
        }
      }
    } catch (e) {
      console.error('Error parsing JSON fields:', e);
    }

    // Clean product name to remove "Imported from CJ" prefix
    let cleanName = product.name;
    if (cleanName.includes('Imported from CJ:')) {
      cleanName = cleanName.replace('Imported from CJ:', '').trim();
    }
    
    // Format the product for frontend consumption
    const formattedProduct = {
      id: product.id,
      name: cleanName,
      description: product.description || '',
      price: parseFloat(product.price),
      base_price: product.base_price ? parseFloat(product.base_price) : null,
      imageUrl: imageUrls[0] || '',  // Add single imageUrl for compatibility
      imageUrls: imageUrls,
      additionalImages: additionalImages,
      variants: variants,
      category: product.category || 'Uncategorized',
      cashbackPercentage: parseFloat(product.cashback_percentage) || 0,
    };

    return NextResponse.json({ product: formattedProduct });
  } catch (error) {
    console.error('Error fetching product details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
