import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import type { Order, OrderItem, CjOrderPayload, CjOrderItemInput, CjShippingAddressInput, CjOrderResponse } from '@/lib/types';

// Assume a shared db pool, e.g., from 'src/lib/db.ts' if available
// For this example, creating a new pool.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Simple Admin API Key Validation (replace with a more secure method in production)
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

export async function POST(request: NextRequest, { params }: { params: { order_id: string } }) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // params is already destructured from the function parameters
  const platformOrderId = parseInt(params.order_id, 10);
  if (isNaN(platformOrderId)) {
    return NextResponse.json({ error: 'Invalid Order ID format' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Fetch Order details (including new shipping fields)
    const orderQuery = `
      SELECT *, amount as totalAmount, created_at as date
      FROM orders
      WHERE id = $1;
    `;
    const orderResult = await client.query(orderQuery, [platformOrderId]);

    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const orderData: Order = orderResult.rows[0];

    // Check order status and if already submitted
    if (orderData.cjOrderId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order already submitted to CJ.', cjOrderId: orderData.cjOrderId }, { status: 409 });
    }
    // Example: Allow submission only for 'completed' (paid) or 'pending' orders that need fulfillment
    if (orderData.status !== 'completed' && orderData.status !== 'pending_payment_confirmation_cj') { // Assuming 'pending_payment_confirmation_cj' is a status after payment but before CJ submission
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Order status '${orderData.status}' is not eligible for submission to CJ.` }, { status: 400 });
    }

    // Fetch Order Items
    const itemsQuery = `
      SELECT
        oi.product_id AS "platformProductId",
        oi.quantity,
        oi.price_at_purchase AS "priceAtPurchase",
        cp.cj_product_id AS "cjProductId"
      FROM order_items oi
      LEFT JOIN cj_products cp ON oi.product_id = cp.platform_product_id::TEXT -- Ensure type match if platform_product_id is not TEXT
      WHERE oi.order_id = $1;
    `;
    const itemsResult = await client.query(itemsQuery, [platformOrderId]);
    if (itemsResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order has no items to submit.' }, { status: 400 });
    }

    const cjOrderItems: CjOrderItemInput[] = [];
    for (const item of itemsResult.rows) {
      if (!item.cjProductId) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: `Product with Platform ID ${item.platformProductId} is not linked to a CJ Product ID. Cannot submit to CJ.` }, { status: 400 });
      }
      cjOrderItems.push({
        productId: item.cjProductId, // This is the actual CJ Product ID
        quantity: item.quantity,
      });
    }

    // Construct Shipping Address (ensure these fields exist on your 'orders' table as per type update)
    const shippingAddress: CjShippingAddressInput = {
      recipientName: orderData.shippingRecipientName || 'N/A', // Fallback, ideally these are mandatory
      addressLine1: orderData.shippingAddressLine1 || 'N/A',
      addressLine2: orderData.shippingAddressLine2 || undefined,
      city: orderData.shippingCity || 'N/A',
      stateOrProvince: orderData.shippingStateOrProvince || 'N/A',
      postalCode: orderData.shippingPostalCode || 'N/A',
      countryCode: orderData.shippingCountryCode || 'N/A', // e.g., "US"
      phoneNumber: orderData.shippingPhoneNumber || undefined,
    };

    // Basic validation for essential shipping fields
    if (shippingAddress.recipientName === 'N/A' || shippingAddress.addressLine1 === 'N/A' || shippingAddress.city === 'N/A' || shippingAddress.stateOrProvince === 'N/A' || shippingAddress.postalCode === 'N/A' || shippingAddress.countryCode === 'N/A') {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Order is missing essential shipping address information.' }, { status: 400 });
    }


    const cjPayload: CjOrderPayload = {
      platformOrderId: String(platformOrderId), // CJ might expect string
      shippingAddress: shippingAddress,
      items: cjOrderItems,
      // shippingMethodId: "CJEPACKET" // Example, this would typically be determined by user choice or rules
    };

    // Simulate CJ API Call
    console.log("[Submit to CJ] Payload for CJ API:", JSON.stringify(cjPayload, null, 2));
    // const cjApiResponse: CjOrderResponse = await actualSubmitToCjApi(cjPayload);
    const cjApiResponse: CjOrderResponse = {
      success: true,
      cjOrderId: `CJ_MOCK_${Date.now()}_${platformOrderId}`,
      status: 'In Process', // Example initial status from CJ
      message: 'Order submitted to CJ (Simulated)'
    };
    // To simulate an error:
    // const cjApiResponse: CjOrderResponse = { success: false, message: 'CJ API Error: Item out of stock (Simulated)' };

    if (cjApiResponse.success && cjApiResponse.cjOrderId) {
      const updateOrderQuery = `
        UPDATE orders
        SET
          cj_order_id = $1,
          status = 'processing', -- Update platform order status
          cj_shipping_status = $2,
          updated_at = NOW()
        WHERE id = $3;
      `;
      await client.query(updateOrderQuery, [
        cjApiResponse.cjOrderId,
        cjApiResponse.status, // Store initial CJ status
        platformOrderId
      ]);
      await client.query('COMMIT');
      return NextResponse.json({
        message: 'Order successfully submitted to CJ (Simulated)',
        cjOrderId: cjApiResponse.cjOrderId,
        platformOrderStatus: 'processing',
        cjOrderStatus: cjApiResponse.status
      });
    } else {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: 'Failed to submit order to CJ',
        details: cjApiResponse.message || 'Unknown error from CJ (Simulated)'
      }, { status: 502 }); // Bad Gateway
    }

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error(`[Submit to CJ] Error for order ${platformOrderId}:`, error);
    return NextResponse.json({ error: 'Failed to process order submission to CJ.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
