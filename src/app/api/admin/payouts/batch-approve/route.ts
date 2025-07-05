import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { validateAdminApiKey } from '@/lib/adminAuth';

// Batch Payout Approval Interfaces
interface BatchPayoutApprovalRequest {
  payout_ids: number[];
  action: 'approve' | 'reject';
  admin_notes?: string;
  rejection_reason?: string;
}

interface BatchPayoutResult {
  payout_id: number;
  success: boolean;
  message: string;
  error?: string;
}

interface BatchPayoutApprovalResponse {
  success: boolean;
  message: string;
  results: BatchPayoutResult[];
  total_processed: number;
  successful_count: number;
  failed_count: number;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: BatchPayoutApprovalRequest = await request.json();
    const { payout_ids, action, admin_notes, rejection_reason } = body;

    if (!payout_ids || !Array.isArray(payout_ids) || payout_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payout_ids. Must be a non-empty array of numbers.' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting payouts' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent performance issues
    if (payout_ids.length > 50) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 50 payout requests' },
        { status: 400 }
      );
    }

    const results: BatchPayoutResult[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    // Process each payout request individually
    for (const payoutId of payout_ids) {
      try {
        const result = await processSinglePayout(
          payoutId,
          action,
          admin_notes,
          rejection_reason,
          authResult.userId!,
          authResult.username!
        );
        
        results.push(result);
        if (result.success) {
          successfulCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          payout_id: payoutId,
          success: false,
          message: `Failed to process payout ${payoutId}`,
          error: errorMessage
        });
        failedCount++;
      }
    }

    const response: BatchPayoutApprovalResponse = {
      success: successfulCount > 0,
      message: `Batch processing completed. ${successfulCount} successful, ${failedCount} failed.`,
      results,
      total_processed: payout_ids.length,
      successful_count: successfulCount,
      failed_count: failedCount
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing batch payout approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processSinglePayout(
  payoutId: number,
  action: 'approve' | 'reject',
  adminNotes: string | undefined,
  rejectionReason: string | undefined,
  adminUserId: string,
  adminUsername: string
): Promise<BatchPayoutResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Verify the payout request exists and is in PENDING status
    const checkQuery = `
      SELECT 
        mpr.id,
        mpr.merchant_id,
        mpr.requested_amount,
        mpr.currency,
        mpr.destination_wallet,
        mpr.status,
        u.business_name,
        u.email
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      WHERE mpr.id = $1
    `;
    
    const checkResult = await client.query(checkQuery, [payoutId]);
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        payout_id: payoutId,
        success: false,
        message: 'Payout request not found',
        error: 'NOT_FOUND'
      };
    }

    const payoutRequest = checkResult.rows[0];
    
    if (payoutRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return {
        payout_id: payoutId,
        success: false,
        message: `Payout request is already ${payoutRequest.status.toLowerCase()}`,
        error: 'INVALID_STATUS'
      };
    }

    // If approving, verify merchant has sufficient balance
    if (action === 'approve') {
      const balanceQuery = `
        SELECT COALESCE(SUM(amount), 0) as available_balance
        FROM merchant_transactions
        WHERE merchant_id = $1 AND status = 'COMPLETED'
      `;
      
      const balanceResult = await client.query(balanceQuery, [payoutRequest.merchant_id]);
      const availableBalance = parseFloat(balanceResult.rows[0].available_balance);
      
      if (availableBalance < payoutRequest.requested_amount) {
        await client.query('ROLLBACK');
        return {
          payout_id: payoutId,
          success: false,
          message: 'Insufficient merchant balance for payout',
          error: 'INSUFFICIENT_BALANCE'
        };
      }
    }

    // Update payout request status
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updateQuery = `
      UPDATE merchant_payout_requests
      SET 
        status = $1,
        admin_notes = $2,
        rejection_reason = $3,
        approved_by = $4,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const updateParams = [
      newStatus,
      adminNotes || null,
      action === 'reject' ? rejectionReason : null,
      adminUserId,
      payoutId
    ];

    await client.query(updateQuery, updateParams);

    // If approved, create a pending transaction record for the payout
    if (action === 'approve') {
      const transactionQuery = `
        INSERT INTO merchant_transactions (
          merchant_id,
          transaction_type,
          amount,
          currency,
          status,
          description,
          reference_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `;

      const transactionParams = [
        payoutRequest.merchant_id,
        'PAYOUT',
        -Math.abs(payoutRequest.requested_amount), // Negative amount for payout
        payoutRequest.currency,
        'PENDING',
        `Approved payout request #${payoutId} (batch processing)`,
        `payout_${payoutId}`
      ];

      await client.query(transactionQuery, transactionParams);
    }

    // Log admin action in audit trail
    const auditQuery = `
      INSERT INTO admin_audit_log (
        admin_username,
        action,
        target_entity_type,
        target_entity_id,
        details,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;

    const auditDetails = {
      payout_id: payoutId,
      merchant_id: payoutRequest.merchant_id,
      merchant_name: payoutRequest.business_name,
      requested_amount: payoutRequest.requested_amount,
      currency: payoutRequest.currency,
      action: action,
      admin_notes: adminNotes,
      rejection_reason: rejectionReason,
      batch_processing: true
    };

    await client.query(auditQuery, [
      adminUsername,
      `PAYOUT_${action.toUpperCase()}_BATCH`,
      'merchant_payout_request',
      payoutId.toString(),
      JSON.stringify(auditDetails)
    ]);

    await client.query('COMMIT');

    return {
      payout_id: payoutId,
      success: true,
      message: action === 'approve' 
        ? `Payout request #${payoutId} has been approved`
        : `Payout request #${payoutId} has been rejected`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
