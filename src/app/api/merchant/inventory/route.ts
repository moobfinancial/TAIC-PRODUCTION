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

const UpdateInventorySchema = z.object({
  productId: z.string(),
  stockQuantity: z.number().int().min(0),
  reorderLevel: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional()
});

const BulkUpdateInventorySchema = z.object({
  updates: z.array(UpdateInventorySchema).min(1).max(50)
});

interface InventoryItem {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  reservedStock: number; // Stock reserved for pending orders
  availableStock: number; // Current stock minus reserved
  totalSold: number;
  lastSaleDate: string | null;
  status: string;
  needsReorder: boolean;
}

// GET - Fetch merchant inventory
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  const { searchParams } = new URL(request.url);
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
  const outOfStockOnly = searchParams.get('outOfStockOnly') === 'true';

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Get inventory with reserved stock calculations
    let inventoryQuery = `
      WITH reserved_stock AS (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as reserved_quantity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
        WHERE mp.merchant_id = $1 
          AND o.status IN ('pending', 'processing')
        GROUP BY oi.product_id
      ),
      sales_data AS (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          MAX(o.created_at) as last_sale_date
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN merchant_products mp ON oi.product_id = mp.id::TEXT
        WHERE mp.merchant_id = $1 
          AND o.status IN ('delivered', 'shipped')
        GROUP BY oi.product_id
      )
      SELECT 
        mp.id as product_id,
        mp.name as product_name,
        mp.stock_quantity as current_stock,
        COALESCE(mp.reorder_level, 10) as reorder_level,
        COALESCE(rs.reserved_quantity, 0) as reserved_stock,
        (mp.stock_quantity - COALESCE(rs.reserved_quantity, 0)) as available_stock,
        COALESCE(sd.total_sold, 0) as total_sold,
        sd.last_sale_date,
        mp.status,
        (mp.stock_quantity <= COALESCE(mp.reorder_level, 10)) as needs_reorder
      FROM merchant_products mp
      LEFT JOIN reserved_stock rs ON mp.id::TEXT = rs.product_id
      LEFT JOIN sales_data sd ON mp.id::TEXT = sd.product_id
      WHERE mp.merchant_id = $1
    `;

    const queryParams = [merchantId];

    if (lowStockOnly) {
      inventoryQuery += ` AND mp.stock_quantity <= COALESCE(mp.reorder_level, 10) AND mp.stock_quantity > 0`;
    } else if (outOfStockOnly) {
      inventoryQuery += ` AND mp.stock_quantity = 0`;
    }

    inventoryQuery += ` ORDER BY mp.name`;

    const inventoryResult = await client.query(inventoryQuery, queryParams);

    const inventory: InventoryItem[] = inventoryResult.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      currentStock: parseInt(row.current_stock),
      reorderLevel: parseInt(row.reorder_level),
      reservedStock: parseInt(row.reserved_stock),
      availableStock: parseInt(row.available_stock),
      totalSold: parseInt(row.total_sold),
      lastSaleDate: row.last_sale_date ? new Date(row.last_sale_date).toISOString() : null,
      status: row.status,
      needsReorder: row.needs_reorder
    }));

    return NextResponse.json({
      inventory,
      summary: {
        totalProducts: inventory.length,
        lowStockCount: inventory.filter(item => item.needsReorder && item.currentStock > 0).length,
        outOfStockCount: inventory.filter(item => item.currentStock === 0).length,
        totalReservedStock: inventory.reduce((sum, item) => sum + item.reservedStock, 0)
      }
    });

  } catch (error: any) {
    console.error("Error fetching merchant inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Update inventory (single or bulk)
export async function PUT(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  let isBulkUpdate = false;

  try {
    const body = await request.json();
    
    // Check if it's a bulk update or single update
    if (body.updates && Array.isArray(body.updates)) {
      validatedData = BulkUpdateInventorySchema.parse(body);
      isBulkUpdate = true;
    } else {
      validatedData = { updates: [UpdateInventorySchema.parse(body)] };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const results = [];

    for (const update of validatedData.updates) {
      const { productId, stockQuantity, reorderLevel, notes } = update;

      // Verify product ownership
      const ownershipCheck = await client.query(
        'SELECT id, name, stock_quantity FROM merchant_products WHERE id = $1 AND merchant_id = $2',
        [productId, merchantId]
      );

      if (ownershipCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ 
          error: `Product ${productId} not found or not owned by merchant` 
        }, { status: 403 });
      }

      const product = ownershipCheck.rows[0];
      const oldStock = parseInt(product.stock_quantity);

      // Update inventory
      const updateFields = ['stock_quantity = $2', 'updated_at = NOW()'];
      const updateValues = [productId, stockQuantity];
      let paramIndex = 3;

      if (reorderLevel !== undefined) {
        updateFields.push(`reorder_level = $${paramIndex++}`);
        updateValues.push(reorderLevel);
      }

      if (notes !== undefined) {
        updateFields.push(`inventory_notes = $${paramIndex++}`);
        updateValues.push(notes);
      }

      const updateQuery = `
        UPDATE merchant_products 
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND merchant_id = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(merchantId);

      const updateResult = await client.query(updateQuery, updateValues);

      // Log inventory change
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, created_at
        ) VALUES ($1, 'ADJUSTMENT', $2, 'UNITS', 'COMPLETED', $3, NOW())
      `, [
        merchantId,
        stockQuantity - oldStock,
        `Inventory adjustment for ${product.name}: ${oldStock} → ${stockQuantity} units${notes ? ` (${notes})` : ''}`
      ]);

      results.push({
        productId: productId,
        productName: product.name,
        oldStock: oldStock,
        newStock: stockQuantity,
        change: stockQuantity - oldStock,
        success: true
      });
    }

    await client.query('COMMIT');

    return NextResponse.json({
      message: isBulkUpdate ? `Successfully updated ${results.length} products` : 'Inventory updated successfully',
      results: results
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error updating inventory:", error);
    return NextResponse.json({ error: 'Failed to update inventory', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
