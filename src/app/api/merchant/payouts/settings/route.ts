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

const UpdatePayoutSettingsSchema = z.object({
  minimumPayoutAmount: z.number().positive().min(1).optional(),
  payoutWalletAddress: z.string().min(1).optional(),
  payoutSchedule: z.enum(['MANUAL', 'WEEKLY', 'MONTHLY']).optional(),
  defaultPayoutNetwork: z.string().optional()
});

interface PayoutSettings {
  minimumPayoutAmount: number;
  payoutWalletAddress: string | null;
  payoutSchedule: string;
  defaultPayoutNetwork: string;
  availableBalance: number;
  pendingPayouts: number;
  totalEarnings: number;
  totalPayouts: number;
  lastPayoutDate: string | null;
  canRequestPayout: boolean;
  pendingPayoutRequests: number;
}

// GET - Fetch merchant payout settings and balance
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Get merchant settings and financial summary
    const settingsQuery = `
      WITH merchant_financials AS (
        SELECT 
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_commissions,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'PAYOUT' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_payouts,
          COALESCE(SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as available_balance,
          MAX(CASE WHEN mt.transaction_type = 'PAYOUT' AND mt.status = 'COMPLETED' THEN mt.created_at END) as last_payout_date
        FROM merchant_transactions mt
        WHERE mt.merchant_id = $1
      ),
      pending_payouts AS (
        SELECT 
          COUNT(*) as pending_count,
          COALESCE(SUM(requested_amount), 0) as pending_amount
        FROM merchant_payout_requests
        WHERE merchant_id = $1 AND status = 'PENDING'
      )
      SELECT 
        u.minimum_payout_amount,
        u.payout_wallet_address,
        u.payout_schedule,
        u.default_payout_network,
        mf.total_sales,
        mf.total_commissions,
        mf.total_payouts,
        mf.available_balance,
        mf.last_payout_date,
        pp.pending_count,
        pp.pending_amount
      FROM users u
      CROSS JOIN merchant_financials mf
      CROSS JOIN pending_payouts pp
      WHERE u.id = $1 AND u.role = 'MERCHANT'
    `;

    const result = await client.query(settingsQuery, [merchantId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const data = result.rows[0];
    const availableBalance = parseFloat(data.available_balance);
    const minimumPayoutAmount = parseFloat(data.minimum_payout_amount) || 10;
    const pendingCount = parseInt(data.pending_count);

    const settings: PayoutSettings = {
      minimumPayoutAmount: minimumPayoutAmount,
      payoutWalletAddress: data.payout_wallet_address,
      payoutSchedule: data.payout_schedule || 'MANUAL',
      defaultPayoutNetwork: data.default_payout_network || 'FANTOM',
      availableBalance: availableBalance,
      pendingPayouts: parseFloat(data.pending_amount),
      totalEarnings: parseFloat(data.total_sales) - parseFloat(data.total_commissions),
      totalPayouts: parseFloat(data.total_payouts),
      lastPayoutDate: data.last_payout_date ? new Date(data.last_payout_date).toISOString() : null,
      canRequestPayout: availableBalance >= minimumPayoutAmount && pendingCount === 0,
      pendingPayoutRequests: pendingCount
    };

    return NextResponse.json(settings);

  } catch (error: any) {
    console.error("Error fetching payout settings:", error);
    return NextResponse.json({ error: "Failed to fetch payout settings", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Update merchant payout settings
export async function PUT(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = UpdatePayoutSettingsSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { minimumPayoutAmount, payoutWalletAddress, payoutSchedule, defaultPayoutNetwork } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify merchant exists
    const merchantCheck = await client.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [merchantId, 'MERCHANT']
    );

    if (merchantCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (minimumPayoutAmount !== undefined) {
      updateFields.push(`minimum_payout_amount = $${paramIndex++}`);
      updateValues.push(minimumPayoutAmount);
    }

    if (payoutWalletAddress !== undefined) {
      updateFields.push(`payout_wallet_address = $${paramIndex++}`);
      updateValues.push(payoutWalletAddress);
    }

    if (payoutSchedule !== undefined) {
      updateFields.push(`payout_schedule = $${paramIndex++}`);
      updateValues.push(payoutSchedule);
    }

    if (defaultPayoutNetwork !== undefined) {
      updateFields.push(`default_payout_network = $${paramIndex++}`);
      updateValues.push(defaultPayoutNetwork);
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(merchantId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND role = 'MERCHANT'
      RETURNING minimum_payout_amount, payout_wallet_address, payout_schedule, default_payout_network
    `;

    const updateResult = await client.query(updateQuery, updateValues);

    // Log the settings update
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, created_at
      ) VALUES ($1, 'SETTINGS_UPDATE', 0, 'TAIC', 'COMPLETED', $2, NOW())
    `, [
      merchantId,
      `Payout settings updated: ${Object.keys(validatedData).join(', ')}`
    ]);

    await client.query('COMMIT');

    const updatedSettings = updateResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Payout settings updated successfully',
      settings: {
        minimumPayoutAmount: parseFloat(updatedSettings.minimum_payout_amount),
        payoutWalletAddress: updatedSettings.payout_wallet_address,
        payoutSchedule: updatedSettings.payout_schedule,
        defaultPayoutNetwork: updatedSettings.default_payout_network
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error updating payout settings:", error);
    return NextResponse.json({ error: 'Failed to update payout settings', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
