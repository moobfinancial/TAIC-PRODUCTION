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

// Valid status transitions for order fulfillment
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'pending': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered', 'cancelled'],
    'delivered': [], // Final state
    'cancelled': [] // Final state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
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
  fulfillmentNotes: z.string().max(500).optional().nullable(),
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field to update (status, shippingCarrier, trackingNumber, or fulfillmentNotes) is required."
});


export async function PUT(request: NextRequest, context: { params: Promise<{ order_id: string }> }) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  // params is already destructured from the function parameters
  const { order_id } = await context.params;
  const platformOrderId = parseInt(order_id, 10);

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

  const { status, shippingCarrier, trackingNumber, fulfillmentNotes } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify Merchant Ownership and get order details
    const ownershipCheckQuery = `
      SELECT
        o.status as current_status,
        oi.product_id,
        oi.quantity,
        mp.stock_quantity,
        mp.merchant_commission_rate,
        oi.price_at_purchase,
        mp.status as product_status
      FROM order_items oi
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.order_id = $1 AND mp.merchant_id = $2;
    `;
    const ownershipResult = await client.query(ownershipCheckQuery, [platformOrderId, merchantId]);
    if (ownershipResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Order not found for this merchant or you don't have items in this order." }, { status: 403 });
    }

    const orderItems = ownershipResult.rows;
    const currentStatus = orderItems[0].current_status;

    // Validate status transition
    if (status && !isValidStatusTransition(currentStatus, status)) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Invalid status transition from '${currentStatus}' to '${status}'`
      }, { status: 400 });
    }

    // Check inventory availability if status is being set to 'processing'
    if (status === 'processing') {
      for (const item of orderItems) {
        const stockQuantity = item.stock_quantity || 0;
        const orderedQuantity = parseInt(item.quantity);
        if (stockQuantity < orderedQuantity) {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: `Insufficient stock for product ${item.product_id}. Available: ${stockQuantity}, Required: ${orderedQuantity}`
          }, { status: 400 });
        }
        if (item.product_status !== 'approved') {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: `Product ${item.product_id} is not approved for sale`
          }, { status: 400 });
        }
      }
    }

    // Update inventory if status is changing to 'processing' (reserve stock)
    if (status === 'processing' && currentStatus !== 'processing') {
      for (const item of orderItems) {
        await client.query(`
          UPDATE merchant_products
          SET stock_quantity = stock_quantity - $1,
              updated_at = NOW()
          WHERE id = $2::INTEGER AND merchant_id = $3
        `, [item.quantity, item.product_id, merchantId]);
      }
    }

    // Restore inventory if status is changing to 'cancelled' from 'processing'
    if (status === 'cancelled' && currentStatus === 'processing') {
      for (const item of orderItems) {
        await client.query(`
          UPDATE merchant_products
          SET stock_quantity = stock_quantity + $1,
              updated_at = NOW()
          WHERE id = $2::INTEGER AND merchant_id = $3
        `, [item.quantity, item.product_id, merchantId]);
      }
    }

    // Create merchant transaction records for commission tracking
    if (status === 'delivered' && currentStatus !== 'delivered') {
      // Calculate total commission and sales for this merchant's items in the order
      let totalSales = 0;
      let totalCommission = 0;

      for (const item of orderItems) {
        const itemTotal = parseFloat(item.price_at_purchase) * parseInt(item.quantity);
        const commissionRate = parseFloat(item.merchant_commission_rate) || 5.0;
        const itemCommission = itemTotal * (commissionRate / 100);

        totalSales += itemTotal;
        totalCommission += itemCommission;
      }

      // Record sale transaction
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, order_id, transaction_type, amount, currency, status, description, created_at
        ) VALUES ($1, $2, 'SALE', $3, 'TAIC', 'COMPLETED', $4, NOW())
      `, [
        merchantId,
        platformOrderId,
        totalSales,
        `Sale from order #${platformOrderId} - ${orderItems.length} items`
      ]);

      // Record commission transaction
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, order_id, transaction_type, amount, currency, status, description, created_at
        ) VALUES ($1, $2, 'COMMISSION', $3, 'TAIC', 'COMPLETED', $4, NOW())
      `, [
        merchantId,
        platformOrderId,
        -totalCommission,
        `Platform commission for order #${platformOrderId} (${(totalCommission / totalSales * 100).toFixed(1)}%)`
      ]);
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
      updateValues.push(shippingCarrier);
    }
    if (trackingNumber !== undefined) {
      updateFields.push(`tracking_number = $${paramIndex++}`);
      updateValues.push(trackingNumber);
    }
    if (fulfillmentNotes !== undefined) {
      updateFields.push(`fulfillment_notes = $${paramIndex++}`);
      updateValues.push(fulfillmentNotes);
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

    // Log the order update in audit trail
    const auditDetails = {
      order_id: platformOrderId,
      merchant_id: merchantId,
      old_status: currentStatus,
      new_status: status || currentStatus,
      shipping_carrier: shippingCarrier,
      tracking_number: trackingNumber,
      fulfillment_notes: fulfillmentNotes,
      inventory_updated: status === 'processing' || (status === 'cancelled' && currentStatus === 'processing'),
      commissions_recorded: status === 'delivered' && currentStatus !== 'delivered'
    };

    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, order_id, transaction_type, amount, currency, status, description, metadata, created_at
      ) VALUES ($1, $2, 'ORDER_UPDATE', 0, 'TAIC', 'COMPLETED', $3, $4, NOW())
    `, [
      merchantId,
      platformOrderId,
      `Order #${platformOrderId} updated: ${currentStatus} → ${status || currentStatus}`,
      JSON.stringify(auditDetails)
    ]);

    await client.query('COMMIT');

    // Prepare detailed response
    const updatedOrder = result.rows[0];
    const response = {
      message: "Order updated successfully",
      updatedOrder: updatedOrder,
      statusTransition: status ? { from: currentStatus, to: status } : null,
      inventoryUpdated: status === 'processing' || (status === 'cancelled' && currentStatus === 'processing'),
      commissionsRecorded: status === 'delivered' && currentStatus !== 'delivered',
      fulfillmentNotes: fulfillmentNotes || null,
      auditTrail: auditDetails
    };

    return NextResponse.json(response);

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error on update:", rbErr));
    console.error(`Error updating order ${platformOrderId} for merchant ${merchantId}:`, error);
    return NextResponse.json({ error: 'Failed to update order fulfillment details.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
