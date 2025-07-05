import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { validateAdminApiKey } from '@/lib/adminAuth';

// Payout Approval Interfaces
interface PayoutApprovalRequest {
  action: 'approve' | 'reject';
  admin_notes?: string;
  rejection_reason?: string;
}

interface PayoutApprovalResponse {
  success: boolean;
  message: string;
  payout_id: number;
  new_status: string;
  processed_by: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { payout_id: string } }
) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payoutId = parseInt(params.payout_id);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  try {
    const body: PayoutApprovalRequest = await request.json();
    const { action, admin_notes, rejection_reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a payout' },
        { status: 400 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // First, verify the payout request exists and is in PENDING status
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
        return NextResponse.json(
          { error: 'Payout request not found' },
          { status: 404 }
        );
      }

      const payoutRequest = checkResult.rows[0];
      
      if (payoutRequest.status !== 'PENDING') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Payout request is already ${payoutRequest.status.toLowerCase()}` },
          { status: 400 }
        );
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
          return NextResponse.json(
            { 
              error: 'Insufficient merchant balance for payout',
              details: {
                requested: payoutRequest.requested_amount,
                available: availableBalance
              }
            },
            { status: 400 }
          );
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
        admin_notes || null,
        action === 'reject' ? rejection_reason : null,
        authResult.userId,
        payoutId
      ];

      const updateResult = await client.query(updateQuery, updateParams);
      const updatedPayout = updateResult.rows[0];

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
          `Approved payout request #${payoutId}`,
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
        admin_notes: admin_notes,
        rejection_reason: rejection_reason
      };

      await client.query(auditQuery, [
        authResult.username,
        `PAYOUT_${action.toUpperCase()}`,
        'merchant_payout_request',
        payoutId.toString(),
        JSON.stringify(auditDetails)
      ]);

      await client.query('COMMIT');

      const response: PayoutApprovalResponse = {
        success: true,
        message: action === 'approve' 
          ? `Payout request #${payoutId} has been approved and will be processed shortly`
          : `Payout request #${payoutId} has been rejected`,
        payout_id: payoutId,
        new_status: newStatus,
        processed_by: authResult.username || 'Unknown Admin'
      };

      return NextResponse.json(response);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error processing payout approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve payout details for review
export async function GET(
  request: NextRequest,
  { params }: { params: { payout_id: string } }
) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const authResult = await validateAdminApiKey(apiKey);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payoutId = parseInt(params.payout_id);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
  }

  try {
    const query = `
      SELECT 
        mpr.*,
        u.business_name,
        u.email,
        u.created_at as merchant_created_at,
        COALESCE(SUM(mt.amount), 0) as merchant_available_balance,
        COUNT(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN 1 END) as total_completed_sales
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      LEFT JOIN merchant_transactions mt ON mpr.merchant_id = mt.merchant_id AND mt.status = 'COMPLETED'
      WHERE mpr.id = $1
      GROUP BY mpr.id, u.business_name, u.email, u.created_at
    `;

    const result = await pool.query(query, [payoutId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Payout request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching payout details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
