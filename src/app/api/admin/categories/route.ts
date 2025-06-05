import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';

// Database connection pool
// Ensure your environment variables for DB connection are set
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
                    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Zod schema for creating/updating a category
const CategoryInputSchema = z.object({
  name: z.string().min(1, { message: "Category name is required." }).max(255),
  description: z.string().optional().nullable(),
  parent_category_id: z.number().int().positive().optional().nullable(), // Assuming ID is integer
});

interface Category {
  id: number;
  name: string;
  description: string | null;
  parent_category_id: number | null;
  children?: Category[]; // For hierarchical structure
  created_at?: Date;
  updated_at?: Date;
}

// Helper function to build category tree
const buildCategoryTree = (categories: Category[], parentId: number | null = null): Category[] => {
  return categories
    .filter(category => category.parent_category_id === parentId)
    .map(category => ({
      ...category,
      children: buildCategoryTree(categories, category.id),
    }));
};

// GET Handler: Fetch categories
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const hierarchical = searchParams.get('hierarchical') === 'true';
  const adminApiKey = request.headers.get('x-admin-api-key');
  let client;

  console.log('[API GET /admin/categories] Received request. Hierarchical:', hierarchical);

  // Verify admin API key
  if (!adminApiKey || adminApiKey !== process.env.ADMIN_API_KEY) {
    console.error('[API GET /admin/categories] Unauthorized: Invalid or missing API key');
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    );
  }

  try {
    client = await pool.connect();
    console.log('[API GET /admin/categories] Database client connected.');
    
    const { rows } = await client.query(
      'SELECT id, name, description, parent_category_id, created_at, updated_at FROM categories ORDER BY name ASC'
    );
    console.log(`[API GET /admin/categories] Fetched ${rows.length} categories from DB.`);
    
    // Ensure we always return an array, even if empty
    const categories = Array.isArray(rows) ? rows : [];
    
    // Log the first few categories for debugging
    if (categories.length > 0) {
      console.log('[API GET /admin/categories] Sample categories:', 
        categories.slice(0, 3).map(r => ({ id: r.id, name: r.name }))
      );
    } else {
      console.log('[API GET /admin/categories] No categories found in the database');
    }

    if (hierarchical) {
      console.log('[API GET /admin/categories] Building hierarchical category tree.');
      const hierarchicalCategories = buildCategoryTree(categories);
      console.log('[API GET /admin/categories] Built category tree with', 
        hierarchicalCategories.length, 'root categories.');
      return NextResponse.json(hierarchicalCategories);
    }
    
    console.log('[API GET /admin/categories] Returning flat categories list.');
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('[API GET /admin/categories] Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('[API GET /admin/categories] Database client released.');
    }
  }
}

// POST Handler: Create a new category
export async function POST(request: NextRequest) {
  let client;
  console.log('[API POST /admin/categories] Received request.');
  try {
    const body = await request.json();
    console.log('[API POST /admin/categories] Request body:', body);
    const validationResult = CategoryInputSchema.safeParse(body);

    if (!validationResult.success) {
      console.warn('[API POST /admin/categories] Invalid input:', validationResult.error.flatten());
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { name, description, parent_category_id } = validationResult.data;
    console.log('[API POST /admin/categories] Validated data:', { name, description, parent_category_id });

    client = await pool.connect();
    console.log('[API POST /admin/categories] Database client connected.');

    // Check if parent_category_id exists if provided
    if (parent_category_id !== null && parent_category_id !== undefined) {
      console.log(`[API POST /admin/categories] Checking for parent category ID: ${parent_category_id}`);
      const parentCheck = await client.query('SELECT id FROM categories WHERE id = $1', [parent_category_id]);
      if (parentCheck.rows.length === 0) {
        console.warn(`[API POST /admin/categories] Parent category ID ${parent_category_id} not found.`);
        return NextResponse.json({ error: 'Invalid parent_category_id: Parent category does not exist.' }, { status: 400 });
      }
      console.log(`[API POST /admin/categories] Parent category ID ${parent_category_id} found.`);
    }

    const { rows } = await client.query(
      'INSERT INTO categories (name, description, parent_category_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, parent_category_id === undefined ? null : parent_category_id] // Ensure undefined parent_id is stored as null
    );
    console.log('[API POST /admin/categories] Category created:', rows[0]);

    return NextResponse.json(rows[0], { status: 201 });

  } catch (error: any) {
    console.error('[API POST /admin/categories] Error creating category:', error);
    if (error.code === '23505') { // Unique violation (e.g., category name)
      console.warn('[API POST /admin/categories] Unique constraint violation:', error.detail);
      return NextResponse.json({ error: 'Category name already exists.', details: error.detail }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create category', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('[API POST /admin/categories] Database client released.');
    }
  }
}
