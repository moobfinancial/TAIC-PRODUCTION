import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken'; // For JWT verification
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.MERCHANT_JWT_SECRET || process.env.JWT_SECRET || 'your-fallback-merchant-jwt-secret';

interface MerchantAuthPayload {
  merchantId: string;
}

// Placeholder for verifyMerchantAuth - in a real app, this would be a robust shared utility
async function verifyMerchantAuth(request: NextRequest): Promise<{ valid: boolean; merchantId?: string; error?: string; status?: number }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed', status: 401 };
  }
  const token = authHeader.substring(7);
  if (!token) {
    return { valid: false, error: 'Token not found', status: 401 };
  }
  try {
    if (!JWT_SECRET) {
        console.error("MERCHANT_JWT_SECRET or JWT_SECRET is not defined in environment variables.");
        return { valid: false, error: 'Authentication secret not configured on server.', status: 500 };
    }
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & MerchantAuthPayload;
    if (!decoded.merchantId) {
      return { valid: false, error: 'Invalid token: merchantId missing', status: 401 };
    }
    return { valid: true, merchantId: String(decoded.merchantId) };
  } catch (error: any) {
    let errorMessage = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') errorMessage = 'Token expired';
    return { valid: false, error: errorMessage, status: 401 };
  }
}

const UpdateOrderSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  shippingCarrier: z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(255).optional().nullable(),
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field to update (status, shippingCarrier, or trackingNumber) is required."
});


export async function PUT(request: NextRequest, { params }: { params: { order_id: string } }) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const platformOrderId = parseInt(params.order_id, 10);

  if (isNaN(platformOrderId)) {
    return NextResponse.json({ error: 'Invalid Order ID format' }, { status: 400 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = UpdateOrderSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { status, shippingCarrier, trackingNumber } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify Merchant Ownership of at least one item in this order
    const ownershipCheckQuery = `
      SELECT 1 FROM order_items oi
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE oi.order_id = $1 AND mp.merchant_id = $2
      LIMIT 1;
    `;
    const ownershipResult = await client.query(ownershipCheckQuery, [platformOrderId, merchantId]);
    if (ownershipResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Order not found for this merchant or you don't have items in this order." }, { status: 403 });
    }

    // Construct dynamic UPDATE query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }
    if (shippingCarrier !== undefined) {
      updateFields.push(`shipping_carrier = $${paramIndex++}`);
      updateValues.push(shippingCarrier); // Can be null to clear it
    }
    if (trackingNumber !== undefined) {
      updateFields.push(`tracking_number = $${paramIndex++}`);
      updateValues.push(trackingNumber); // Can be null to clear it
    }

    // This check is already covered by Zod .refine, but kept for safety
    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No fields to update provided.'}, {status: 400});
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(platformOrderId); // For the WHERE clause

    const updateQueryString = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;

    const result = await client.query(updateQueryString, updateValues);

    if (result.rowCount === 0) {
      // This case should ideally be caught by the ownership check, but good for robustness
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found or no update occurred.' }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: "Order updated successfully", updatedOrder: result.rows[0] });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error on update:", rbErr));
    console.error(`Error updating order ${platformOrderId} for merchant ${merchantId}:`, error);
    return NextResponse.json({ error: 'Failed to update order fulfillment details.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
