import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg'; // Added PoolClient
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Simple Admin API Key Validation (replace with a more secure method in production)
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server.");
    return false; // Or throw an error, depending on desired behavior
  }
  return apiKey === serverApiKey;
}

const UpdateCategorySchema = z.object({
  name: z.string().min(1, "Name cannot be empty.").max(255).optional(),
  description: z.string().nullable().optional(),
  parent_category_id: z.number().int().positive().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field (name, description, or parent_category_id) must be provided for an update.",
});

// Recursive function to get all descendant IDs of a category
async function getDescendantIds(client: PoolClient, categoryId: number): Promise<number[]> {
    const descendantQuery = `
        WITH RECURSIVE category_tree AS (
            SELECT id
            FROM categories
            WHERE id = $1
            UNION ALL
            SELECT c.id
            FROM categories c
            INNER JOIN category_tree ct ON ct.id = c.parent_category_id
        )
        SELECT id FROM category_tree WHERE id != $1; -- Exclude the category itself
    `;
    const res = await client.query(descendantQuery, [categoryId]);
    return res.rows.map(r => r.id);
}


export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // params is already destructured from the function parameters
  const categoryId = parseInt(params.id, 10);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validationResult = UpdateCategorySchema.safeParse(requestBody);
  if (!validationResult.success) {
    return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
  }

  const { name, description, parent_category_id } = validationResult.data;

  let client; // Declare client outside try block to use in finally

  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction for checks and update

    if (parent_category_id !== undefined) {
      if (parent_category_id === categoryId) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'A category cannot be its own parent.' }, { status: 400 });
      }
      if (parent_category_id !== null) { // Only check descendants if new parent is not null
        const descendants = await getDescendantIds(client, categoryId);
        if (descendants.includes(parent_category_id)) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Cannot set parent to one of its own descendants, creating a cycle.' }, { status: 400 });
        }
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = \$${paramIndex++}`);
      updateValues.push(name);
    }
    if (description !== undefined) { // Allows setting description to null or a new string
      updateFields.push(`description = \$${paramIndex++}`);
      updateValues.push(description);
    }
    if (parent_category_id !== undefined) { // Allows setting parent_category_id to null
      updateFields.push(`parent_category_id = \$${paramIndex++}`);
      updateValues.push(parent_category_id);
    }

    // This check is technically redundant due to Zod's .refine, but good for safety
    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(categoryId); // For the WHERE clause

    const queryString = `UPDATE categories SET ${updateFields.join(', ')} WHERE id = \$${paramIndex} RETURNING *;`;

    const result = await client.query(queryString, updateValues);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Category not found or no changes made' }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json(result.rows[0]);

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error", rbErr));
    console.error('Error updating category:', error);

    if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'categories_name_parent_key') { // Assuming such a constraint exists
             return NextResponse.json({ error: 'A category with this name already exists under the same parent.' }, { status: 409 });
        }
        if (error.constraint === 'categories_name_key') { // If name is globally unique (less common for categories with hierarchy)
             return NextResponse.json({ error: 'Category name already exists.' }, { status: 409 });
        }
         return NextResponse.json({ error: 'A unique constraint was violated.', details: error.detail }, { status: 409 });
    }
    if (error.code === '23503' && error.constraint === 'categories_parent_category_id_fkey') {
        return NextResponse.json({ error: 'Invalid parent_category_id: Parent category does not exist.' }, { status: 400 });
    }
    // Check for custom error from cycle prevention if DB raises specific error for that (e.g. from a trigger)
    // if (error.code === 'YOUR_CYCLE_ERROR_CODE') {
    //    return NextResponse.json({ error: 'Update would create a circular dependency.' }, { status: 400 });
    // }
    return NextResponse.json({ error: 'Failed to update category', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // params is already destructured from the function parameters
  const categoryId = parseInt(params.id, 10);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check 1: Child Categories
    const childCheckQuery = `SELECT id FROM categories WHERE parent_category_id = $1 LIMIT 1;`;
    let result = await client.query(childCheckQuery, [categoryId]);
    if (result && typeof result.rowCount === 'number' && result.rowCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Category has sub-categories. Please delete or re-assign them first." }, { status: 400 });
    }

    // Check 2: Product Associations (cj_products)
    const cjProductCheckQuery = `SELECT platform_product_id FROM cj_products WHERE platform_category_id = $1 LIMIT 1;`;
    result = await client.query(cjProductCheckQuery, [categoryId]);
    if (result && typeof result.rowCount === 'number' && result.rowCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Category is in use by supplier products (CJ)." }, { status: 400 });
    }

    // Check 3: Product Associations (merchant_products)
    const merchantProductCheckQuery = `SELECT id FROM merchant_products WHERE category_id = $1 LIMIT 1;`;
    // Ensure merchant_products table exists before querying or this will throw an error if it doesn't
    // For now, assuming it exists as per subtask instructions.
    try {
        result = await client.query(merchantProductCheckQuery, [categoryId]);
        if (result && typeof result.rowCount === 'number' && result.rowCount > 0) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: "Category is in use by merchant products." }, { status: 400 });
        }
    } catch (tableError: any) {
        if (tableError.code === '42P01') { // undefined_table
            console.warn("merchant_products table not found, skipping check. If this table is expected, this is an issue.");
        } else {
            throw tableError; // Re-throw other errors
        }
    }


    // Perform Delete
    const deleteQuery = `DELETE FROM categories WHERE id = $1 RETURNING id;`;
    result = await client.query(deleteQuery, [categoryId]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: "Category deleted successfully." });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error on delete:", rbErr));
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
