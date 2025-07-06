import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { cryptoWalletService } from '@/lib/crypto/walletService';
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

const ProcessPayoutSchema = z.object({
  payoutRequestId: z.number().int().positive(),
  adminId: z.string().min(1, 'Admin ID is required'),
  treasuryPrivateKey: z.string().min(1, 'Treasury private key is required for processing'),
  notes: z.string().max(1000).optional()
});

const BatchProcessPayoutsSchema = z.object({
  payoutRequestIds: z.array(z.number().int().positive()).min(1).max(50),
  adminId: z.string().min(1, 'Admin ID is required'),
  treasuryPrivateKey: z.string().min(1, 'Treasury private key is required for processing'),
  notes: z.string().max(1000).optional()
});

interface ProcessedPayout {
  payoutRequestId: number;
  transactionHash?: string;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
  gasUsed?: string;
  blockNumber?: number;
}

// POST - Process individual approved payout request
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = ProcessPayoutSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { payoutRequestId, adminId, treasuryPrivateKey, notes } = validatedData;

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
      WHERE mpr.id = $1 AND mpr.status = 'APPROVED'
    `;

    const payoutResult = await client.query(payoutQuery, [payoutRequestId]);

    if (payoutResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Payout request not found or not in approved status' 
      }, { status: 404 });
    }

    const payoutRequest = payoutResult.rows[0];

    // Initialize crypto wallet service with treasury private key
    cryptoWalletService.initializeTreasuryWallet(treasuryPrivateKey);

    // Validate treasury has sufficient balance
    const balanceCheck = await cryptoWalletService.validateTreasuryBalance(
      payoutRequest.requested_amount,
      payoutRequest.destination_network as NetworkType
    );

    if (!balanceCheck.sufficient) {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        error: 'Insufficient treasury balance for payout',
        required: balanceCheck.required,
        available: balanceCheck.balance,
        network: payoutRequest.destination_network
      }, { status: 400 });
    }

    // Execute the crypto payout
    const payoutTransaction = await cryptoWalletService.executePayout(
      payoutRequestId,
      payoutRequest.merchant_id,
      payoutRequest.destination_wallet,
      payoutRequest.requested_amount,
      payoutRequest.destination_network as NetworkType
    );

    // Update payout request status
    const updateQuery = `
      UPDATE merchant_payout_requests
      SET 
        status = $1,
        processed_at = NOW(),
        transaction_hash = $2,
        net_amount = $3,
        admin_notes = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    await client.query(updateQuery, [
      payoutTransaction.status,
      payoutTransaction.transactionHash,
      payoutTransaction.amount,
      notes || `Processed by admin ${adminId}`,
      payoutRequestId
    ]);

    // Update merchant transaction record
    await client.query(`
      UPDATE merchant_transactions
      SET 
        status = $1,
        description = $2,
        updated_at = NOW()
      WHERE reference_id = $3 AND merchant_id = $4
    `, [
      payoutTransaction.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
      `Crypto payout ${payoutTransaction.status.toLowerCase()}: ${payoutTransaction.transactionHash || 'Failed'}`,
      `payout_approved_${payoutRequestId}`,
      payoutRequest.merchant_id
    ]);

    // Log the processing action
    await client.query(`
      INSERT INTO merchant_transactions (
        merchant_id, transaction_type, amount, currency, status, description, 
        reference_id, created_at
      ) VALUES ($1, 'PAYOUT_PROCESSED', $2, $3, 'COMPLETED', $4, $5, NOW())
    `, [
      payoutRequest.merchant_id,
      payoutTransaction.status === 'COMPLETED' ? -parseFloat(payoutRequest.requested_amount) : 0,
      payoutRequest.currency,
      `Crypto payout processed by admin ${adminId}: ${payoutTransaction.transactionHash || 'Failed'}`,
      `payout_processed_${payoutRequestId}`
    ]);

    await client.query('COMMIT');

    const result: ProcessedPayout = {
      payoutRequestId,
      transactionHash: payoutTransaction.transactionHash,
      status: payoutTransaction.status as 'COMPLETED' | 'FAILED',
      error: payoutTransaction.error,
      gasUsed: payoutTransaction.gasUsed,
      blockNumber: payoutTransaction.blockNumber
    };

    return NextResponse.json({
      success: true,
      message: `Payout ${payoutTransaction.status.toLowerCase()} successfully`,
      result,
      merchantId: payoutRequest.merchant_id,
      merchantName: payoutRequest.merchant_name,
      amount: parseFloat(payoutRequest.requested_amount),
      currency: payoutRequest.currency,
      network: payoutRequest.destination_network
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error(`Error processing payout ${payoutRequestId}:`, error);
    
    // Update payout request to failed status
    try {
      await client?.query(`
        UPDATE merchant_payout_requests
        SET status = 'FAILED', admin_notes = $1, updated_at = NOW()
        WHERE id = $2
      `, [
        `Processing failed: ${error.message}`,
        payoutRequestId
      ]);
    } catch (updateError) {
      console.error('Error updating failed payout status:', updateError);
    }

    return NextResponse.json({ 
      error: 'Failed to process payout', 
      details: error.message,
      payoutRequestId
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Batch process multiple approved payout requests
export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = BatchProcessPayoutsSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { payoutRequestIds, adminId, treasuryPrivateKey, notes } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Get all approved payout requests
    const payoutsQuery = `
      SELECT 
        mpr.*,
        u.username as merchant_name,
        u.email as merchant_email
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      WHERE mpr.id = ANY($1) AND mpr.status = 'APPROVED'
      ORDER BY mpr.created_at ASC
    `;

    const payoutsResult = await client.query(payoutsQuery, [payoutRequestIds]);

    if (payoutsResult.rowCount === 0) {
      return NextResponse.json({ 
        error: 'No approved payout requests found for the provided IDs' 
      }, { status: 404 });
    }

    // Initialize crypto wallet service
    cryptoWalletService.initializeTreasuryWallet(treasuryPrivateKey);

    // Prepare batch payout data
    const batchPayouts = payoutsResult.rows.map(row => ({
      payoutRequestId: row.id,
      merchantId: row.merchant_id,
      toAddress: row.destination_wallet,
      amount: row.requested_amount,
      network: row.destination_network as NetworkType
    }));

    // Execute batch payouts
    const results = await cryptoWalletService.batchProcessPayouts(batchPayouts);

    // Update database records for each payout
    const processedResults: ProcessedPayout[] = [];

    for (const result of results) {
      try {
        await client.query('BEGIN');

        // Update payout request
        await client.query(`
          UPDATE merchant_payout_requests
          SET 
            status = $1,
            processed_at = NOW(),
            transaction_hash = $2,
            net_amount = $3,
            admin_notes = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [
          result.status,
          result.transactionHash,
          result.amount,
          notes || `Batch processed by admin ${adminId}`,
          result.payoutRequestId
        ]);

        // Update merchant transaction
        await client.query(`
          UPDATE merchant_transactions
          SET 
            status = $1,
            description = $2,
            updated_at = NOW()
          WHERE reference_id = $3 AND merchant_id = $4
        `, [
          result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          `Batch crypto payout ${result.status.toLowerCase()}: ${result.transactionHash || 'Failed'}`,
          `payout_approved_${result.payoutRequestId}`,
          result.merchantId
        ]);

        await client.query('COMMIT');

        processedResults.push({
          payoutRequestId: result.payoutRequestId,
          transactionHash: result.transactionHash,
          status: result.status as 'COMPLETED' | 'FAILED',
          error: result.error,
          gasUsed: result.gasUsed,
          blockNumber: result.blockNumber
        });

      } catch (error) {
        await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
        console.error(`Error updating payout ${result.payoutRequestId}:`, error);
        
        processedResults.push({
          payoutRequestId: result.payoutRequestId,
          status: 'FAILED',
          error: `Database update failed: ${error}`
        });
      }
    }

    const successCount = processedResults.filter(r => r.status === 'COMPLETED').length;
    const failureCount = processedResults.filter(r => r.status === 'FAILED').length;

    return NextResponse.json({
      success: true,
      message: `Batch processing completed: ${successCount} successful, ${failureCount} failed`,
      results: processedResults,
      summary: {
        total: processedResults.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error: any) {
    console.error('Error in batch payout processing:', error);
    return NextResponse.json({ 
      error: 'Failed to process batch payouts', 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
