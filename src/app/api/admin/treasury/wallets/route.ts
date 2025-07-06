import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TreasuryWalletSystem, TreasuryWallet } from '@/lib/treasury/treasuryWalletSystem';
import { NetworkType } from '@/lib/crypto/walletUtils';

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

const CreateTreasuryWalletSchema = z.object({
  walletType: z.enum(['MAIN_TREASURY', 'PAYOUT_RESERVE', 'STAKING_REWARDS', 'EMERGENCY_RESERVE', 'OPERATIONAL']),
  network: z.enum(['FANTOM', 'ETHEREUM', 'POLYGON', 'BSC', 'BITCOIN']),
  signers: z.array(z.string()).min(1, 'At least one signer is required').max(10, 'Maximum 10 signers allowed'),
  requiredSignatures: z.number().int().min(1, 'At least one signature required').max(10, 'Maximum 10 signatures'),
  securityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dailyLimit: z.string().optional(),
  monthlyLimit: z.string().optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional()
});

const UpdateTreasuryWalletSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'EMERGENCY_LOCKED']).optional(),
  dailyLimit: z.string().optional(),
  monthlyLimit: z.string().optional(),
  description: z.string().max(500).optional()
});

// Initialize treasury wallet system with security configuration
const treasurySystem = new TreasuryWalletSystem({
  multiSigEnabled: true,
  hsmConfig: {
    enabled: process.env.HSM_ENABLED === 'true',
    provider: (process.env.HSM_PROVIDER as any) || 'AWS_CLOUDHSM',
    keyId: process.env.HSM_KEY_ID || '',
    region: process.env.HSM_REGION || 'us-east-1'
  },
  emergencyLockEnabled: true,
  dailyLimits: {
    LOW: '10000',
    MEDIUM: '100000',
    HIGH: '1000000',
    CRITICAL: '10000000'
  },
  monthlyLimits: {
    LOW: '100000',
    MEDIUM: '1000000',
    HIGH: '10000000',
    CRITICAL: '100000000'
  },
  riskThresholds: {
    low: 25,
    medium: 50,
    high: 75,
    critical: 90
  },
  complianceRequired: true,
  auditingEnabled: true,
  geofencingEnabled: false,
  allowedRegions: ['US', 'EU', 'CA'],
  timeBasedRestrictions: {
    enabled: false,
    allowedHours: { start: 9, end: 17 },
    timezone: 'UTC'
  }
});

interface TreasuryWalletRecord {
  id: string;
  wallet_type: string;
  network: string;
  address: string;
  is_multi_sig: boolean;
  required_signatures: number;
  total_signers: number;
  signers: string[];
  status: string;
  security_level: string;
  daily_limit: string;
  monthly_limit: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

// GET - Fetch all treasury wallets
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const walletType = searchParams.get('walletType');
  const network = searchParams.get('network');
  const status = searchParams.get('status');
  const securityLevel = searchParams.get('securityLevel');

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Build query with filters
    let whereConditions = ['1=1'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (walletType) {
      whereConditions.push(`wallet_type = $${paramIndex++}`);
      queryParams.push(walletType);
    }

    if (network) {
      whereConditions.push(`network = $${paramIndex++}`);
      queryParams.push(network);
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (securityLevel) {
      whereConditions.push(`security_level = $${paramIndex++}`);
      queryParams.push(securityLevel);
    }

    const whereClause = whereConditions.join(' AND ');

    const walletsQuery = `
      SELECT 
        id,
        wallet_type,
        network,
        address,
        is_multi_sig,
        required_signatures,
        total_signers,
        signers,
        status,
        security_level,
        daily_limit,
        monthly_limit,
        description,
        created_at,
        updated_at
      FROM treasury_wallets
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `;

    const walletsResult = await client.query(walletsQuery, queryParams);

    // Get balance information for each wallet
    const wallets = await Promise.all(walletsResult.rows.map(async (row: TreasuryWalletRecord) => {
      try {
        // In production, this would fetch real balances from blockchain
        const mockBalance = {
          taicBalance: (Math.random() * 1000000).toFixed(2),
          nativeBalance: (Math.random() * 100).toFixed(4),
          lastUpdated: new Date().toISOString()
        };

        return {
          id: row.id,
          walletType: row.wallet_type,
          network: row.network,
          address: row.address,
          isMultiSig: row.is_multi_sig,
          requiredSignatures: row.required_signatures,
          totalSigners: row.total_signers,
          signers: row.signers,
          status: row.status,
          securityLevel: row.security_level,
          dailyLimit: row.daily_limit,
          monthlyLimit: row.monthly_limit,
          description: row.description,
          balance: mockBalance,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        };
      } catch (error) {
        console.error(`Error fetching balance for wallet ${row.id}:`, error);
        return {
          id: row.id,
          walletType: row.wallet_type,
          network: row.network,
          address: row.address,
          isMultiSig: row.is_multi_sig,
          requiredSignatures: row.required_signatures,
          totalSigners: row.total_signers,
          signers: row.signers,
          status: row.status,
          securityLevel: row.security_level,
          dailyLimit: row.daily_limit,
          monthlyLimit: row.monthly_limit,
          description: row.description,
          balance: null,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        };
      }
    }));

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_wallets,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_wallets,
        COUNT(CASE WHEN is_multi_sig = true THEN 1 END) as multi_sig_wallets,
        COUNT(CASE WHEN security_level = 'CRITICAL' THEN 1 END) as critical_wallets,
        COUNT(CASE WHEN status = 'EMERGENCY_LOCKED' THEN 1 END) as locked_wallets
      FROM treasury_wallets
    `;

    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];

    return NextResponse.json({
      wallets,
      summary: {
        totalWallets: parseInt(summary.total_wallets),
        activeWallets: parseInt(summary.active_wallets),
        multiSigWallets: parseInt(summary.multi_sig_wallets),
        criticalWallets: parseInt(summary.critical_wallets),
        lockedWallets: parseInt(summary.locked_wallets)
      },
      filters: {
        walletType: walletType || null,
        network: network || null,
        status: status || null,
        securityLevel: securityLevel || null
      }
    });

  } catch (error: any) {
    console.error("Error fetching treasury wallets:", error);
    return NextResponse.json({ error: "Failed to fetch treasury wallets", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Create new treasury wallet
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = CreateTreasuryWalletSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { walletType, network, signers, requiredSignatures, securityLevel, dailyLimit, monthlyLimit, description } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if wallet type already exists for this network
    const existingWalletQuery = `
      SELECT id FROM treasury_wallets 
      WHERE wallet_type = $1 AND network = $2 AND status != 'INACTIVE'
    `;
    const existingResult = await client.query(existingWalletQuery, [walletType, network]);

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Active ${walletType} wallet already exists for ${network} network` 
      }, { status: 400 });
    }

    // Create treasury wallet using the treasury system
    const treasuryWallet = await treasurySystem.createTreasuryWallet(
      walletType,
      network as NetworkType,
      signers,
      requiredSignatures,
      securityLevel
    );

    // Store in database
    const insertQuery = `
      INSERT INTO treasury_wallets (
        id, wallet_type, network, address, is_multi_sig, required_signatures, 
        total_signers, signers, status, security_level, daily_limit, monthly_limit, 
        description, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      treasuryWallet.id,
      treasuryWallet.walletType,
      treasuryWallet.network,
      treasuryWallet.address,
      treasuryWallet.isMultiSig,
      treasuryWallet.requiredSignatures,
      treasuryWallet.totalSigners,
      JSON.stringify(treasuryWallet.signers),
      treasuryWallet.status,
      treasuryWallet.securityLevel,
      dailyLimit || treasuryWallet.dailyLimit,
      monthlyLimit || treasuryWallet.monthlyLimit,
      description || null
    ]);

    // Log the creation in audit trail
    await client.query(`
      INSERT INTO treasury_audit_log (
        treasury_wallet_id, action, performed_by, details, created_at
      ) VALUES ($1, 'WALLET_CREATED', 'ADMIN', $2, NOW())
    `, [
      treasuryWallet.id,
      JSON.stringify({
        walletType,
        network,
        signers: signers.length,
        requiredSignatures,
        securityLevel,
        address: treasuryWallet.address
      })
    ]);

    await client.query('COMMIT');

    const newWallet = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Treasury wallet created successfully',
      wallet: {
        id: newWallet.id,
        walletType: newWallet.wallet_type,
        network: newWallet.network,
        address: newWallet.address,
        isMultiSig: newWallet.is_multi_sig,
        requiredSignatures: newWallet.required_signatures,
        totalSigners: newWallet.total_signers,
        signers: JSON.parse(newWallet.signers),
        status: newWallet.status,
        securityLevel: newWallet.security_level,
        dailyLimit: newWallet.daily_limit,
        monthlyLimit: newWallet.monthly_limit,
        description: newWallet.description,
        createdAt: newWallet.created_at.toISOString(),
        updatedAt: newWallet.updated_at.toISOString()
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error creating treasury wallet:", error);
    return NextResponse.json({ error: 'Failed to create treasury wallet', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
