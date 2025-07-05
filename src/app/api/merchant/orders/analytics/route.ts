import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.MERCHANT_JWT_SECRET || process.env.JWT_SECRET || 'your-fallback-merchant-jwt-secret';

interface MerchantAuthPayload {
  merchantId: string;
}

// Merchant auth verification
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

interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  totalCommissions: number;
  netRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: number; // Last 30 days
  fulfillmentRate: number; // Percentage of orders successfully fulfilled
  inventoryAlerts: {
    lowStockProducts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      reorderLevel: number;
    }>;
    outOfStockProducts: Array<{
      productId: string;
      productName: string;
    }>;
  };
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    totalSold: number;
    revenue: number;
  }>;
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

    // Get overall order statistics
    const orderStatsQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as total_revenue,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase * COALESCE(mp.merchant_commission_rate, 5.0) / 100), 0) as total_commissions,
        COALESCE(AVG(oi.quantity * oi.price_at_purchase), 0) as avg_order_value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE mp.merchant_id = $1
    `;
    const orderStatsResult = await client.query(orderStatsQuery, [merchantId]);
    const orderStats = orderStatsResult.rows[0];

    // Get orders by status
    const statusQuery = `
      SELECT 
        o.status,
        COUNT(DISTINCT o.id) as count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE mp.merchant_id = $1
      GROUP BY o.status
    `;
    const statusResult = await client.query(statusQuery, [merchantId]);
    const ordersByStatus: Record<string, number> = {};
    statusResult.rows.forEach(row => {
      ordersByStatus[row.status] = parseInt(row.count);
    });

    // Get recent orders (last 30 days)
    const recentOrdersQuery = `
      SELECT COUNT(DISTINCT o.id) as recent_orders
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE mp.merchant_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'
    `;
    const recentOrdersResult = await client.query(recentOrdersQuery, [merchantId]);
    const recentOrders = parseInt(recentOrdersResult.rows[0].recent_orders);

    // Calculate fulfillment rate
    const deliveredOrders = ordersByStatus['delivered'] || 0;
    const totalOrders = parseInt(orderStats.total_orders);
    const fulfillmentRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

    // Get inventory alerts
    const lowStockQuery = `
      SELECT 
        mp.id as product_id,
        mp.name as product_name,
        mp.stock_quantity as current_stock,
        COALESCE(mp.reorder_level, 10) as reorder_level
      FROM merchant_products mp
      WHERE mp.merchant_id = $1 
        AND mp.stock_quantity <= COALESCE(mp.reorder_level, 10)
        AND mp.stock_quantity > 0
        AND mp.status = 'approved'
      ORDER BY mp.stock_quantity ASC
    `;
    const lowStockResult = await client.query(lowStockQuery, [merchantId]);

    const outOfStockQuery = `
      SELECT 
        mp.id as product_id,
        mp.name as product_name
      FROM merchant_products mp
      WHERE mp.merchant_id = $1 
        AND mp.stock_quantity = 0
        AND mp.status = 'approved'
      ORDER BY mp.name
    `;
    const outOfStockResult = await client.query(outOfStockQuery, [merchantId]);

    // Get top selling products
    const topProductsQuery = `
      SELECT 
        mp.id as product_id,
        mp.name as product_name,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price_at_purchase) as revenue
      FROM order_items oi
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      JOIN orders o ON oi.order_id = o.id
      WHERE mp.merchant_id = $1 AND o.status IN ('delivered', 'shipped')
      GROUP BY mp.id, mp.name
      ORDER BY total_sold DESC
      LIMIT 10
    `;
    const topProductsResult = await client.query(topProductsQuery, [merchantId]);

    // Calculate net revenue
    const totalRevenue = parseFloat(orderStats.total_revenue);
    const totalCommissions = parseFloat(orderStats.total_commissions);
    const netRevenue = totalRevenue - totalCommissions;

    const analytics: OrderAnalytics = {
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      totalCommissions: totalCommissions,
      netRevenue: netRevenue,
      averageOrderValue: parseFloat(orderStats.avg_order_value),
      ordersByStatus: ordersByStatus,
      recentOrders: recentOrders,
      fulfillmentRate: fulfillmentRate,
      inventoryAlerts: {
        lowStockProducts: lowStockResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          currentStock: parseInt(row.current_stock),
          reorderLevel: parseInt(row.reorder_level)
        })),
        outOfStockProducts: outOfStockResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name
        }))
      },
      topSellingProducts: topProductsResult.rows.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        totalSold: parseInt(row.total_sold),
        revenue: parseFloat(row.revenue)
      }))
    };

    return NextResponse.json(analytics);

  } catch (error: any) {
    console.error("Error fetching merchant order analytics:", error);
    return NextResponse.json({ error: "Failed to fetch order analytics", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
