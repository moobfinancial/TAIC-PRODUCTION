import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';

// Initialize a connection pool.
// Ensure your environment variables for DB connection are set:
// PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || // Standard Vercel variable
                    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  // Add SSL configuration if required for your DB, especially in production
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Define a Zod schema for product data (consistent with ProductAISchema in Genkit flow)
// This will be the output structure for each product from the combined list.
const ProductOutputSchema = z.object({
  id: z.string(), // Original product ID or platform_product_id from cj_products
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  image_url: z.string().nullable().optional(),
  platform_category_id: z.number().int().positive().nullable().optional(), // Unified category ID
  category_name: z.string().nullable().optional(), // Category name for display
  data_ai_hint: z.string().nullable().optional(),
  source: z.enum(['MANUAL', 'CJ']), // To indicate the origin of the product
});
export type ProductOutput = z.infer<typeof ProductOutputSchema>;

// Schema for query parameters - updated to use platform_category_id
const FilterSchema = z.object({
  searchQuery: z.string().optional(),
  platform_category_id: z.coerce.number().int().positive().optional(), // Use unified category ID for filtering
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
  // sortBy: z.string().optional().default('name'), // Example: name, price
  // sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export async function GET(request: NextRequest) {
  let client; // Declare client here to be accessible in finally block
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = FilterSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { searchQuery, platform_category_id, minPrice, maxPrice, limit, offset } = validationResult.data;

    // --- Logic for 'products' table (MANUAL source) ---
    let products1Query = `
      SELECT
        p.id::TEXT, p.name, p.description, p.price, p.image_url,
        c.id as platform_category_id, c.name as category_name,
        p.data_ai_hint, 'MANUAL' as source
      FROM products p
      LEFT JOIN categories c ON p.category ILIKE c.name
    `; // Using ILIKE for case-insensitive match, assuming p.category stores name
    const conditions1: string[] = [
      "p.is_active = true",
      "p.approval_status = 'approved'"
    ];
    const values1: any[] = [];
    let paramIndex1 = 1; // Start param index at 1 for the first query

    if (searchQuery) {
      conditions1.push(`(p.name ILIKE $${paramIndex1} OR p.description ILIKE $${paramIndex1} OR p.category ILIKE $${paramIndex1})`);
      values1.push(`%${searchQuery}%`);
      paramIndex1++;
    }
    if (platform_category_id) {
      conditions1.push(`c.id = $${paramIndex1}`);
      values1.push(platform_category_id);
      paramIndex1++;
    }
    if (minPrice !== undefined) {
      conditions1.push(`p.price >= $${paramIndex1}`);
      values1.push(minPrice);
      paramIndex1++;
    }
    if (maxPrice !== undefined) {
      conditions1.push(`p.price <= $${paramIndex1}`);
      values1.push(maxPrice);
      paramIndex1++;
    }
    // Apply base status filters and any additional dynamic filters for products1Query
    if (conditions1.length > 0) {
      products1Query += ' WHERE ' + conditions1.join(' AND ');
    }

    // --- Logic for 'cj_products' table (CJ source) ---
    let products2Query = `
      SELECT
        cp.platform_product_id::TEXT as id, cp.display_name as name, cp.display_description as description,
        cp.selling_price as price, cp.image_url, cp.platform_category_id,
        c.name as category_name,
        NULL as data_ai_hint, 'CJ' as source
      FROM cj_products cp
      JOIN categories c ON cp.platform_category_id = c.id
      WHERE cp.is_active = true AND cp.approval_status = 'approved'
    `;
    const conditions2: string[] = [];
    const values2: any[] = [];
    let paramIndex2 = 1;

    if (searchQuery) {
      conditions2.push(`(cp.display_name ILIKE $${paramIndex2} OR cp.display_description ILIKE $${paramIndex2})`);
      values2.push(`%${searchQuery}%`);
      paramIndex2++;
    }
    if (platform_category_id) {
      conditions2.push(`cp.platform_category_id = $${paramIndex2}`);
      values2.push(platform_category_id);
      paramIndex2++;
    }
    if (minPrice !== undefined) {
      conditions2.push(`cp.selling_price >= $${paramIndex2}`);
      values2.push(minPrice);
      paramIndex2++;
    }
    if (maxPrice !== undefined) {
      conditions2.push(`cp.selling_price <= $${paramIndex2}`);
      values2.push(maxPrice);
      paramIndex2++;
    }
    if (conditions2.length > 0) {
      products2Query += ' AND ' + conditions2.join(' AND ');
    }

    // --- Combine queries ---
    // Adjust parameter placeholders in the subqueries before combining
    const finalProducts1Query = products1Query.replace(/\$\d+/g, (match) => `$${parseInt(match.substring(1), 10)}`);
    const finalProducts2Query = products2Query.replace(/\$\d+/g, (match) => `$${parseInt(match.substring(1), 10) + (paramIndex1 - 1)}`);

    const combinedQuery = `
      SELECT * FROM (
        ${finalProducts1Query}
        UNION ALL
        ${finalProducts2Query}
      ) AS combined_products
      ORDER BY name ASC
      LIMIT $${paramIndex1 + paramIndex2 - 2 + 1} OFFSET $${paramIndex1 + paramIndex2 - 2 + 2}
    `;
    const combinedValues = [...values1, ...values2, limit, offset];

    // --- Count Queries (for pagination) ---
    // Base count query for 'products' table with essential status filters
    let count1Query = `SELECT COUNT(*) AS count FROM products p LEFT JOIN categories c ON p.category ILIKE c.name`;
    // Construct the WHERE clause for count1Query using the same conditions as products1Query
    // but only the ones that don't rely on values already incorporated into conditions1 for base status.
    // The values1 array will be used for parameter binding.
    const count1Conditions = [...conditions1]; // Create a copy to potentially modify for count if needed, though here it's the same
    if (count1Conditions.length > 0) {
      count1Query += ' WHERE ' + count1Conditions.join(' AND ');
    }

    let count2Query = `SELECT COUNT(*) AS count FROM cj_products cp JOIN categories c ON cp.platform_category_id = c.id WHERE cp.is_active = true AND cp.approval_status = 'approved'`;
    if (conditions2.length > 0) count2Query += ' AND ' + conditions2.join(' AND ');

    client = await pool.connect();
    try {
      const dataResult = await client.query(combinedQuery, combinedValues);
      const count1Result = await client.query(count1Query, values1); // Use values1 for count1
      const count2Result = await client.query(count2Query, values2); // Use values2 for count2

      const totalCount = parseInt(count1Result.rows[0].count, 10) + parseInt(count2Result.rows[0].count, 10);

      const products: ProductOutput[] = dataResult.rows.map(row => ({
        id: String(row.id), // Ensure ID is string
        name: row.name,
        description: row.description || null,
        price: parseFloat(row.price),
        image_url: row.image_url || null,
        platform_category_id: row.platform_category_id ? parseInt(row.platform_category_id, 10) : null,
        category_name: row.category_name || null,
        data_ai_hint: row.data_ai_hint || null,
        source: row.source as 'MANUAL' | 'CJ',
      }));

      return NextResponse.json({
        data: products,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } finally {
      if (client) client.release();
    }
  } catch (error: any) {
    console.error('[API GET /api/products] Error fetching combined products:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
