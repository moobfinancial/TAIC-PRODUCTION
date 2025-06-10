import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { z } from 'zod';
import { validateAdminApiKey } from '@/lib/adminAuth';

// Force this route to run in Node.js runtime instead of Edge Runtime
export const runtime = 'nodejs';
// Disable static optimization to ensure runtime is respected
export const dynamic = 'force-dynamic';


const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const UpdateStatusInputSchema = z.object({
  approvalStatus: z.enum(['approved', 'rejected']).optional(),
  isActive: z.boolean().optional(),
}).refine(data => data.approvalStatus !== undefined || data.isActive !== undefined, {
  message: "At least one of 'approvalStatus' or 'isActive' must be provided.",
});


export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  if (!authResult.valid) {
    return NextResponse.json({ success: false, message: 'Invalid or missing Admin API Key.' }, { status: 401 });
  }

  const { params } = context;
  const platformProductId = parseInt(params.id, 10);
  if (isNaN(platformProductId)) {
    return NextResponse.json({ error: 'Invalid product ID format.' }, { status: 400 });
  }

  let validatedData: z.infer<typeof UpdateStatusInputSchema>;
  try {
    const body = await request.json();
    const validationResult = UpdateStatusInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }
    validatedData = validationResult.data;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { approvalStatus, isActive: payloadIsActive } = validatedData;

  const setClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  let finalIsActive = payloadIsActive; // Default to payload's isActive

  if (approvalStatus) {
    setClauses.push(`approval_status = $${paramIndex++}`);
    queryParams.push(approvalStatus);

    if (approvalStatus === 'approved') {
      // If approving, set isActive to true UNLESS isActive is explicitly false in payload
      if (payloadIsActive === undefined || payloadIsActive === true) {
        finalIsActive = true;
      }
    } else if (approvalStatus === 'rejected') {
      // If rejecting, set isActive to false UNLESS isActive is explicitly true in payload
       if (payloadIsActive === undefined || payloadIsActive === false) {
        finalIsActive = false;
      }
    }
  }

  // Add isActive to setClauses if it was in payload OR if it was derived from approvalStatus
  if (finalIsActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    queryParams.push(finalIsActive);
  }

  if (setClauses.length === 0) {
    // This case should be caught by Zod .refine, but as a safeguard:
    return NextResponse.json({ error: 'No update parameters provided.' }, { status: 400 });
  }

  setClauses.push(`updated_at = NOW()`);
  queryParams.push(platformProductId); // For WHERE clause

  const updateQuery = `
    UPDATE cj_products
    SET ${setClauses.join(', ')}
    WHERE platform_product_id = $${paramIndex}
    RETURNING platform_product_id, cj_product_id, display_name, approval_status, is_active;
  `;

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(updateQuery, queryParams);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found or no changes made.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Product status updated successfully.', product: result.rows[0] });
  } catch (error: any) {
    console.error('[Supplier Product Status Update] Error:', error); // Updated log
    return NextResponse.json({ error: 'Failed to update product status.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
