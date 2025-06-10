import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import type { CjGetOrderStatusApiResponse, CjOrderStatusData } from '@/lib/types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Simple Admin API Key Validation
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

export async function POST(request: NextRequest, context: any) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { params } = context;
  const platformOrderId = parseInt(params.order_id, 10);
  if (isNaN(platformOrderId)) {
    return NextResponse.json({ error: 'Invalid Order ID format' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Fetch Platform Order & cj_order_id
    const orderQuery = `SELECT cj_order_id, status FROM orders WHERE id = $1;`;
    const orderResult = await client.query(orderQuery, [platformOrderId]);

    if (orderResult.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const cjOrderIdForLookup = orderResult.rows[0].cj_order_id;
    const currentPlatformStatus = orderResult.rows[0].status;

    if (!cjOrderIdForLookup) {
      return NextResponse.json({ error: 'Order has not been submitted to CJ Dropshipping yet.' }, { status: 400 });
    }

    // Simulate CJ API Call (Get Order Status)
    // In a real scenario, this would be an actual HTTP request to CJ API using cjOrderIdForLookup
    // const cjApiResponse: CjGetOrderStatusApiResponse = await actualGetOrderStatusFromCj(cjOrderIdForLookup);

    // --- Simulation Start ---
    let simulatedCjStatus: string;
    const randomizer = Math.random();
    if (randomizer < 0.33) simulatedCjStatus = "Processing";
    else if (randomizer < 0.66) simulatedCjStatus = "Shipped";
    else simulatedCjStatus = "Delivered";

    let cjApiResponse: CjGetOrderStatusApiResponse;

    if (Math.random() < 0.9) { // 90% chance of success
      cjApiResponse = {
        success: true,
        data: {
          cjOrderId: cjOrderIdForLookup,
          cjShippingStatus: simulatedCjStatus,
          shippingCarrier: simulatedCjStatus === "Shipped" || simulatedCjStatus === "Delivered" ? "CJ Express Simulated" : null,
          trackingNumber: simulatedCjStatus === "Shipped" || simulatedCjStatus === "Delivered" ? `CJTRACKSIM${Date.now()}` : null,
          dateShipped: simulatedCjStatus === "Shipped" || simulatedCjStatus === "Delivered" ? new Date(Date.now() - 86400000).toISOString() : null // Shipped yesterday
        },
        message: `Order status retrieved from CJ (Simulated - ${simulatedCjStatus})`
      };
    } else { // 10% chance of error
      cjApiResponse = {
        success: false,
        message: "CJ API Error: Simulated failure to retrieve order status."
      };
    }
    // --- Simulation End ---

    if (cjApiResponse.success && cjApiResponse.data) {
      const { cjShippingStatus, shippingCarrier, trackingNumber } = cjApiResponse.data;
      let newPlatformStatus = currentPlatformStatus;

      // Determine newPlatformStatus based on cjShippingStatus
      if (cjShippingStatus === "Shipped" && currentPlatformStatus !== 'shipped' && currentPlatformStatus !== 'delivered') {
        newPlatformStatus = 'shipped';
      } else if (cjShippingStatus === "Delivered" && currentPlatformStatus !== 'delivered') {
        newPlatformStatus = 'delivered';
      } else if (cjShippingStatus === "Processing" && (currentPlatformStatus === 'pending_cj_submit' || currentPlatformStatus === 'processing')) {
        // Example: if we had a 'pending_cj_submit' status, we could update it to 'processing'
        // Or if it's already 'processing', we might just be updating tracking info.
        // For now, if CJ says "Processing", we keep our "processing" or update to it.
        if (currentPlatformStatus !== 'shipped' && currentPlatformStatus !== 'delivered') {
             newPlatformStatus = 'processing'; // Or a more granular status like 'processing_cj'
        }
      }
      // Add other status mappings as needed (e.g., "Cancelled" from CJ)

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (cjShippingStatus) {
        updateFields.push(`cj_shipping_status = $${paramIndex++}`);
        updateValues.push(cjShippingStatus);
      }
      if (shippingCarrier) {
        updateFields.push(`shipping_carrier = $${paramIndex++}`);
        updateValues.push(shippingCarrier);
      }
      if (trackingNumber) {
        updateFields.push(`tracking_number = $${paramIndex++}`);
        updateValues.push(trackingNumber);
      }
      if (newPlatformStatus !== currentPlatformStatus) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(newPlatformStatus);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(platformOrderId); // For the WHERE clause

        const updateOrderQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
        const updatedOrderResult = await client.query(updateOrderQuery, updateValues);

        return NextResponse.json({
          message: 'Order status refreshed from CJ (Simulated).',
          details: cjApiResponse.data,
          updatedOrder: updatedOrderResult.rows[0]
        });
      } else {
        return NextResponse.json({
          message: 'No status changes from CJ to update.',
          details: cjApiResponse.data
        });
      }
    } else {
      return NextResponse.json({
        error: 'Failed to refresh status from CJ (Simulated).',
        details: cjApiResponse.message || 'Unknown error from CJ (Simulated)'
      }, { status: 502 }); // Bad Gateway
    }

  } catch (error: any) {
    console.error(`[Refresh CJ Status] Error for order ${platformOrderId}:`, error);
    return NextResponse.json({ error: 'Failed to process order status refresh.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
