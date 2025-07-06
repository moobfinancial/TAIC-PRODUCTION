import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TreasuryWalletSystem } from '@/lib/treasury/treasuryWalletSystem';

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

const ExecuteTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  executorId: z.string().min(1, 'Executor ID is required'),
  executorAddress: z.string().min(1, 'Executor address is required'),
  confirmationRequired: z.boolean().default(true),
  emergencyOverride: z.boolean().default(false)
});

const BatchExecuteSchema = z.object({
  transactionIds: z.array(z.string()).min(1, 'At least one transaction ID is required').max(10, 'Maximum 10 transactions can be executed at once'),
  executorId: z.string().min(1, 'Executor ID is required'),
  executorAddress: z.string().min(1, 'Executor address is required'),
  confirmationRequired: z.boolean().default(true)
});

const EmergencyLockSchema = z.object({
  treasuryWalletId: z.string().min(1, 'Treasury wallet ID is required'),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason cannot exceed 1000 characters'),
  lockDuration: z.number().int().min(1).max(168).default(24), // Hours, max 1 week
  adminId: z.string().min(1, 'Admin ID is required')
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

// POST - Execute a fully signed multi-signature transaction
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = ExecuteTransactionSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { transactionId, executorId, executorAddress, confirmationRequired, emergencyOverride } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify transaction exists and is ready for execution
    const transactionQuery = `
      SELECT mst.*, tw.wallet_type, tw.network, tw.status as wallet_status, tw.signers
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

    // Verify executor is authorized (must be one of the signers)
    const signers = JSON.parse(transaction.signers);
    if (!emergencyOverride && !signers.includes(executorAddress)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Executor is not authorized to execute this transaction' 
      }, { status: 403 });
    }

    // Check transaction status
    if (!emergencyOverride && transaction.status !== 'FULLY_SIGNED') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: `Transaction is ${transaction.status} and cannot be executed. Required status: FULLY_SIGNED` 
      }, { status: 400 });
    }

    // Check if transaction has expired
    if (new Date() > new Date(transaction.expires_at)) {
      await client.query('ROLLBACK');
      
      // Mark as expired
      await client.query(`
        UPDATE multisig_transactions
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE id = $1
      `, [transactionId]);
      
      return NextResponse.json({ 
        error: 'Transaction has expired and cannot be executed' 
      }, { status: 400 });
    }

    // Check treasury wallet status
    if (transaction.wallet_status === 'EMERGENCY_LOCKED') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Treasury wallet is emergency locked and cannot process transactions' 
      }, { status: 400 });
    }

    // Execute transaction using treasury system
    const executedTx = await treasurySystem.executeMultiSigTransaction(transactionId, executorId);

    // Update transaction in database
    await client.query(`
      UPDATE multisig_transactions
      SET 
        status = $1,
        executed_at = NOW(),
        transaction_hash = $2,
        block_number = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [
      executedTx.status,
      executedTx.transactionHash,
      executedTx.blockNumber,
      transactionId
    ]);

    // Create treasury operation record
    await client.query(`
      INSERT INTO treasury_operations (
        id, operation_type, treasury_wallet_id, multisig_transaction_id, amount, 
        currency, network, status, priority, initiated_by, reason, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    `, [
      `op_${transactionId}_${Date.now()}`,
      transaction.transaction_type === 'PAYOUT' ? 'WITHDRAWAL' : 'TRANSFER',
      transaction.treasury_wallet_id,
      transactionId,
      transaction.amount,
      transaction.currency,
      transaction.network,
      'COMPLETED',
      'NORMAL',
      executorId,
      `Executed multi-sig transaction: ${transaction.reason}`
    ]);

    // Log in audit trail
    await client.query(`
      INSERT INTO treasury_audit_log (
        treasury_wallet_id, action, performed_by, details, created_at
      ) VALUES ($1, 'MULTISIG_TRANSACTION_EXECUTED', $2, $3, NOW())
    `, [
      transaction.treasury_wallet_id,
      executorId,
      JSON.stringify({
        transactionId,
        transactionHash: executedTx.transactionHash,
        blockNumber: executedTx.blockNumber,
        amount: transaction.amount,
        toAddress: transaction.to_address,
        executorAddress,
        emergencyOverride
      })
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Multi-signature transaction executed successfully',
      execution: {
        transactionId: executedTx.id,
        transactionHash: executedTx.transactionHash,
        blockNumber: executedTx.blockNumber,
        status: executedTx.status,
        executedAt: executedTx.executedAt?.toISOString(),
        amount: transaction.amount,
        currency: transaction.currency,
        network: transaction.network,
        fromAddress: transaction.from_address,
        toAddress: transaction.to_address
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error executing multi-signature transaction:", error);
    return NextResponse.json({ error: 'Failed to execute transaction', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Batch execute multiple fully signed transactions
export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = BatchExecuteSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { transactionIds, executorId, executorAddress, confirmationRequired } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const transactionId of transactionIds) {
      try {
        await client.query('BEGIN');

        // Verify transaction
        const transactionQuery = `
          SELECT mst.*, tw.wallet_type, tw.network, tw.status as wallet_status, tw.signers
          FROM multisig_transactions mst
          LEFT JOIN treasury_wallets tw ON mst.treasury_wallet_id = tw.id
          WHERE mst.id = $1 AND mst.status = 'FULLY_SIGNED'
        `;
        const transactionResult = await client.query(transactionQuery, [transactionId]);

        if (transactionResult.rowCount === 0) {
          results.push({
            transactionId,
            success: false,
            error: 'Transaction not found or not ready for execution'
          });
          failureCount++;
          await client.query('ROLLBACK');
          continue;
        }

        const transaction = transactionResult.rows[0];

        // Check authorization
        const signers = JSON.parse(transaction.signers);
        if (!signers.includes(executorAddress)) {
          results.push({
            transactionId,
            success: false,
            error: 'Executor not authorized'
          });
          failureCount++;
          await client.query('ROLLBACK');
          continue;
        }

        // Execute transaction
        const executedTx = await treasurySystem.executeMultiSigTransaction(transactionId, executorId);

        // Update database
        await client.query(`
          UPDATE multisig_transactions
          SET 
            status = $1,
            executed_at = NOW(),
            transaction_hash = $2,
            block_number = $3,
            updated_at = NOW()
          WHERE id = $4
        `, [
          executedTx.status,
          executedTx.transactionHash,
          executedTx.blockNumber,
          transactionId
        ]);

        // Log audit
        await client.query(`
          INSERT INTO treasury_audit_log (
            treasury_wallet_id, action, performed_by, details, created_at
          ) VALUES ($1, 'BATCH_MULTISIG_EXECUTION', $2, $3, NOW())
        `, [
          transaction.treasury_wallet_id,
          executorId,
          JSON.stringify({
            transactionId,
            transactionHash: executedTx.transactionHash,
            batchExecution: true
          })
        ]);

        await client.query('COMMIT');

        results.push({
          transactionId,
          success: true,
          transactionHash: executedTx.transactionHash,
          blockNumber: executedTx.blockNumber
        });
        successCount++;

      } catch (error: any) {
        await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
        results.push({
          transactionId,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch execution completed: ${successCount} successful, ${failureCount} failed`,
      summary: {
        totalTransactions: transactionIds.length,
        successfulExecutions: successCount,
        failedExecutions: failureCount
      },
      results
    });

  } catch (error: any) {
    console.error("Error in batch execution:", error);
    return NextResponse.json({ error: 'Failed to execute batch transactions', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PATCH - Emergency lock treasury wallet
export async function PATCH(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = EmergencyLockSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { treasuryWalletId, reason, lockDuration, adminId } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify treasury wallet exists
    const walletQuery = `
      SELECT id, wallet_type, network, status
      FROM treasury_wallets
      WHERE id = $1
    `;
    const walletResult = await client.query(walletQuery, [treasuryWalletId]);

    if (walletResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Treasury wallet not found' }, { status: 404 });
    }

    const wallet = walletResult.rows[0];

    // Update wallet status to emergency locked
    const unlockAt = new Date(Date.now() + lockDuration * 60 * 60 * 1000); // Convert hours to milliseconds

    await client.query(`
      UPDATE treasury_wallets
      SET 
        status = 'EMERGENCY_LOCKED',
        updated_at = NOW()
      WHERE id = $1
    `, [treasuryWalletId]);

    // Cancel all pending transactions for this wallet
    await client.query(`
      UPDATE multisig_transactions
      SET 
        status = 'CANCELLED',
        reason = 'Emergency lock activated',
        updated_at = NOW()
      WHERE treasury_wallet_id = $1 AND status IN ('PENDING', 'PARTIALLY_SIGNED', 'FULLY_SIGNED')
    `, [treasuryWalletId]);

    // Create emergency lock record
    await client.query(`
      INSERT INTO treasury_emergency_locks (
        treasury_wallet_id, reason, lock_duration_hours, locked_by, locked_at, unlock_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [treasuryWalletId, reason, lockDuration, adminId, unlockAt]);

    // Log in audit trail
    await client.query(`
      INSERT INTO treasury_audit_log (
        treasury_wallet_id, action, performed_by, details, created_at
      ) VALUES ($1, 'EMERGENCY_LOCK_ACTIVATED', $2, $3, NOW())
    `, [
      treasuryWalletId,
      adminId,
      JSON.stringify({
        reason,
        lockDuration,
        unlockAt: unlockAt.toISOString(),
        walletType: wallet.wallet_type,
        network: wallet.network
      })
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Emergency lock activated successfully',
      emergencyLock: {
        treasuryWalletId,
        reason,
        lockDuration,
        lockedAt: new Date().toISOString(),
        unlockAt: unlockAt.toISOString(),
        lockedBy: adminId
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error activating emergency lock:", error);
    return NextResponse.json({ error: 'Failed to activate emergency lock', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
