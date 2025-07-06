import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

// Admin API Key Validation
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for admin route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

const ApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().max(2000, 'Admin notes cannot exceed 2000 characters').optional(),
  adminId: z.string().min(1, 'Admin ID is required'),
  rejectionReason: z.string().max(1000, 'Rejection reason cannot exceed 1000 characters').optional(),
  setActive: z.boolean().default(true), // Whether to set is_active=true on approval
  notifyMerchant: z.boolean().default(true) // Whether to send notification to merchant
});

const BulkApprovalSchema = z.object({
  productIds: z.array(z.string()).min(1, 'At least one product ID is required').max(100, 'Maximum 100 products can be processed at once'),
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().max(2000, 'Admin notes cannot exceed 2000 characters').optional(),
  adminId: z.string().min(1, 'Admin ID is required'),
  rejectionReason: z.string().max(1000, 'Rejection reason cannot exceed 1000 characters').optional(),
  setActive: z.boolean().default(true),
  notifyMerchant: z.boolean().default(true)
});

interface ApprovalResult {
  productId: string;
  productName: string;
  merchantId: string;
  merchantName: string;
  previousStatus: string;
  newStatus: string;
  success: boolean;
  error?: string;
  processedAt: string;
}

// PUT - Approve or reject a specific product
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ product_id: string }> }
) {
  const params = await context.params;
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = params.product_id;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = ApprovalSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { action, adminNotes, adminId, rejectionReason, setActive, notifyMerchant } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get product details
    const productQuery = `
      SELECT 
        p.id, p.name, p.approval_status, p.is_active, p.merchant_id,
        u.username as merchant_name, u.email as merchant_email, u.business_name
      FROM products p
      LEFT JOIN users u ON p.merchant_id = u.id
      WHERE p.id = $1
    `;
    const productResult = await client.query(productQuery, [productId]);

    if (productResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = productResult.rows[0];

    // Check if product is in pending status
    if (product.approval_status !== 'pending') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Product is not pending approval. Current status: ${product.approval_status}` 
      }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const isActive = action === 'approve' ? setActive : false;

    // Update product status
    const updateQuery = `
      UPDATE products
      SET 
        approval_status = $1,
        is_active = $2,
        admin_review_notes = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING approval_status, is_active, updated_at
    `;

    const updateResult = await client.query(updateQuery, [
      newStatus,
      isActive,
      adminNotes || null,
      productId
    ]);

    // Log the approval/rejection action
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, metadata, created_at
      ) VALUES ($1, $2, 0, 'TAIC', 'COMPLETED', $3, $4, $5, NOW())
    `, [
      product.merchant_id,
      action === 'approve' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
      `Product "${product.name}" ${action}d by admin ${adminId}. ${adminNotes ? 'Notes: ' + adminNotes : ''}${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
      `product_${action}_${productId}_${Date.now()}`,
      JSON.stringify({
        productId,
        productName: product.name,
        action,
        adminId,
        adminNotes: adminNotes || null,
        rejectionReason: rejectionReason || null,
        previousStatus: product.approval_status,
        newStatus,
        setActive: isActive,
        processedAt: new Date().toISOString()
      })
    ]);

    // If approved and merchant has commission rate, create commission transaction
    if (action === 'approve') {
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, 
          reference_id, created_at
        ) VALUES ($1, 'PRODUCT_ACTIVATION', 0, 'TAIC', 'COMPLETED', $2, $3, NOW())
      `, [
        product.merchant_id,
        `Product "${product.name}" activated and ready for sale`,
        `product_activation_${productId}_${Date.now()}`
      ]);
    }

    await client.query('COMMIT');

    const result: ApprovalResult = {
      productId,
      productName: product.name,
      merchantId: product.merchant_id,
      merchantName: product.business_name || product.merchant_name,
      previousStatus: product.approval_status,
      newStatus,
      success: true,
      processedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" ${action}d successfully`,
      result,
      product: {
        id: productId,
        name: product.name,
        approval_status: newStatus,
        is_active: isActive,
        admin_review_notes: adminNotes || null,
        updated_at: updateResult.rows[0].updated_at
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error(`Error ${validatedData?.action}ing product ${productId}:`, error);
    return NextResponse.json({ 
      error: `Failed to ${validatedData?.action} product`, 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Bulk approve or reject multiple products
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = BulkApprovalSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { productIds, action, adminNotes, adminId, rejectionReason, setActive, notifyMerchant } = validatedData;
  const batchId = `BATCH_${action.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get all products that can be processed
    const productsQuery = `
      SELECT 
        p.id, p.name, p.approval_status, p.is_active, p.merchant_id,
        u.username as merchant_name, u.email as merchant_email, u.business_name
      FROM products p
      LEFT JOIN users u ON p.merchant_id = u.id
      WHERE p.id = ANY($1) AND p.approval_status = 'pending'
    `;
    const productsResult = await client.query(productsQuery, [productIds]);

    const foundProducts = new Map(productsResult.rows.map(p => [p.id, p]));
    const results: ApprovalResult[] = [];
    let successCount = 0;
    let failCount = 0;

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const isActive = action === 'approve' ? setActive : false;

    for (const productId of productIds) {
      const product = foundProducts.get(productId);

      if (!product) {
        results.push({
          productId,
          productName: 'Unknown',
          merchantId: 'unknown',
          merchantName: 'Unknown',
          previousStatus: 'unknown',
          newStatus: 'unknown',
          success: false,
          error: 'Product not found or not in pending status',
          processedAt: new Date().toISOString()
        });
        failCount++;
        continue;
      }

      results.push({
        productId,
        productName: product.name,
        merchantId: product.merchant_id,
        merchantName: product.business_name || product.merchant_name,
        previousStatus: product.approval_status,
        newStatus,
        success: true,
        processedAt: new Date().toISOString()
      });
      successCount++;
    }

    // Update all valid products
    if (successCount > 0) {
      const validProductIds = results.filter(r => r.success).map(r => r.productId);
      
      await client.query(`
        UPDATE products
        SET 
          approval_status = $1,
          is_active = $2,
          admin_review_notes = $3,
          updated_at = NOW()
        WHERE id = ANY($4)
      `, [newStatus, isActive, adminNotes || null, validProductIds]);

      // Log bulk action for each merchant
      const merchantGroups = new Map<string, string[]>();
      results.filter(r => r.success).forEach(r => {
        if (!merchantGroups.has(r.merchantId)) {
          merchantGroups.set(r.merchantId, []);
        }
        merchantGroups.get(r.merchantId)!.push(r.productName);
      });

      for (const [merchantId, productNames] of merchantGroups) {
        await client.query(`
          INSERT INTO merchant_transactions (
            merchant_id, transaction_type, amount, currency, status, description, 
            reference_id, metadata, created_at
          ) VALUES ($1, $2, 0, 'TAIC', 'COMPLETED', $3, $4, $5, NOW())
        `, [
          merchantId,
          action === 'approve' ? 'BULK_PRODUCT_APPROVED' : 'BULK_PRODUCT_REJECTED',
          `Bulk ${action}: ${productNames.length} products ${action}d by admin ${adminId}. Products: ${productNames.join(', ')}`,
          `bulk_${action}_${batchId}_${merchantId}`,
          JSON.stringify({
            batchId,
            action,
            adminId,
            adminNotes: adminNotes || null,
            rejectionReason: rejectionReason || null,
            productCount: productNames.length,
            productNames,
            processedAt: new Date().toISOString()
          })
        ]);
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Bulk ${action} completed: ${successCount} products ${action}d, ${failCount} failed`,
      summary: {
        batchId,
        action,
        totalProcessed: productIds.length,
        successfulActions: successCount,
        failedActions: failCount,
        processedAt: new Date().toISOString()
      },
      results
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error(`Error bulk ${validatedData?.action}ing products:`, error);
    return NextResponse.json({ 
      error: `Failed to bulk ${validatedData?.action} products`, 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
