import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

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

const NotificationSchema = z.object({
  orderId: z.number().int().positive(),
  notificationType: z.enum(['status_update', 'shipping_update', 'delivery_confirmation', 'custom']),
  message: z.string().min(1).max(500),
  includeTrackingInfo: z.boolean().optional().default(false),
});

interface CustomerNotification {
  id: string;
  orderId: number;
  customerId: string;
  customerEmail: string;
  notificationType: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt: string | null;
  createdAt: string;
}

// POST - Send customer notification
export async function POST(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = NotificationSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { orderId, notificationType, message, includeTrackingInfo } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify merchant owns items in this order
    const ownershipQuery = `
      SELECT 
        o.id,
        o.user_id,
        u.email as customer_email,
        o.tracking_number,
        o.shipping_carrier,
        o.status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
      WHERE o.id = $1 AND mp.merchant_id = $2
      LIMIT 1
    `;
    
    const ownershipResult = await client.query(ownershipQuery, [orderId, merchantId]);
    
    if (ownershipResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Order not found or you do not have items in this order' 
      }, { status: 403 });
    }

    const orderData = ownershipResult.rows[0];

    // Build notification message with tracking info if requested
    let finalMessage = message;
    if (includeTrackingInfo && orderData.tracking_number) {
      finalMessage += `\n\nTracking Information:\nCarrier: ${orderData.shipping_carrier || 'N/A'}\nTracking Number: ${orderData.tracking_number}`;
    }

    // Create notification record
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insertNotificationQuery = `
      INSERT INTO customer_notifications (
        id, order_id, customer_id, customer_email, merchant_id, 
        notification_type, message, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING *
    `;

    const notificationResult = await client.query(insertNotificationQuery, [
      notificationId,
      orderId,
      orderData.user_id,
      orderData.customer_email,
      merchantId,
      notificationType,
      finalMessage
    ]);

    // In a real implementation, this would integrate with an email service
    // For now, we'll simulate sending the notification
    const simulateEmailSending = async () => {
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update notification status to 'sent'
      await client!.query(`
        UPDATE customer_notifications 
        SET status = 'sent', sent_at = NOW() 
        WHERE id = $1
      `, [notificationId]);
      
      return true;
    };

    try {
      await simulateEmailSending();
      
      // Log the notification in merchant transactions for audit trail
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, order_id, transaction_type, amount, currency, status, description, created_at
        ) VALUES ($1, $2, 'NOTIFICATION', 0, 'TAIC', 'COMPLETED', $3, NOW())
      `, [
        merchantId,
        orderId,
        `Customer notification sent: ${notificationType} for order #${orderId}`
      ]);

      await client.query('COMMIT');

      const notification = notificationResult.rows[0];
      
      return NextResponse.json({
        success: true,
        message: 'Customer notification sent successfully',
        notification: {
          id: notification.id,
          orderId: notification.order_id,
          customerEmail: notification.customer_email,
          notificationType: notification.notification_type,
          status: 'sent',
          sentAt: new Date().toISOString()
        }
      });

    } catch (emailError) {
      // Update notification status to 'failed'
      await client.query(`
        UPDATE customer_notifications 
        SET status = 'failed' 
        WHERE id = $1
      `, [notificationId]);
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: false,
        message: 'Failed to send customer notification',
        error: 'Email delivery failed'
      }, { status: 500 });
    }

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error sending customer notification:", error);
    return NextResponse.json({ 
      error: 'Failed to send notification', 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// GET - Fetch notification history for merchant
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    let query = `
      SELECT 
        cn.id,
        cn.order_id,
        cn.customer_email,
        cn.notification_type,
        cn.message,
        cn.status,
        cn.sent_at,
        cn.created_at
      FROM customer_notifications cn
      WHERE cn.merchant_id = $1
    `;
    
    const queryParams = [merchantId];
    let paramIndex = 2;

    if (orderId) {
      query += ` AND cn.order_id = $${paramIndex++}`;
      queryParams.push(orderId);
    }

    query += ` ORDER BY cn.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push(limit.toString(), offset.toString());

    const result = await client.query(query, queryParams);

    const notifications: CustomerNotification[] = result.rows.map(row => ({
      id: row.id,
      orderId: parseInt(row.order_id),
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      notificationType: row.notification_type,
      message: row.message,
      status: row.status,
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString()
    }));

    return NextResponse.json({
      notifications,
      pagination: {
        limit,
        offset,
        total: notifications.length
      }
    });

  } catch (error: any) {
    console.error("Error fetching notification history:", error);
    return NextResponse.json({ 
      error: 'Failed to fetch notifications', 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
