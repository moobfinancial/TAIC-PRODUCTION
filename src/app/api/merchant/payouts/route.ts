import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { validateWalletAddress, NetworkType, getMinimumPayoutAmount } from '@/lib/crypto/walletUtils';
import { cryptoWalletService } from '@/lib/crypto/walletService';

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

const CreatePayoutRequestSchema = z.object({
  requestedAmount: z.number().positive().min(1, 'Amount must be positive'),
  currency: z.string().default('TAIC'),
  destinationWallet: z.string().min(1, 'Destination wallet address is required'),
  destinationNetwork: z.enum(['FANTOM', 'ETHEREUM', 'BITCOIN', 'POLYGON', 'BSC']).default('FANTOM'),
  notes: z.string().max(500).optional(),
  useRegisteredWallet: z.boolean().default(false),
  registeredWalletId: z.number().optional()
});

interface PayoutRequest {
  id: number;
  merchant_id: string;
  requested_amount: number;
  currency: string;
  destination_wallet: string;
  destination_network: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
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
}

// GET - Fetch merchant's payout requests
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status');

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    let query = `
      SELECT 
        mpr.*,
        u.username as approved_by_username
      FROM merchant_payout_requests mpr
      LEFT JOIN users u ON mpr.approved_by = u.id
      WHERE mpr.merchant_id = $1
    `;
    
    const queryParams = [merchantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND mpr.status = $${paramIndex++}`;
      queryParams.push(status);
    }

    query += ` ORDER BY mpr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push(limit.toString(), offset.toString());

    const result = await client.query(query, queryParams);

    const payoutRequests: PayoutRequest[] = result.rows.map(row => ({
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
      updated_at: new Date(row.updated_at).toISOString()
    }));

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merchant_payout_requests
      WHERE merchant_id = $1 ${status ? 'AND status = $2' : ''}
    `;
    const countParams = status ? [merchantId, status] : [merchantId];
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      payoutRequests,
      pagination: {
        limit,
        offset,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error("Error fetching payout requests:", error);
    return NextResponse.json({ error: "Failed to fetch payout requests", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Create new payout request
export async function POST(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = CreatePayoutRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { requestedAmount, currency, destinationWallet, destinationNetwork, notes, useRegisteredWallet, registeredWalletId } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Validate destination wallet address
    if (!validateWalletAddress(destinationWallet, destinationNetwork as NetworkType)) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Invalid wallet address format for ${destinationNetwork} network`,
        destinationWallet,
        destinationNetwork
      }, { status: 400 });
    }

    // Check network-specific minimum payout amount
    const networkMinimum = getMinimumPayoutAmount(destinationNetwork as NetworkType);
    if (requestedAmount < networkMinimum) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Minimum payout amount for ${destinationNetwork} is ${networkMinimum} ${currency}`,
        minimumAmount: networkMinimum,
        network: destinationNetwork
      }, { status: 400 });
    }

    // If using registered wallet, validate it belongs to merchant
    let finalDestinationWallet = destinationWallet;
    let finalDestinationNetwork = destinationNetwork;

    if (useRegisteredWallet && registeredWalletId) {
      const walletQuery = `
        SELECT wallet_address, network, is_active, is_verified
        FROM merchant_wallets
        WHERE id = $1 AND merchant_id = $2
      `;
      const walletResult = await client.query(walletQuery, [registeredWalletId, merchantId]);

      if (walletResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: 'Registered wallet not found or does not belong to you'
        }, { status: 404 });
      }

      const registeredWallet = walletResult.rows[0];
      if (!registeredWallet.is_active) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: 'Selected wallet is not active'
        }, { status: 400 });
      }

      finalDestinationWallet = registeredWallet.wallet_address;
      finalDestinationNetwork = registeredWallet.network;
    }

    // Get merchant settings and available balance
    const merchantQuery = `
      SELECT 
        u.minimum_payout_amount,
        u.payout_wallet_address,
        u.payout_schedule,
        COALESCE(SUM(mt.amount), 0) as available_balance
      FROM users u
      LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id AND mt.status = 'COMPLETED'
      WHERE u.id = $1 AND u.role = 'MERCHANT'
      GROUP BY u.id, u.minimum_payout_amount, u.payout_wallet_address, u.payout_schedule
    `;
    
    const merchantResult = await client.query(merchantQuery, [merchantId]);
    
    if (merchantResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const merchantData = merchantResult.rows[0];
    const availableBalance = parseFloat(merchantData.available_balance);
    const minimumPayoutAmount = parseFloat(merchantData.minimum_payout_amount) || 10;

    // Validate payout request
    if (requestedAmount < minimumPayoutAmount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Minimum payout amount is ${minimumPayoutAmount} ${currency}`,
        minimumAmount: minimumPayoutAmount
      }, { status: 400 });
    }

    if (requestedAmount > availableBalance) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Insufficient balance for payout request',
        requestedAmount,
        availableBalance
      }, { status: 400 });
    }

    // Check for pending payout requests
    const pendingQuery = `
      SELECT COUNT(*) as pending_count
      FROM merchant_payout_requests
      WHERE merchant_id = $1 AND status = 'PENDING'
    `;
    const pendingResult = await client.query(pendingQuery, [merchantId]);
    const pendingCount = parseInt(pendingResult.rows[0].pending_count);

    if (pendingCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'You already have a pending payout request. Please wait for it to be processed.',
        pendingCount
      }, { status: 400 });
    }

    // Create payout request
    const insertQuery = `
      INSERT INTO merchant_payout_requests (
        merchant_id, requested_amount, currency, destination_wallet, 
        destination_network, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, NOW(), NOW())
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      merchantId,
      requestedAmount,
      currency,
      finalDestinationWallet,
      finalDestinationNetwork,
      notes || null
    ]);

    const newPayoutRequest = insertResult.rows[0];

    // Log the payout request in merchant transactions for audit trail
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, created_at
      ) VALUES ($1, 'PAYOUT_REQUEST', $2, $3, 'PENDING', $4, $5, NOW())
    `, [
      merchantId,
      -requestedAmount, // Negative amount to show it's a pending outflow
      currency,
      `Payout request #${newPayoutRequest.id} - ${destinationNetwork} wallet`,
      `payout_request_${newPayoutRequest.id}`
    ]);

    await client.query('COMMIT');

    const response: PayoutRequest = {
      id: newPayoutRequest.id,
      merchant_id: newPayoutRequest.merchant_id,
      requested_amount: parseFloat(newPayoutRequest.requested_amount),
      currency: newPayoutRequest.currency,
      destination_wallet: newPayoutRequest.destination_wallet,
      destination_network: newPayoutRequest.destination_network,
      status: newPayoutRequest.status,
      notes: newPayoutRequest.notes,
      created_at: new Date(newPayoutRequest.created_at).toISOString(),
      updated_at: new Date(newPayoutRequest.updated_at).toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Payout request created successfully',
      payoutRequest: response
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error creating payout request:", error);
    return NextResponse.json({ error: 'Failed to create payout request', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
