import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
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

const PayoutApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(500).optional(),
  adminId: z.string().min(1, 'Admin ID is required')
});

interface PayoutApprovalRequest {
  action: 'approve' | 'reject';
  adminNotes?: string;
  rejectionReason?: string;
  adminId: string;
}

// PUT - Approve or reject payout request
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ payout_id: string }> }
) {
  const params = await context.params;
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payoutId = parseInt(params.payout_id);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  let validatedData: PayoutApprovalRequest;
  try {
    const body = await request.json();
    validatedData = PayoutApprovalSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { action, adminNotes, rejectionReason, adminId } = validatedData;

  // Validate rejection reason for reject action
  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json({ 
      error: 'Rejection reason is required when rejecting a payout request' 
    }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get payout request details
    const payoutQuery = `
      SELECT 
        mpr.*,
        u.username as merchant_name,
        u.email as merchant_email
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      WHERE mpr.id = $1
    `;

    const payoutResult = await client.query(payoutQuery, [payoutId]);

    if (payoutResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
    }

    const payoutRequest = payoutResult.rows[0];

    if (payoutRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Cannot ${action} payout request with status: ${payoutRequest.status}`,
        currentStatus: payoutRequest.status
      }, { status: 400 });
    }

    // Verify admin exists (simplified check)
    const adminQuery = `
      SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'
      UNION
      SELECT 'admin' as id WHERE $1 = 'admin'
    `;
    const adminResult = await client.query(adminQuery, [adminId]);

    if (adminResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
    }

    if (action === 'approve') {
      // Verify merchant has sufficient balance
      const balanceQuery = `
        SELECT COALESCE(SUM(amount), 0) as available_balance
        FROM merchant_transactions
        WHERE merchant_id = $1 AND status = 'COMPLETED'
      `;
      const balanceResult = await client.query(balanceQuery, [payoutRequest.merchant_id]);
      const availableBalance = parseFloat(balanceResult.rows[0].available_balance);

      if (availableBalance < parseFloat(payoutRequest.requested_amount)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ 
          error: 'Insufficient merchant balance for payout',
          requestedAmount: parseFloat(payoutRequest.requested_amount),
          availableBalance
        }, { status: 400 });
      }

      // Update payout request to APPROVED
      const updateQuery = `
        UPDATE merchant_payout_requests
        SET 
          status = 'APPROVED',
          approved_by = $1,
          approved_at = NOW(),
          admin_notes = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      await client.query(updateQuery, [adminId, adminNotes || null, payoutId]);

      // Create payout transaction record
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, 
          reference_id, created_at
        ) VALUES ($1, 'PAYOUT', $2, $3, 'APPROVED', $4, $5, NOW())
      `, [
        payoutRequest.merchant_id,
        -parseFloat(payoutRequest.requested_amount), // Negative amount for payout
        payoutRequest.currency,
        `Approved payout request #${payoutId} - ${payoutRequest.destination_network} wallet`,
        `payout_approved_${payoutId}`
      ]);

      // Log admin action
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, 
          reference_id, created_at
        ) VALUES ($1, 'ADMIN_ACTION', 0, 'TAIC', 'COMPLETED', $2, $3, NOW())
      `, [
        payoutRequest.merchant_id,
        `Payout request #${payoutId} approved by admin ${adminId}`,
        `admin_approval_${payoutId}`
      ]);

    } else if (action === 'reject') {
      // Update payout request to REJECTED
      const updateQuery = `
        UPDATE merchant_payout_requests
        SET 
          status = 'REJECTED',
          approved_by = $1,
          approved_at = NOW(),
          rejection_reason = $2,
          admin_notes = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      await client.query(updateQuery, [adminId, rejectionReason, adminNotes || null, payoutId]);

      // Update the corresponding pending transaction to cancelled
      await client.query(`
        UPDATE merchant_transactions
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE reference_id = $1 AND merchant_id = $2
      `, [`payout_request_${payoutId}`, payoutRequest.merchant_id]);

      // Restore the balance by creating a reversal transaction
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, 
          reference_id, created_at
        ) VALUES ($1, 'PAYOUT_REJECTED', $2, $3, 'COMPLETED', $4, $5, NOW())
      `, [
        payoutRequest.merchant_id,
        parseFloat(payoutRequest.requested_amount), // Positive amount to restore balance
        payoutRequest.currency,
        `Rejected payout request #${payoutId} - ${rejectionReason}`,
        `payout_rejected_${payoutId}`
      ]);

      // Log admin action
      await client.query(`
        INSERT INTO merchant_transactions (
          merchant_id, transaction_type, amount, currency, status, description, 
          reference_id, created_at
        ) VALUES ($1, 'ADMIN_ACTION', 0, 'TAIC', 'COMPLETED', $2, $3, NOW())
      `, [
        payoutRequest.merchant_id,
        `Payout request #${payoutId} rejected by admin ${adminId}: ${rejectionReason}`,
        `admin_rejection_${payoutId}`
      ]);
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Payout request ${action}d successfully`,
      payoutId: payoutId,
      action: action,
      merchantId: payoutRequest.merchant_id,
      merchantName: payoutRequest.merchant_name,
      amount: parseFloat(payoutRequest.requested_amount),
      currency: payoutRequest.currency
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error(`Error ${action}ing payout request:`, error);
    return NextResponse.json({ 
      error: `Failed to ${action} payout request`, 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// GET - Get specific payout request details for admin review
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ payout_id: string }> }
) {
  const params = await context.params;
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payoutId = parseInt(params.payout_id);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    const query = `
      WITH merchant_stats AS (
        SELECT 
          mt.merchant_id,
          COALESCE(SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as available_balance,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_sales,
          COUNT(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN 1 END) as total_orders
        FROM merchant_transactions mt
        GROUP BY mt.merchant_id
      )
      SELECT 
        mpr.*,
        u.username as merchant_name,
        u.email as merchant_email,
        u.created_at as merchant_created_at,
        COALESCE(ms.available_balance, 0) as merchant_available_balance,
        COALESCE(ms.total_sales, 0) as merchant_total_sales,
        COALESCE(ms.total_orders, 0) as merchant_total_orders,
        EXTRACT(DAYS FROM NOW() - u.created_at) as merchant_account_age_days,
        admin_user.username as approved_by_name
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      LEFT JOIN merchant_stats ms ON mpr.merchant_id = ms.merchant_id
      LEFT JOIN users admin_user ON mpr.approved_by = admin_user.id
      WHERE mpr.id = $1
    `;

    const result = await client.query(query, [payoutId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
    }

    const row = result.rows[0];

    const payoutDetails = {
      id: row.id,
      merchant_id: row.merchant_id,
      merchant_name: row.merchant_name,
      merchant_email: row.merchant_email,
      merchant_created_at: new Date(row.merchant_created_at).toISOString(),
      merchant_available_balance: parseFloat(row.merchant_available_balance),
      merchant_total_sales: parseFloat(row.merchant_total_sales),
      merchant_total_orders: parseInt(row.merchant_total_orders),
      merchant_account_age_days: parseInt(row.merchant_account_age_days),
      requested_amount: parseFloat(row.requested_amount),
      currency: row.currency,
      destination_wallet: row.destination_wallet,
      destination_network: row.destination_network,
      status: row.status,
      notes: row.notes,
      admin_notes: row.admin_notes,
      rejection_reason: row.rejection_reason,
      approved_by: row.approved_by_name,
      approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      processed_at: row.processed_at ? new Date(row.processed_at).toISOString() : null,
      transaction_hash: row.transaction_hash,
      net_amount: row.net_amount ? parseFloat(row.net_amount) : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    };

    return NextResponse.json(payoutDetails);

  } catch (error: any) {
    console.error("Error fetching payout request details:", error);
    return NextResponse.json({ 
      error: "Failed to fetch payout request details", 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
