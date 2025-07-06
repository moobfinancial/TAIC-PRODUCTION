import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { validateWalletAddress, NetworkType, SUPPORTED_NETWORKS } from '@/lib/crypto/walletUtils';
import { cryptoWalletService } from '@/lib/crypto/walletService';

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

const AddWalletSchema = z.object({
  walletAddress: z.string().min(1, 'Wallet address is required'),
  walletType: z.enum(['TAIC_PAYOUT', 'ETHEREUM', 'BITCOIN', 'OTHER']).default('TAIC_PAYOUT'),
  network: z.enum(['FANTOM', 'ETHEREUM', 'BITCOIN', 'POLYGON', 'BSC']).default('FANTOM'),
  isActive: z.boolean().default(true)
});

const UpdateWalletSchema = z.object({
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional()
});

interface MerchantWallet {
  id: number;
  merchant_id: string;
  wallet_address: string;
  wallet_type: string;
  network: string;
  is_active: boolean;
  is_verified: boolean;
  verification_date: string | null;
  created_at: string;
  updated_at: string;
  balance?: {
    taicBalance: string;
    nativeBalance: string;
    lastUpdated: string;
  };
}

// GET - Fetch merchant's wallets
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  const { searchParams } = new URL(request.url);
  const includeBalances = searchParams.get('includeBalances') === 'true';
  const network = searchParams.get('network') as NetworkType | null;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    let query = `
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
      WHERE merchant_id = $1
    `;
    
    const queryParams = [merchantId];
    let paramIndex = 2;

    if (network) {
      query += ` AND network = $${paramIndex++}`;
      queryParams.push(network);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, queryParams);

    const wallets: MerchantWallet[] = result.rows.map(row => ({
      id: row.id,
      merchant_id: row.merchant_id,
      wallet_address: row.wallet_address,
      wallet_type: row.wallet_type,
      network: row.network,
      is_active: row.is_active,
      is_verified: row.is_verified,
      verification_date: row.verification_date ? new Date(row.verification_date).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    }));

    // Optionally include balance information
    if (includeBalances && wallets.length > 0) {
      try {
        const addresses = wallets.map(w => w.wallet_address);
        const networks = [...new Set(wallets.map(w => w.network as NetworkType))];
        
        for (const wallet of wallets) {
          try {
            const balances = await cryptoWalletService.getWalletBalances(
              wallet.wallet_address, 
              [wallet.network as NetworkType]
            );
            
            if (balances.length > 0) {
              wallet.balance = {
                taicBalance: balances[0].taicBalance,
                nativeBalance: balances[0].nativeBalance,
                lastUpdated: balances[0].lastUpdated.toISOString()
              };
            }
          } catch (error) {
            console.error(`Error fetching balance for wallet ${wallet.wallet_address}:`, error);
            // Continue without balance info
          }
        }
      } catch (error) {
        console.error('Error fetching wallet balances:', error);
        // Continue without balance info
      }
    }

    return NextResponse.json({
      wallets,
      supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
    });

  } catch (error: any) {
    console.error("Error fetching merchant wallets:", error);
    return NextResponse.json({ error: "Failed to fetch wallets", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Add new wallet
export async function POST(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = AddWalletSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { walletAddress, walletType, network, isActive } = validatedData;

  // Validate wallet address format
  if (!validateWalletAddress(walletAddress, network as NetworkType)) {
    return NextResponse.json({ 
      error: `Invalid wallet address format for ${network} network`,
      walletAddress,
      network
    }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if wallet address already exists
    const existingWalletQuery = `
      SELECT id, merchant_id FROM merchant_wallets 
      WHERE wallet_address = $1
    `;
    const existingResult = await client.query(existingWalletQuery, [walletAddress]);

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      await client.query('ROLLBACK');
      const existingWallet = existingResult.rows[0];
      if (existingWallet.merchant_id === merchantId) {
        return NextResponse.json({ 
          error: 'You have already added this wallet address' 
        }, { status: 400 });
      } else {
        return NextResponse.json({ 
          error: 'This wallet address is already registered to another merchant' 
        }, { status: 400 });
      }
    }

    // If setting as active, deactivate other wallets of the same type
    if (isActive) {
      await client.query(`
        UPDATE merchant_wallets 
        SET is_active = false, updated_at = NOW()
        WHERE merchant_id = $1 AND wallet_type = $2 AND network = $3
      `, [merchantId, walletType, network]);
    }

    // Insert new wallet
    const insertQuery = `
      INSERT INTO merchant_wallets (
        merchant_id, wallet_address, wallet_type, network, is_active, is_verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      merchantId,
      walletAddress,
      walletType,
      network,
      isActive
    ]);

    // Log the wallet addition
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, created_at
      ) VALUES ($1, 'WALLET_ADDED', 0, 'TAIC', 'COMPLETED', $2, NOW())
    `, [
      merchantId,
      `Added ${network} wallet: ${walletAddress.substring(0, 10)}...`
    ]);

    await client.query('COMMIT');

    const newWallet = insertResult.rows[0];

    // Try to get balance information
    let balance: { taicBalance: string; nativeBalance: string; lastUpdated: string; } | undefined = undefined;
    try {
      const balances = await cryptoWalletService.getWalletBalances(
        walletAddress,
        [network as NetworkType]
      );
      if (balances.length > 0) {
        balance = {
          taicBalance: balances[0].taicBalance,
          nativeBalance: balances[0].nativeBalance,
          lastUpdated: balances[0].lastUpdated.toISOString()
        };
      }
    } catch (error) {
      console.error('Error fetching balance for new wallet:', error);
      // Continue without balance info
    }

    const response: MerchantWallet = {
      id: newWallet.id,
      merchant_id: newWallet.merchant_id,
      wallet_address: newWallet.wallet_address,
      wallet_type: newWallet.wallet_type,
      network: newWallet.network,
      is_active: newWallet.is_active,
      is_verified: newWallet.is_verified,
      verification_date: null,
      created_at: new Date(newWallet.created_at).toISOString(),
      updated_at: new Date(newWallet.updated_at).toISOString(),
      balance
    };

    return NextResponse.json({
      success: true,
      message: 'Wallet added successfully',
      wallet: response
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error adding merchant wallet:", error);
    return NextResponse.json({ error: 'Failed to add wallet', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
