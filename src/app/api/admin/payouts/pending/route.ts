import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Admin API Key Validation
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for admin route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

// Pending Payout Interfaces
interface PendingPayoutRequest {
  id: number;
  merchant_id: string;
  merchant_name: string;
  merchant_email: string;
  requested_amount: number;
  currency: string;
  destination_wallet: string;
  destination_network: string;
  status: string;
  created_at: string;
  merchant_available_balance: number;
  merchant_total_sales: number;
  merchant_account_age_days: number;
  risk_score: 'LOW' | 'MEDIUM' | 'HIGH';
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
}

interface PendingPayoutsResponse {
  pending_requests: PendingPayoutRequest[];
  summary: {
    total_pending_amount: number;
    total_pending_count: number;
    high_risk_count: number;
    unverified_merchants_count: number;
    oldest_request_days: number;
  };
  page: number;
  limit: number;
  totalPages: number;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const riskFilter = searchParams.get('risk') || 'all'; // all, low, medium, high
    const verificationFilter = searchParams.get('verification') || 'all'; // all, verified, unverified

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'requested_amount', 'merchant_name', 'risk_score'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clause for filtering
    let whereConditions = ["mpr.status = 'PENDING'"];
    let params: any[] = [];
    let paramIndex = 1;

    // Get pending payout requests with merchant information and risk assessment
    const payoutsQuery = `
      WITH merchant_stats AS (
        SELECT 
          mt.merchant_id,
          COALESCE(SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as available_balance,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_sales,
          COUNT(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN 1 END) as total_orders
        FROM merchant_transactions mt
        GROUP BY mt.merchant_id
      ),
      merchant_risk_assessment AS (
        SELECT 
          u.id as merchant_id,
          CASE 
            WHEN ms.total_sales < 1000 OR EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 < 30 THEN 'HIGH'
            WHEN ms.total_sales < 5000 OR EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 < 90 THEN 'MEDIUM'
            ELSE 'LOW'
          END as risk_score,
          CASE 
            WHEN u.wallet_address IS NOT NULL AND u.email_verified = true THEN 'VERIFIED'
            WHEN u.wallet_address IS NOT NULL OR u.email_verified = true THEN 'PENDING'
            ELSE 'UNVERIFIED'
          END as verification_status
        FROM users u
        LEFT JOIN merchant_stats ms ON u.id = ms.merchant_id
        WHERE u.role = 'MERCHANT'
      )
      SELECT 
        mpr.id,
        mpr.merchant_id,
        u.business_name as merchant_name,
        u.email as merchant_email,
        mpr.requested_amount,
        mpr.currency,
        mpr.destination_wallet,
        mpr.destination_network,
        mpr.status,
        mpr.created_at,
        COALESCE(ms.available_balance, 0) as merchant_available_balance,
        COALESCE(ms.total_sales, 0) as merchant_total_sales,
        EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 as merchant_account_age_days,
        mra.risk_score,
        mra.verification_status
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      LEFT JOIN merchant_stats ms ON mpr.merchant_id = ms.merchant_id
      LEFT JOIN merchant_risk_assessment mra ON mpr.merchant_id = mra.merchant_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const payoutsParams = [...params, limit, offset];
    const payoutsResult = await pool.query(payoutsQuery, payoutsParams);

    // Apply client-side filtering for risk and verification (since these are calculated fields)
    let filteredRequests = payoutsResult.rows;
    
    if (riskFilter !== 'all') {
      filteredRequests = filteredRequests.filter(req => 
        req.risk_score.toLowerCase() === riskFilter.toLowerCase()
      );
    }
    
    if (verificationFilter !== 'all') {
      const verificationStatus = verificationFilter === 'verified' ? 'VERIFIED' : 'UNVERIFIED';
      filteredRequests = filteredRequests.filter(req => 
        req.verification_status === verificationStatus
      );
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merchant_payout_requests mpr
      JOIN users u ON mpr.merchant_id = u.id
      WHERE mpr.status = 'PENDING'
    `;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    // Get summary statistics
    const summaryQuery = `
      WITH pending_stats AS (
        SELECT 
          COALESCE(SUM(mpr.requested_amount), 0) as total_pending_amount,
          COUNT(*) as total_pending_count,
          MIN(mpr.created_at) as oldest_request
        FROM merchant_payout_requests mpr
        WHERE mpr.status = 'PENDING'
      ),
      risk_stats AS (
        SELECT 
          u.id as merchant_id,
          CASE 
            WHEN ms.total_sales < 1000 OR EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 < 30 THEN 'HIGH'
            WHEN ms.total_sales < 5000 OR EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 < 90 THEN 'MEDIUM'
            ELSE 'LOW'
          END as risk_score,
          CASE 
            WHEN u.wallet_address IS NOT NULL AND u.email_verified = true THEN 'VERIFIED'
            ELSE 'UNVERIFIED'
          END as verification_status
        FROM users u
        LEFT JOIN (
          SELECT 
            mt.merchant_id,
            COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_sales
          FROM merchant_transactions mt
          GROUP BY mt.merchant_id
        ) ms ON u.id = ms.merchant_id
        WHERE u.role = 'MERCHANT' 
        AND EXISTS (SELECT 1 FROM merchant_payout_requests mpr WHERE mpr.merchant_id = u.id AND mpr.status = 'PENDING')
      )
      SELECT 
        ps.total_pending_amount,
        ps.total_pending_count,
        EXTRACT(EPOCH FROM (NOW() - ps.oldest_request))/86400 as oldest_request_days,
        COUNT(CASE WHEN rs.risk_score = 'HIGH' THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN rs.verification_status = 'UNVERIFIED' THEN 1 END) as unverified_merchants_count
      FROM pending_stats ps, risk_stats rs
      GROUP BY ps.total_pending_amount, ps.total_pending_count, ps.oldest_request
    `;

    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0] || {
      total_pending_amount: 0,
      total_pending_count: 0,
      oldest_request_days: 0,
      high_risk_count: 0,
      unverified_merchants_count: 0
    };

    const totalPages = Math.ceil(total / limit);

    const response: PendingPayoutsResponse = {
      pending_requests: filteredRequests,
      summary: {
        total_pending_amount: parseFloat(summary.total_pending_amount),
        total_pending_count: parseInt(summary.total_pending_count),
        high_risk_count: parseInt(summary.high_risk_count),
        unverified_merchants_count: parseInt(summary.unverified_merchants_count),
        oldest_request_days: Math.floor(parseFloat(summary.oldest_request_days) || 0)
      },
      page,
      limit,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
