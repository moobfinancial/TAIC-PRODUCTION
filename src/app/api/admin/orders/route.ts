import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import type { Order, OrderItem } from '@/lib/types'; // Assuming these types are up-to-date

// Local DB Pool (consider moving to a shared lib/db.ts if not already)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

// Local Admin API Key Validation (consider moving to a shared lib/adminAuth.ts)
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for admin route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

// Extend Order type for Admin view, including user email and all shipping details
interface AdminOrder extends Order {
  userEmail?: string | null;
  // All other fields from Order type are inherited
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const ordersResult = await client.query(`
      SELECT
        o.id,
        o.user_id,
        o.amount,
        o.currency,
        o.status,
        o.cashback_awarded AS "cashbackAwarded",
        o.cj_order_id AS "cjOrderId",
        o.cj_shipping_status AS "cjShippingStatus",
        o.shipping_carrier AS "shippingCarrier",
        o.tracking_number AS "trackingNumber",
        o.created_at AS "date",
        u.email AS "userEmail",
        o.shipping_recipient_name AS "shippingRecipientName",
        o.shipping_address_line1 AS "shippingAddressLine1",
        o.shipping_address_line2 AS "shippingAddressLine2",
        o.shipping_city AS "shippingCity",
        o.shipping_state_or_province AS "shippingStateOrProvince",
        o.shipping_postal_code AS "shippingPostalCode",
        o.shipping_country_code AS "shippingCountryCode",
        o.shipping_phone_number AS "shippingPhoneNumber"
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC;
    `);

    const orders: AdminOrder[] = [];
    for (const orderRow of ordersResult.rows) {
      // Ensure cashback_percentage is selected if it's in OrderItem type and exists in order_items table
      // The provided query in the prompt has it, assuming it exists in the DB table.
      const itemsResult = await client.query<OrderItem>(`
        SELECT
          product_id AS "productId",
          product_name AS "name",
          quantity,
          price_at_purchase AS "price",
          image_url_at_purchase AS "imageUrl",
          cashback_percentage AS "cashbackPercentage"
        FROM order_items
        WHERE order_id = $1;
      `, [orderRow.id]);

      orders.push({
        ...orderRow,
        id: parseInt(orderRow.id, 10), // Ensure id is number
        totalAmount: parseFloat(orderRow.amount),
        items: itemsResult.rows.map(item => ({
            ...item,
            price: parseFloat(String(item.price)),
            quantity: parseInt(String(item.quantity), 10),
            cashbackPercentage: item.cashbackPercentage ? parseFloat(String(item.cashbackPercentage)) : 0,
        })),
        date: new Date(orderRow.date).toISOString(),
        cashbackAwarded: orderRow.cashbackAwarded ? parseFloat(orderRow.cashbackAwarded) : 0,
      });
    }
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Error fetching all orders for admin:", error);
    return NextResponse.json({ error: "Failed to fetch orders", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
