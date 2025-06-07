import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET handler to fetch all product categories
export async function GET(req: NextRequest) {
  try {
    // Get query parameters for pagination
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100'); // Default to 100 for categories
    const offset = (page - 1) * limit;
    
    // Fetch categories
    const result = await pool.query(
      `SELECT id, name, description
       FROM categories
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Get total count for pagination
    const countResult = await pool.query('SELECT COUNT(*) FROM categories');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    // Format the response
    const categories = result.rows.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description
    }));
    
    return NextResponse.json({
      categories,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
