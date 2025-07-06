import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TreasuryWalletSystem } from '@/lib/treasury/treasuryWalletSystem';
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

const CreateMultiSigTransactionSchema = z.object({
  treasuryWalletId: z.string().min(1, 'Treasury wallet ID is required'),
  transactionType: z.enum(['PAYOUT', 'TRANSFER', 'EMERGENCY', 'MAINTENANCE', 'REBALANCE']),
  toAddress: z.string().min(1, 'Destination address is required'),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().default('TAIC'),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason cannot exceed 1000 characters'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  metadata: z.any().optional()
});

const SignTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  signerId: z.string().min(1, 'Signer ID is required'),
  signerAddress: z.string().min(1, 'Signer address is required'),
  privateKey: z.string().min(1, 'Private key is required for signing'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

const ExecuteTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  executorId: z.string().min(1, 'Executor ID is required')
});

// Initialize treasury wallet system
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

// GET - Fetch multi-signature transactions
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const treasuryWalletId = searchParams.get('treasuryWalletId');
  const transactionType = searchParams.get('transactionType');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Build query with filters
    let whereConditions = ['1=1'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (treasuryWalletId) {
      whereConditions.push(`treasury_wallet_id = $${paramIndex++}`);
      queryParams.push(treasuryWalletId);
    }

    if (transactionType) {
      whereConditions.push(`transaction_type = $${paramIndex++}`);
      queryParams.push(transactionType);
    }

    const whereClause = whereConditions.join(' AND ');

    const transactionsQuery = `
      SELECT 
        mst.*,
        tw.wallet_type,
        tw.network,
        tw.required_signatures,
        tw.total_signers
      FROM multisig_transactions mst
      LEFT JOIN treasury_wallets tw ON mst.treasury_wallet_id = tw.id
      WHERE ${whereClause}
      ORDER BY mst.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    queryParams.push(limit, offset);

    const transactionsResult = await client.query(transactionsQuery, queryParams);

    // Get signatures for each transaction
    const transactions = await Promise.all(transactionsResult.rows.map(async (row) => {
      const signaturesQuery = `
        SELECT signer_id, signer_address, signature, signed_at, ip_address, user_agent
        FROM multisig_signatures
        WHERE transaction_id = $1
        ORDER BY signed_at ASC
      `;
      const signaturesResult = await client!.query(signaturesQuery, [row.id]);

      return {
        id: row.id,
        treasuryWalletId: row.treasury_wallet_id,
        walletType: row.wallet_type,
        network: row.network,
        transactionType: row.transaction_type,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        requiredSignatures: row.required_signatures,
        currentSignatures: row.current_signatures,
        signatures: signaturesResult.rows.map(sig => ({
          signerId: sig.signer_id,
          signerAddress: sig.signer_address,
          signature: sig.signature,
          signedAt: sig.signed_at.toISOString(),
          ipAddress: sig.ip_address,
          userAgent: sig.user_agent
        })),
        nonce: row.nonce,
        gasLimit: row.gas_limit,
        gasPrice: row.gas_price,
        expiresAt: row.expires_at.toISOString(),
        createdBy: row.created_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        executedAt: row.executed_at ? row.executed_at.toISOString() : null,
        transactionHash: row.transaction_hash,
        blockNumber: row.block_number,
        reason: row.reason,
        metadata: row.metadata
      };
    }));

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status = 'PARTIALLY_SIGNED' THEN 1 END) as partially_signed,
        COUNT(CASE WHEN status = 'FULLY_SIGNED' THEN 1 END) as fully_signed,
        COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as executed_transactions,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_transactions,
        COUNT(CASE WHEN expires_at < NOW() AND status IN ('PENDING', 'PARTIALLY_SIGNED') THEN 1 END) as expiring_soon
      FROM multisig_transactions
    `;

    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM multisig_transactions mst
      LEFT JOIN treasury_wallets tw ON mst.treasury_wallet_id = tw.id
      WHERE ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      transactions,
      summary: {
        totalTransactions: parseInt(summary.total_transactions),
        pendingTransactions: parseInt(summary.pending_transactions),
        partiallySigned: parseInt(summary.partially_signed),
        fullySigned: parseInt(summary.fully_signed),
        executedTransactions: parseInt(summary.executed_transactions),
        expiredTransactions: parseInt(summary.expired_transactions),
        expiringSoon: parseInt(summary.expiring_soon)
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      filters: {
        status: status || null,
        treasuryWalletId: treasuryWalletId || null,
        transactionType: transactionType || null
      }
    });

  } catch (error: any) {
    console.error("Error fetching multi-signature transactions:", error);
    return NextResponse.json({ error: "Failed to fetch multi-signature transactions", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Create new multi-signature transaction
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = CreateMultiSigTransactionSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { treasuryWalletId, transactionType, toAddress, amount, currency, reason, priority, metadata } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify treasury wallet exists and is active
    const walletQuery = `
      SELECT id, wallet_type, network, status, required_signatures, total_signers, signers
      FROM treasury_wallets
      WHERE id = $1
    `;
    const walletResult = await client.query(walletQuery, [treasuryWalletId]);

    if (walletResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Treasury wallet not found' }, { status: 404 });
    }

    const treasuryWallet = walletResult.rows[0];

    if (treasuryWallet.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Treasury wallet is ${treasuryWallet.status} and cannot process transactions` 
      }, { status: 400 });
    }

    // Create multi-signature transaction using treasury system
    const multiSigTx = await treasurySystem.createMultiSigTransaction(
      treasuryWalletId,
      transactionType,
      toAddress,
      amount,
      currency,
      reason,
      'ADMIN', // createdBy
      metadata
    );

    // Store in database
    const insertQuery = `
      INSERT INTO multisig_transactions (
        id, treasury_wallet_id, transaction_type, from_address, to_address, amount, 
        currency, network, status, required_signatures, current_signatures, 
        nonce, gas_limit, gas_price, expires_at, created_by, reason, metadata, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      multiSigTx.id,
      multiSigTx.treasuryWalletId,
      multiSigTx.transactionType,
      multiSigTx.fromAddress,
      multiSigTx.toAddress,
      multiSigTx.amount,
      multiSigTx.currency,
      multiSigTx.network,
      multiSigTx.status,
      multiSigTx.requiredSignatures,
      multiSigTx.currentSignatures,
      multiSigTx.nonce,
      multiSigTx.gasLimit,
      multiSigTx.gasPrice,
      multiSigTx.expiresAt,
      multiSigTx.createdBy,
      multiSigTx.reason,
      JSON.stringify(multiSigTx.metadata || {})
    ]);

    // Log in audit trail
    await client.query(`
      INSERT INTO treasury_audit_log (
        treasury_wallet_id, action, performed_by, details, created_at
      ) VALUES ($1, 'MULTISIG_TRANSACTION_CREATED', 'ADMIN', $2, NOW())
    `, [
      treasuryWalletId,
      JSON.stringify({
        transactionId: multiSigTx.id,
        transactionType,
        amount,
        toAddress,
        reason,
        priority
      })
    ]);

    await client.query('COMMIT');

    const newTransaction = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Multi-signature transaction created successfully',
      transaction: {
        id: newTransaction.id,
        treasuryWalletId: newTransaction.treasury_wallet_id,
        transactionType: newTransaction.transaction_type,
        fromAddress: newTransaction.from_address,
        toAddress: newTransaction.to_address,
        amount: newTransaction.amount,
        currency: newTransaction.currency,
        network: newTransaction.network,
        status: newTransaction.status,
        requiredSignatures: newTransaction.required_signatures,
        currentSignatures: newTransaction.current_signatures,
        expiresAt: newTransaction.expires_at.toISOString(),
        createdBy: newTransaction.created_by,
        reason: newTransaction.reason,
        createdAt: newTransaction.created_at.toISOString()
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error creating multi-signature transaction:", error);
    return NextResponse.json({ error: 'Failed to create multi-signature transaction', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Sign a multi-signature transaction
export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = SignTransactionSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { transactionId, signerId, signerAddress, privateKey, ipAddress, userAgent } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify transaction exists and can be signed
    const transactionQuery = `
      SELECT mst.*, tw.signers
      FROM multisig_transactions mst
      LEFT JOIN treasury_wallets tw ON mst.treasury_wallet_id = tw.id
      WHERE mst.id = $1
    `;
    const transactionResult = await client.query(transactionQuery, [transactionId]);

    if (transactionResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Multi-signature transaction not found' }, { status: 404 });
    }

    const transaction = transactionResult.rows[0];

    if (!['PENDING', 'PARTIALLY_SIGNED'].includes(transaction.status)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Transaction is ${transaction.status} and cannot be signed` 
      }, { status: 400 });
    }

    // Sign transaction using treasury system
    const signedTx = await treasurySystem.signMultiSigTransaction(
      transactionId,
      signerId,
      signerAddress,
      privateKey,
      ipAddress,
      userAgent
    );

    // Update transaction in database
    await client.query(`
      UPDATE multisig_transactions
      SET 
        status = $1,
        current_signatures = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [signedTx.status, signedTx.currentSignatures, transactionId]);

    // Store signature
    await client.query(`
      INSERT INTO multisig_signatures (
        transaction_id, signer_id, signer_address, signature, signed_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)
    `, [
      transactionId,
      signerId,
      signerAddress,
      signedTx.signatures[signedTx.signatures.length - 1].signature,
      ipAddress,
      userAgent
    ]);

    // Log in audit trail
    await client.query(`
      INSERT INTO treasury_audit_log (
        treasury_wallet_id, action, performed_by, details, created_at
      ) VALUES ($1, 'MULTISIG_TRANSACTION_SIGNED', $2, $3, NOW())
    `, [
      transaction.treasury_wallet_id,
      signerId,
      JSON.stringify({
        transactionId,
        signerAddress,
        currentSignatures: signedTx.currentSignatures,
        requiredSignatures: signedTx.requiredSignatures,
        status: signedTx.status
      })
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Transaction signed successfully',
      transaction: {
        id: signedTx.id,
        status: signedTx.status,
        currentSignatures: signedTx.currentSignatures,
        requiredSignatures: signedTx.requiredSignatures,
        readyForExecution: signedTx.status === 'FULLY_SIGNED'
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error signing multi-signature transaction:", error);
    return NextResponse.json({ error: 'Failed to sign transaction', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
