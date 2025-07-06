import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { cryptoWalletService } from '@/lib/crypto/walletService';
import { NetworkType } from '@/lib/crypto/walletUtils';

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

const UpdateWalletSchema = z.object({
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional()
});

const VerifyWalletSchema = z.object({
  signedMessage: z.string().min(1, 'Signed message is required'),
  originalMessage: z.string().min(1, 'Original message is required')
});

// GET - Get specific wallet details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ wallet_id: string }> }
) {
  const params = await context.params;
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const walletId = parseInt(params.wallet_id);

  if (isNaN(walletId)) {
    return NextResponse.json({ error: 'Invalid wallet ID' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    const query = `
      SELECT 
        id,
        merchant_id,
        wallet_address,
        wallet_type,
        network,
        is_active,
        is_verified,
        verification_date,
        created_at,
        updated_at
      FROM merchant_wallets
      WHERE id = $1 AND merchant_id = $2
    `;

    const result = await client.query(query, [walletId, merchantId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const wallet = result.rows[0];

    // Get balance information
    let balance = null;
    try {
      const balances = await cryptoWalletService.getWalletBalances(
        wallet.wallet_address, 
        [wallet.network as NetworkType]
      );
      if (balances.length > 0) {
        balance = {
          taicBalance: balances[0].taicBalance,
          nativeBalance: balances[0].nativeBalance,
          lastUpdated: balances[0].lastUpdated.toISOString()
        };
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }

    const walletDetails = {
      id: wallet.id,
      merchant_id: wallet.merchant_id,
      wallet_address: wallet.wallet_address,
      wallet_type: wallet.wallet_type,
      network: wallet.network,
      is_active: wallet.is_active,
      is_verified: wallet.is_verified,
      verification_date: wallet.verification_date ? new Date(wallet.verification_date).toISOString() : null,
      created_at: new Date(wallet.created_at).toISOString(),
      updated_at: new Date(wallet.updated_at).toISOString(),
      balance
    };

    return NextResponse.json(walletDetails);

  } catch (error: any) {
    console.error("Error fetching wallet details:", error);
    return NextResponse.json({ error: "Failed to fetch wallet details", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Update wallet settings
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ wallet_id: string }> }
) {
  const params = await context.params;
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const walletId = parseInt(params.wallet_id);

  if (isNaN(walletId)) {
    return NextResponse.json({ error: 'Invalid wallet ID' }, { status: 400 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = UpdateWalletSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { isActive, isVerified } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if wallet exists and belongs to merchant
    const checkQuery = `
      SELECT id, wallet_type, network, is_active, is_verified
      FROM merchant_wallets
      WHERE id = $1 AND merchant_id = $2
    `;
    const checkResult = await client.query(checkQuery, [walletId, merchantId]);

    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const currentWallet = checkResult.rows[0];

    // If setting as active, deactivate other wallets of the same type
    if (isActive === true && !currentWallet.is_active) {
      await client.query(`
        UPDATE merchant_wallets 
        SET is_active = false, updated_at = NOW()
        WHERE merchant_id = $1 AND wallet_type = $2 AND network = $3 AND id != $4
      `, [merchantId, currentWallet.wallet_type, currentWallet.network, walletId]);
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(isActive);
    }

    if (isVerified !== undefined) {
      updateFields.push(`is_verified = $${paramIndex++}`);
      updateValues.push(isVerified);
      
      if (isVerified) {
        updateFields.push(`verification_date = NOW()`);
      } else {
        updateFields.push(`verification_date = NULL`);
      }
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(walletId, merchantId);

    const updateQuery = `
      UPDATE merchant_wallets 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex++} AND merchant_id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, updateValues);

    // Log the wallet update
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, created_at
      ) VALUES ($1, 'WALLET_UPDATED', 0, 'TAIC', 'COMPLETED', $2, NOW())
    `, [
      merchantId,
      `Updated wallet settings: ${Object.keys(validatedData).join(', ')}`
    ]);

    await client.query('COMMIT');

    const updatedWallet = updateResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Wallet updated successfully',
      wallet: {
        id: updatedWallet.id,
        merchant_id: updatedWallet.merchant_id,
        wallet_address: updatedWallet.wallet_address,
        wallet_type: updatedWallet.wallet_type,
        network: updatedWallet.network,
        is_active: updatedWallet.is_active,
        is_verified: updatedWallet.is_verified,
        verification_date: updatedWallet.verification_date ? new Date(updatedWallet.verification_date).toISOString() : null,
        created_at: new Date(updatedWallet.created_at).toISOString(),
        updated_at: new Date(updatedWallet.updated_at).toISOString()
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error updating wallet:", error);
    return NextResponse.json({ error: 'Failed to update wallet', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// DELETE - Remove wallet
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ wallet_id: string }> }
) {
  const params = await context.params;
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;
  const walletId = parseInt(params.wallet_id);

  if (isNaN(walletId)) {
    return NextResponse.json({ error: 'Invalid wallet ID' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if wallet exists and belongs to merchant
    const checkQuery = `
      SELECT id, wallet_address, is_active
      FROM merchant_wallets
      WHERE id = $1 AND merchant_id = $2
    `;
    const checkResult = await client.query(checkQuery, [walletId, merchantId]);

    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const wallet = checkResult.rows[0];

    // Check if there are pending payout requests using this wallet
    const pendingPayoutsQuery = `
      SELECT COUNT(*) as pending_count
      FROM merchant_payout_requests
      WHERE merchant_id = $1 AND destination_wallet = $2 AND status = 'PENDING'
    `;
    const pendingResult = await client.query(pendingPayoutsQuery, [merchantId, wallet.wallet_address]);
    const pendingCount = parseInt(pendingResult.rows[0].pending_count);

    if (pendingCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Cannot remove wallet with pending payout requests',
        pendingPayouts: pendingCount
      }, { status: 400 });
    }

    // Delete the wallet
    await client.query(`
      DELETE FROM merchant_wallets
      WHERE id = $1 AND merchant_id = $2
    `, [walletId, merchantId]);

    // Log the wallet removal
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, created_at
      ) VALUES ($1, 'WALLET_REMOVED', 0, 'TAIC', 'COMPLETED', $2, NOW())
    `, [
      merchantId,
      `Removed wallet: ${wallet.wallet_address.substring(0, 10)}...`
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Wallet removed successfully',
      walletId: walletId
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error removing wallet:", error);
    return NextResponse.json({ error: 'Failed to remove wallet', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
