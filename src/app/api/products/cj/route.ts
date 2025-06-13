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

export async function GET(request: NextRequest) {
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '12', 10);
  const offset = (page - 1) * limit;
  const category = searchParams.get('category');
  const searchTerm = searchParams.get('search');
  const sortBy = searchParams.get('sort') || 'newest'; // newest, price_asc, price_desc, name_asc, name_desc

  let client;
  try {
    client = await pool.connect();

    // Build the query with filters
    let query = `
      SELECT 
        cp.platform_product_id as id,
        cp.display_name as name,
        cp.display_description as description,
        cp.selling_price as price,
        cp.cj_base_price as base_price,
        cp.image_url as image_urls,
        cp.additional_image_urls_json as additional_images,
        cp.cashback_percentage as cashback_percentage,
        c.name as category,
        cp.is_active
      FROM cj_products cp
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.is_active = true AND cp.approval_status = 'approved'
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add search filter if provided
    if (searchTerm) {
      query += ` AND (cp.display_name ILIKE $${paramIndex} OR cp.display_description ILIKE $${paramIndex})`;
      queryParams.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Add category filter if provided
    if (category && category !== 'all') {
      query += ` AND c.name = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    // Add sorting
    switch (sortBy) {
      case 'price_asc':
        query += ' ORDER BY cp.selling_price ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY cp.selling_price DESC';
        break;
      case 'name_asc':
        query += ' ORDER BY cp.display_name ASC';
        break;
      case 'name_desc':
        query += ' ORDER BY cp.display_name DESC';
        break;
      case 'newest':
      default:
        query += ' ORDER BY cp.created_at DESC';
        break;
    }

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) 
      FROM cj_products cp
      LEFT JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.is_active = true AND cp.approval_status = 'approved'
    `;

    // Add the same filters to count query
    let countParams: any[] = [];
    let countParamIndex = 1;

    if (searchTerm) {
      countQuery += ` AND (cp.display_name ILIKE $${countParamIndex} OR cp.display_description ILIKE $${countParamIndex})`;
      countParams.push(`%${searchTerm}%`);
      countParamIndex++;
    }

    if (category && category !== 'all') {
      countQuery += ` AND c.name = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }

    // Execute count query
    const countResult = await client.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Execute main query
    const result = await client.query(query, queryParams);

    // Process the results to format them correctly for the frontend
    const products = result.rows.map(product => {
      // Handle image URLs
      let imageUrl = typeof product.image_urls === 'string' ? 
        (product.image_urls.startsWith('http') ? product.image_urls : '') : '';
      
      let additionalImages: string[] = [];
      
      // If image_urls is a JSON string, try to parse it
      if (typeof product.image_urls === 'string' && 
          (product.image_urls.startsWith('[') || product.image_urls.startsWith('{'))) {
        try {
          const parsedImages = JSON.parse(product.image_urls);
          if (Array.isArray(parsedImages) && parsedImages.length > 0) {
            imageUrl = parsedImages[0].startsWith('http') ? parsedImages[0] : '';
          } else if (typeof parsedImages === 'object' && parsedImages !== null) {
            // Handle case where it's an object with image URLs
            const urls = Object.values(parsedImages)
              .filter((url): url is string => 
                typeof url === 'string' && url.startsWith('http')
              );
            if (urls.length > 0) {
              imageUrl = urls[0];
              additionalImages = urls.slice(1);
            }
          }
        } catch (e) {
          console.error('Error parsing image_urls:', e);
        }
      }
      
      // Handle additional images
      if (product.additional_images) {
        try {
          const parsed = typeof product.additional_images === 'string' ? 
            JSON.parse(product.additional_images) : product.additional_images;
            
          if (Array.isArray(parsed)) {
            additionalImages = parsed.filter((url: string) => 
              typeof url === 'string' && url.startsWith('http')
            );
          }
        } catch (e) {
          console.error('Error parsing additional_images:', e);
        }
      }

      // Clean product name to remove "Imported from CJ" prefix
      let cleanName = product.name;
      if (cleanName.includes('Imported from CJ:')) {
        cleanName = cleanName.replace('Imported from CJ:', '').trim();
      }
      
      // Format the product for frontend consumption
      return {
        id: product.id,
        name: cleanName,
        description: product.description || '',
        price: parseFloat(product.price),
        base_price: product.base_price ? parseFloat(product.base_price) : null,
        imageUrl: imageUrl,
        additionalImages: additionalImages,
        category: product.category || 'Uncategorized',
        // Convert from decimal to percentage (e.g., 0.05 -> 5)
        cashbackPercentage: (parseFloat(product.cashback_percentage) * 100) || 0,
        // Add any other fields needed by the frontend
      };
    });

    return NextResponse.json({
      products,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
