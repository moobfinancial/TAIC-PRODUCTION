import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken'; // For JWT verification if defining verifyMerchantAuth locally
import type { Order, OrderItem } from '@/lib/types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.MERCHANT_JWT_SECRET || process.env.JWT_SECRET || 'your-fallback-merchant-jwt-secret';

interface MerchantAuthPayload {
  merchantId: string; // Assuming merchantId is string, adjust if number
  // other fields from JWT if present
}

// Placeholder for verifyMerchantAuth - in a real app, this would be a robust shared utility
// For this task, it will be similar to other verifyAuth functions used.
async function verifyMerchantAuth(request: NextRequest): Promise<{ valid: boolean; merchantId?: string; error?: string; status?: number }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed', status: 401 };
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
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
    return { valid: true, merchantId: String(decoded.merchantId) }; // Ensure merchantId is string if DB expects it
  } catch (error: any) {
    let errorMessage = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') errorMessage = 'Token expired';
    return { valid: false, error: errorMessage, status: 401 };
  }
}


interface MerchantOrder extends Order {
  userEmail?: string | null; // Customer's email
  // Other fields are inherited from Order type
}

export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Step 1: Fetch distinct order IDs that contain products from this merchant
    // Assuming merchant_products.id is what's stored in order_items.product_id for merchant items
    // And merchant_products.merchant_id links to the merchant
    const distinctOrderIdsResult = await client.query(`
      SELECT DISTINCT o.id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT -- Assuming mp.id is INT and oi.product_id is TEXT
      WHERE mp.merchant_id = $1
      ORDER BY o.id DESC;
    `, [merchantId]);

    if (distinctOrderIdsResult.rowCount === 0) {
      return NextResponse.json([]); // No orders for this merchant
    }

    const merchantOrders: MerchantOrder[] = [];

    for (const row of distinctOrderIdsResult.rows) {
      const orderId = row.id;

      // Step 2a: Fetch main order details
      const orderResult = await client.query(`
        SELECT
          o.id, o.user_id, o.amount, o.currency, o.status,
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
        WHERE o.id = $1;
      `, [orderId]);

      if (orderResult.rowCount === 0) continue; // Should not happen if distinctOrderIdsResult was correct
      const orderData = orderResult.rows[0];

      // Step 2b: Fetch ONLY the specific order items from this merchant for that order
      const itemsResult = await client.query<OrderItem>(`
        SELECT
          oi.product_id AS "productId",
          oi.product_name AS "name",
          oi.quantity,
          oi.price_at_purchase AS "price",
          oi.image_url_at_purchase AS "imageUrl",
          mp.cashback_percentage -- Fetch from merchant_products table
        FROM order_items oi
        JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
        WHERE oi.order_id = $1 AND mp.merchant_id = $2;
      `, [orderId, merchantId]);

      merchantOrders.push({
        ...orderData,
        id: parseInt(orderData.id, 10),
        totalAmount: parseFloat(orderData.amount),
        items: itemsResult.rows.map(item => ({
          ...item,
          price: parseFloat(String(item.price)),
          quantity: parseInt(String(item.quantity), 10),
          cashbackPercentage: item.cashbackPercentage ? parseFloat(String(item.cashbackPercentage)) : 0,
        })),
        date: new Date(orderData.date).toISOString(),
        cashbackAwarded: orderData.cashbackAwarded ? parseFloat(orderData.cashbackAwarded) : 0,
      });
    }

    return NextResponse.json(merchantOrders);

  } catch (error: any) {
    console.error("Error fetching merchant orders:", error);
    return NextResponse.json({ error: "Failed to fetch merchant orders", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
