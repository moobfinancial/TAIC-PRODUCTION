import { NextRequest, NextResponse } from 'next/server';
// import { Pool } from 'pg'; // Replaced with shared pool
import jwt from 'jsonwebtoken'; // For JWT verification
import { z } from 'zod'; // For POST request validation

import { pool } from '@/lib/db'; // Use the shared pool

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-jwt-secret'; // Ensure this is in .env

interface UserPayload {
  userId: number;
  // other fields from JWT if present
}

// Helper to verify JWT - in a real app, this would be a shared utility/middleware
async function verifyAuth(request: NextRequest): Promise<UserPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Define types for order items based on schema for clarity
interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // price_at_purchase
  imageUrl?: string; // image_url_at_purchase
}

interface OrderWithItems {
  id: number;
  totalAmount: number;
  currency: string;
  status: string;
  date: string; // ISO string
  items: OrderItem[];
  cashbackAwarded?: number;
  // Add new shipping fields here to match global Order type
  cjOrderId?: string | null;
  cjShippingStatus?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  // Assuming shipping address fields are not directly needed for history list, but could be added
}


export async function GET(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userPayload.userId;

  let client;
  try {
    client = await pool.connect();

    // Fetch orders for user, including cashback_awarded and new shipping fields
    const ordersQuery = `
      SELECT
        id,
        amount AS totalAmount,
        currency,
        status,
        created_at AS date,
        cashback_awarded AS "cashbackAwarded",
        -- cj_order_id AS "cjOrderId", -- Column does not exist in orders table
        -- cj_shipping_status AS "cjShippingStatus", -- Column does not exist in orders table
        shipping_carrier AS "shippingCarrier", -- Reverted to shipping_carrier as carrier_name column does not exist
        tracking_number AS "trackingNumber"
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const ordersResult = await client.query(ordersQuery, [userId]);
    const ordersData = ordersResult.rows;

    const ordersWithItems: OrderWithItems[] = [];

    for (const order of ordersData) {
      const itemsQuery = `
        SELECT product_id AS "productId", product_name AS name, quantity, price_at_purchase AS price, image_url_at_purchase AS "imageUrl"
        FROM order_items
        WHERE order_id = $1;
      `;
      const itemsResult = await client.query(itemsQuery, [order.id]);
      ordersWithItems.push({
        id: order.id,
        totalAmount: parseFloat(order.totalAmount), // Corrected case to match query alias
        currency: order.currency,
        status: order.status,
        date: new Date(order.date).toISOString(),
        items: itemsResult.rows,
        cashbackAwarded: order.cashbackAwarded ? parseFloat(order.cashbackAwarded) : 0,
        cjOrderId: order.cjOrderId,
        cjShippingStatus: order.cjShippingStatus,
        shippingCarrier: order.shippingCarrier,
        trackingNumber: order.trackingNumber,
      });
    }

    return NextResponse.json(ordersWithItems);

  } catch (error) {
    console.error('Error fetching user orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Zod schema for POST request (Create Order)
const OrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(), // Price at purchase for this item
  imageUrl: z.string().optional(),
  cashbackPercentage: z.number().min(0).optional().default(0), // Added for cashback
});

const CreateOrderInputSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "Order must contain at least one item."),
  totalAmount: z.number().positive("Total amount must be positive."),
  // currency is defaulted to 'TAIC' on DB / not taken from input for TAIC payment
});

export async function POST(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userPayload.userId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = CreateOrderInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { items, totalAmount } = validatedData;
  const currency = 'TAIC'; // For TAIC payment orders

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock user row and check balance
    const userBalanceResult = await client.query('SELECT taic_balance FROM users WHERE id = $1 FOR UPDATE;', [userId]);
    if (userBalanceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const currentBalance = parseFloat(userBalanceResult.rows[0].taic_balance);
    if (currentBalance < totalAmount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Insufficient TAIC balance' }, { status: 400 });
    }

    // Deduct balance
    await client.query('UPDATE users SET taic_balance = taic_balance - $1 WHERE id = $2;', [totalAmount, userId]);

    // Create order
    const orderInsertResult = await client.query(
      `INSERT INTO orders (user_id, amount, currency, status)
       VALUES ($1, $2, $3, 'completed')
       RETURNING id, created_at AS date;`,
      [userId, totalAmount, currency]
    );
    const newOrder = orderInsertResult.rows[0];
    const newOrderId = newOrder.id;
    const orderDate = new Date(newOrder.date).toISOString();

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase, image_url_at_purchase)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [newOrderId, item.productId, item.name, item.quantity, item.price, item.imageUrl || null]
      );
    }

    // Calculate and award cashback
    let totalCashbackForOrder = 0;
    for (const item of items) { // items here are from validatedData, so they have cashbackPercentage
      const itemCashback = item.price * item.quantity * ( (item.cashbackPercentage || 0) / 100);
      totalCashbackForOrder += itemCashback;
    }
    totalCashbackForOrder = parseFloat(totalCashbackForOrder.toFixed(2)); // Ensure 2 decimal places

    if (totalCashbackForOrder > 0) {
      await client.query(
        `UPDATE orders SET cashback_awarded = $1 WHERE id = $2;`,
        [totalCashbackForOrder, newOrderId]
      );
      await client.query(
        `UPDATE users SET cashback_balance = cashback_balance + $1 WHERE id = $2;`,
        [totalCashbackForOrder, userId]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      id: newOrderId,
      items,
      totalAmount,
      date: orderDate,
      currency,
      status: 'completed',
      cashbackAwarded: totalCashbackForOrder // Include cashback awarded in response
    }, { status: 201 });

  } catch (error: any) {
    await client.query('ROLLBACK').catch(rbError => console.error('Rollback error:', rbError));
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
