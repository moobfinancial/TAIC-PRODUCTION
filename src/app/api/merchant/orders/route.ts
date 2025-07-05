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
  merchantCommissionAmount?: number; // Commission earned by merchant
  merchantNetAmount?: number; // Net amount after commission
  orderItemsCount?: number; // Number of items from this merchant in the order
  canFulfill?: boolean; // Whether merchant can fulfill this order
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  lastStatusUpdate?: string; // Last time status was updated
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
    // Include commission calculations and order summary data
    const distinctOrderIdsResult = await client.query(`
      SELECT DISTINCT
        o.id,
        o.status,
        o.created_at,
        COUNT(oi.id) as merchant_items_count,
        SUM(oi.quantity * oi.price_at_purchase) as merchant_order_total,
        SUM(oi.quantity * oi.price_at_purchase * COALESCE(mp.merchant_commission_rate, 5.0) / 100) as merchant_commission
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE mp.merchant_id = $1
      GROUP BY o.id, o.status, o.created_at
      ORDER BY o.created_at DESC;
    `, [merchantId]);

    if (distinctOrderIdsResult.rowCount === 0) {
      return NextResponse.json([]); // No orders for this merchant
    }

    const merchantOrders: MerchantOrder[] = [];

    for (const row of distinctOrderIdsResult.rows) {
      const orderId = row.id;
      const merchantItemsCount = parseInt(row.merchant_items_count);
      const merchantOrderTotal = parseFloat(row.merchant_order_total);
      const merchantCommission = parseFloat(row.merchant_commission);

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
          o.updated_at AS "lastStatusUpdate",
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
          mp.cashback_percentage,
          mp.merchant_commission_rate,
          mp.stock_quantity,
          mp.status as product_status
        FROM order_items oi
        JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
        WHERE oi.order_id = $1 AND mp.merchant_id = $2;
      `, [orderId, merchantId]);

      // Determine if merchant can fulfill this order
      const canFulfill = itemsResult.rows.every(item => {
        const stockQuantity = item.stock_quantity || 0;
        const orderedQuantity = parseInt(String(item.quantity), 10);
        return stockQuantity >= orderedQuantity && item.product_status === 'approved';
      });

      // Calculate net amount after commission
      const merchantNetAmount = merchantOrderTotal - merchantCommission;

      merchantOrders.push({
        ...orderData,
        id: parseInt(orderData.id, 10),
        totalAmount: parseFloat(orderData.amount),
        merchantCommissionAmount: merchantCommission,
        merchantNetAmount: merchantNetAmount,
        orderItemsCount: merchantItemsCount,
        canFulfill: canFulfill,
        fulfillmentStatus: orderData.status as any,
        lastStatusUpdate: orderData.lastStatusUpdate ? new Date(orderData.lastStatusUpdate).toISOString() : null,
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
