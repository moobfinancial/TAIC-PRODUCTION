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

interface PayoutRequestDetails {
  id: number;
  merchant_id: string;
  requested_amount: number;
  currency: string;
  destination_wallet: string;
  destination_network: string;
  status: string;
  notes?: string;
  admin_notes?: string;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  processed_at?: string;
  transaction_hash?: string;
  net_amount?: number;
  created_at: string;
  updated_at: string;
  merchant_available_balance: number;
  can_cancel: boolean;
}

// GET - Fetch specific payout request details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ payout_id: string }> }
) {
  const params = await context.params;
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const payoutId = parseInt(params.payout_id);

  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Get payout request details with merchant balance
    const query = `
      WITH merchant_balance AS (
        SELECT COALESCE(SUM(amount), 0) as available_balance
        FROM merchant_transactions
        WHERE merchant_id = $1 AND status = 'COMPLETED'
      )
      SELECT 
        mpr.*,
        u.username as approved_by_username,
        mb.available_balance as merchant_available_balance
      FROM merchant_payout_requests mpr
      LEFT JOIN users u ON mpr.approved_by = u.id
      CROSS JOIN merchant_balance mb
      WHERE mpr.id = $2 AND mpr.merchant_id = $1
    `;

    const result = await client.query(query, [merchantId, payoutId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
    }

    const row = result.rows[0];
    const canCancel = row.status === 'PENDING';

    const payoutRequest: PayoutRequestDetails = {
      id: row.id,
      merchant_id: row.merchant_id,
      requested_amount: parseFloat(row.requested_amount),
      currency: row.currency,
      destination_wallet: row.destination_wallet,
      destination_network: row.destination_network,
      status: row.status,
      notes: row.notes,
      admin_notes: row.admin_notes,
      rejection_reason: row.rejection_reason,
      approved_by: row.approved_by_username,
      approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : undefined,
      processed_at: row.processed_at ? new Date(row.processed_at).toISOString() : undefined,
      transaction_hash: row.transaction_hash,
      net_amount: row.net_amount ? parseFloat(row.net_amount) : undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      merchant_available_balance: parseFloat(row.merchant_available_balance),
      can_cancel: canCancel
    };

    return NextResponse.json(payoutRequest);

  } catch (error: any) {
    console.error("Error fetching payout request:", error);
    return NextResponse.json({ error: "Failed to fetch payout request", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// DELETE - Cancel payout request (only if PENDING)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ payout_id: string }> }
) {
  const params = await context.params;
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const payoutId = parseInt(params.payout_id);

  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if payout request exists and is cancellable
    const checkQuery = `
      SELECT id, status, requested_amount, currency
      FROM merchant_payout_requests
      WHERE id = $1 AND merchant_id = $2
    `;

    const checkResult = await client.query(checkQuery, [payoutId, merchantId]);

    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
    }

    const payoutRequest = checkResult.rows[0];

    if (payoutRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Cannot cancel payout request with status: ${payoutRequest.status}`,
        currentStatus: payoutRequest.status
      }, { status: 400 });
    }

    // Update payout request status to CANCELLED
    const updateQuery = `
      UPDATE merchant_payout_requests
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1 AND merchant_id = $2
      RETURNING *
    `;

    await client.query(updateQuery, [payoutId, merchantId]);

    // Update the corresponding merchant transaction
    await client.query(`
      UPDATE merchant_transactions
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE reference_id = $1 AND merchant_id = $2
    `, [`payout_request_${payoutId}`, merchantId]);

    // Log the cancellation
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, created_at
      ) VALUES ($1, 'PAYOUT_CANCELLED', $2, $3, 'COMPLETED', $4, $5, NOW())
    `, [
      merchantId,
      parseFloat(payoutRequest.requested_amount), // Positive amount to restore balance
      payoutRequest.currency,
      `Payout request #${payoutId} cancelled by merchant`,
      `payout_cancel_${payoutId}`
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Payout request cancelled successfully',
      payoutId: payoutId
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error cancelling payout request:", error);
    return NextResponse.json({ error: 'Failed to cancel payout request', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
