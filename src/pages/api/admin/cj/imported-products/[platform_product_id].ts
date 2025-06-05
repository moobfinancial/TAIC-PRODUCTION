import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { z } from 'zod';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
                  `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Zod schema for updating a CJ product (subset of fields)
const UpdateCjProductSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  display_description: z.string().optional().nullable(),
  platform_category_id: z.number().int().positive().optional(),
  selling_price: z.number().positive().optional(),
  is_active: z.boolean().optional(),
  cashback_percentage: z.number().min(0).max(99.99).optional().nullable(),
  shipping_rules_id: z.string().optional().nullable(),
}).strict();

// GET Handler: Fetch a single imported CJ product
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { platform_product_id } = req.query;
  const id = parseInt(platform_product_id as string, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product ID format.' });
  }

  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT * FROM cj_products WHERE platform_product_id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Imported product not found.' });
    }
    return res.status(200).json(rows[0]);
  } catch (error: any) {
    console.error(`[API GET /admin/cj/imported-products/${id}] Error:`, error);
    return res.status(500).json({ error: 'Failed to fetch imported product.', details: error.message });
  } finally {
    if (client) client.release();
  }
}

// PUT Handler: Update an imported CJ product
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { platform_product_id } = req.query;
  const id = parseInt(platform_product_id as string, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product ID format.' });
  }

  let client;
  try {
    const updateData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Validate request body against schema
    const validation = UpdateCjProductSchema.safeParse(updateData);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.format() 
      });
    }

    client = await pool.connect();
    
    // Check if category exists if provided
    if (validation.data.platform_category_id !== undefined && 
        validation.data.platform_category_id !== null) {
      const categoryCheck = await client.query(
        'SELECT id FROM categories WHERE id = $1', 
        [validation.data.platform_category_id]
      );
      if (categoryCheck.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid platform_category_id: Category does not exist.' 
        });
      }
    }

    // Build the update query
    const updateFields = Object.keys(validation.data);
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    const query = {
      text: `
        UPDATE cj_products 
        SET ${updateFields.map((field, i) => `${field} = $${i + 1}`).join(', ')}
        WHERE platform_product_id = $${updateFields.length + 1}
        RETURNING *
      `,
      values: [...Object.values(validation.data), id]
    };

    const { rows } = await client.query(query);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Imported product not found.' });
    }
    return res.status(200).json(rows[0]);
  } catch (error: any) {
    console.error(`[API PUT /admin/cj/imported-products/${id}] Error:`, error);
    return res.status(500).json({ 
      error: 'Failed to update imported product.', 
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
}

// DELETE Handler: Delete an imported CJ product
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const { platform_product_id } = req.query;
  const id = parseInt(platform_product_id as string, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product ID format.' });
  }

  let client;
  try {
    client = await pool.connect();
    const { rowCount } = await client.query(
      'DELETE FROM cj_products WHERE platform_product_id = $1',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Imported product not found.' });
    }
    return res.status(204).end();
  } catch (error: any) {
    console.error(`[API DELETE /admin/cj/imported-products/${id}] Error:`, error);
    return res.status(500).json({ 
      error: 'Failed to delete imported product.', 
      details: error.message 
    });
  } finally {
    if (client) client.release();
  }
}

// Main handler function
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check for admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGet(req, res);
      case 'PUT':
        return handlePut(req, res);
      case 'DELETE':
        return handleDelete(req, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error(`[API ${req.method} /admin/cj/imported-products] Error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
