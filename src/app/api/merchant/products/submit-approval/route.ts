import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
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

const SubmitApprovalSchema = z.object({
  productIds: z.array(z.string()).min(1, 'At least one product ID is required').max(50, 'Maximum 50 products can be submitted at once'),
  submissionNotes: z.string().max(1000, 'Submission notes cannot exceed 1000 characters').optional()
});

const BulkSubmitApprovalSchema = z.object({
  productIds: z.array(z.string()).min(1, 'At least one product ID is required').max(100, 'Maximum 100 products can be submitted at once'),
  submissionNotes: z.string().max(1000, 'Submission notes cannot exceed 1000 characters').optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL')
});

interface ProductSubmissionResult {
  productId: string;
  productName: string;
  previousStatus: string;
  newStatus: string;
  success: boolean;
  error?: string;
}

interface SubmissionSummary {
  totalSubmitted: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  results: ProductSubmissionResult[];
  submissionId: string;
  submittedAt: string;
}

// POST - Submit products for approval
export async function POST(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = SubmitApprovalSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { productIds, submissionNotes } = validatedData;
  const submissionId = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const results: ProductSubmissionResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const productId of productIds) {
      try {
        // Check if product exists and belongs to merchant
        const productQuery = `
          SELECT id, name, approval_status, is_active
          FROM products
          WHERE id = $1 AND merchant_id = $2
        `;
        const productResult = await client.query(productQuery, [productId, merchantId]);

        if (productResult.rowCount === 0) {
          results.push({
            productId,
            productName: 'Unknown',
            previousStatus: 'unknown',
            newStatus: 'unknown',
            success: false,
            error: 'Product not found or does not belong to merchant'
          });
          failCount++;
          continue;
        }

        const product = productResult.rows[0];

        // Check if product can be submitted for approval
        if (product.approval_status === 'pending') {
          results.push({
            productId,
            productName: product.name,
            previousStatus: product.approval_status,
            newStatus: product.approval_status,
            success: false,
            error: 'Product is already pending approval'
          });
          failCount++;
          continue;
        }

        // Update product status to pending
        const updateQuery = `
          UPDATE products
          SET 
            approval_status = 'pending',
            is_active = false,
            admin_review_notes = NULL,
            updated_at = NOW()
          WHERE id = $1 AND merchant_id = $2
          RETURNING approval_status
        `;

        await client.query(updateQuery, [productId, merchantId]);

        // Log the submission in merchant transactions
        await client.query(`
          INSERT INTO merchant_transactions (
            merchant_id, transaction_type, amount, currency, status, description, 
            reference_id, created_at
          ) VALUES ($1, 'PRODUCT_SUBMISSION', 0, 'TAIC', 'COMPLETED', $2, $3, NOW())
        `, [
          merchantId,
          `Product "${product.name}" submitted for approval. ${submissionNotes ? 'Notes: ' + submissionNotes : ''}`,
          `product_submission_${submissionId}_${productId}`
        ]);

        results.push({
          productId,
          productName: product.name,
          previousStatus: product.approval_status,
          newStatus: 'pending',
          success: true
        });
        successCount++;

      } catch (error: any) {
        console.error(`Error processing product ${productId}:`, error);
        results.push({
          productId,
          productName: 'Unknown',
          previousStatus: 'unknown',
          newStatus: 'unknown',
          success: false,
          error: error.message || 'Unknown error occurred'
        });
        failCount++;
      }
    }

    // Create submission record for tracking
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, metadata, created_at
      ) VALUES ($1, 'BULK_SUBMISSION', 0, 'TAIC', 'COMPLETED', $2, $3, $4, NOW())
    `, [
      merchantId,
      `Bulk product submission: ${successCount} successful, ${failCount} failed`,
      submissionId,
      JSON.stringify({
        submissionId,
        totalProducts: productIds.length,
        successfulSubmissions: successCount,
        failedSubmissions: failCount,
        submissionNotes: submissionNotes || null,
        productIds: productIds
      })
    ]);

    await client.query('COMMIT');

    const summary: SubmissionSummary = {
      totalSubmitted: productIds.length,
      successfulSubmissions: successCount,
      failedSubmissions: failCount,
      results,
      submissionId,
      submittedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `Submission completed: ${successCount} products submitted for approval, ${failCount} failed`,
      summary
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error submitting products for approval:", error);
    return NextResponse.json({ error: 'Failed to submit products for approval', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Bulk submit products for approval with priority
export async function PUT(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = BulkSubmitApprovalSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { productIds, submissionNotes, priority } = validatedData;
  const submissionId = `BULK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get all products that belong to merchant and can be submitted
    const productsQuery = `
      SELECT id, name, approval_status, is_active
      FROM products
      WHERE id = ANY($1) AND merchant_id = $2
    `;
    const productsResult = await client.query(productsQuery, [productIds, merchantId]);

    const foundProducts = new Map(productsResult.rows.map(p => [p.id, p]));
    const results: ProductSubmissionResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const productId of productIds) {
      const product = foundProducts.get(productId);

      if (!product) {
        results.push({
          productId,
          productName: 'Unknown',
          previousStatus: 'unknown',
          newStatus: 'unknown',
          success: false,
          error: 'Product not found or does not belong to merchant'
        });
        failCount++;
        continue;
      }

      if (product.approval_status === 'pending') {
        results.push({
          productId,
          productName: product.name,
          previousStatus: product.approval_status,
          newStatus: product.approval_status,
          success: false,
          error: 'Product is already pending approval'
        });
        failCount++;
        continue;
      }

      results.push({
        productId,
        productName: product.name,
        previousStatus: product.approval_status,
        newStatus: 'pending',
        success: true
      });
      successCount++;
    }

    // Update all valid products to pending status
    if (successCount > 0) {
      const validProductIds = results.filter(r => r.success).map(r => r.productId);
      
      await client.query(`
        UPDATE products
        SET 
          approval_status = 'pending',
          is_active = false,
          admin_review_notes = NULL,
          updated_at = NOW()
        WHERE id = ANY($1) AND merchant_id = $2
      `, [validProductIds, merchantId]);
    }

    // Create bulk submission record
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, metadata, created_at
      ) VALUES ($1, 'BULK_SUBMISSION', 0, 'TAIC', 'COMPLETED', $2, $3, $4, NOW())
    `, [
      merchantId,
      `Bulk product submission (${priority} priority): ${successCount} successful, ${failCount} failed`,
      submissionId,
      JSON.stringify({
        submissionId,
        priority,
        totalProducts: productIds.length,
        successfulSubmissions: successCount,
        failedSubmissions: failCount,
        submissionNotes: submissionNotes || null,
        productIds: productIds,
        submissionType: 'BULK'
      })
    ]);

    await client.query('COMMIT');

    const summary: SubmissionSummary = {
      totalSubmitted: productIds.length,
      successfulSubmissions: successCount,
      failedSubmissions: failCount,
      results,
      submissionId,
      submittedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `Bulk submission completed: ${successCount} products submitted for approval with ${priority} priority, ${failCount} failed`,
      summary,
      priority
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error bulk submitting products for approval:", error);
    return NextResponse.json({ error: 'Failed to bulk submit products for approval', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
