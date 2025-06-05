import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { validateAdminApiKey } from '../../../../../lib/adminAuth';

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
  // Check admin API key
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = (page - 1) * limit;

  let client;
  try {
    client = await pool.connect();

    // Get total count of imported products
    const countQuery = 'SELECT COUNT(*) FROM cj_products';
    const countResult = await client.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated list of imported products
    const query = `
      SELECT 
        platform_product_id as id,
        cj_product_id,
        display_name,
        display_description,
        platform_category_id,
        selling_price,
        cj_base_price,
        image_url,
        is_active,
        created_at,
        updated_at
      FROM cj_products
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await client.query(query, [limit, offset]);

    return NextResponse.json({
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching imported products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch imported products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
