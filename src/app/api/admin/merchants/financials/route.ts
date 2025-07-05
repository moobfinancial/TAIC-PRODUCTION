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

// Merchant Financial Overview Interface
interface MerchantFinancialOverview {
  merchant_id: string;
  business_name: string;
  email: string;
  total_sales: number;
  total_commissions: number;
  total_payouts: number;
  available_balance: number;
  pending_payouts: number;
  total_transactions: number;
  last_payout_date: string | null;
  account_status: string;
  payout_wallet_address: string | null;
  payout_schedule: string;
  minimum_payout_amount: number;
}

interface MerchantFinancialsResponse {
  merchants: MerchantFinancialOverview[];
  summary: {
    total_merchants: number;
    total_platform_sales: number;
    total_platform_commissions: number;
    total_pending_payouts: number;
    merchants_with_pending_payouts: number;
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
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, active, inactive
    const sortBy = searchParams.get('sortBy') || 'total_sales';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // Build WHERE clause for filtering
    let whereConditions = ["u.role = 'MERCHANT'"];
    let params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(u.business_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== 'all') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(status === 'active');
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort parameters
    const allowedSortFields = ['business_name', 'total_sales', 'total_commissions', 'available_balance', 'pending_payouts'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'total_sales';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get merchant financial overview with aggregated transaction data
    const merchantsQuery = `
      WITH merchant_financials AS (
        SELECT 
          mt.merchant_id,
          SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END) as total_sales,
          SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END) as total_commissions,
          SUM(CASE WHEN mt.transaction_type = 'PAYOUT' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END) as total_payouts,
          SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END) as available_balance,
          COUNT(*) as total_transactions
        FROM merchant_transactions mt
        GROUP BY mt.merchant_id
      ),
      pending_payouts AS (
        SELECT 
          mpr.merchant_id,
          SUM(mpr.requested_amount) as pending_payouts,
          MAX(mpr.created_at) as last_payout_request
        FROM merchant_payout_requests mpr
        WHERE mpr.status IN ('PENDING', 'APPROVED', 'PROCESSING')
        GROUP BY mpr.merchant_id
      ),
      last_completed_payouts AS (
        SELECT 
          mpr.merchant_id,
          MAX(mpr.completed_at) as last_payout_date
        FROM merchant_payout_requests mpr
        WHERE mpr.status = 'COMPLETED'
        GROUP BY mpr.merchant_id
      )
      SELECT 
        u.id as merchant_id,
        u.business_name,
        u.email,
        COALESCE(mf.total_sales, 0) as total_sales,
        COALESCE(mf.total_commissions, 0) as total_commissions,
        COALESCE(mf.total_payouts, 0) as total_payouts,
        COALESCE(mf.available_balance, 0) as available_balance,
        COALESCE(pp.pending_payouts, 0) as pending_payouts,
        COALESCE(mf.total_transactions, 0) as total_transactions,
        lcp.last_payout_date,
        CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END as account_status,
        u.payout_wallet_address,
        u.payout_schedule,
        u.minimum_payout_amount
      FROM users u
      LEFT JOIN merchant_financials mf ON u.id = mf.merchant_id
      LEFT JOIN pending_payouts pp ON u.id = pp.merchant_id
      LEFT JOIN last_completed_payouts lcp ON u.id = lcp.merchant_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const merchantsParams = [...params, limit, offset];
    const merchantsResult = await pool.query(merchantsQuery, merchantsParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get platform summary statistics
    const summaryQuery = `
      WITH platform_stats AS (
        SELECT 
          COUNT(DISTINCT u.id) as total_merchants,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_platform_sales,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_platform_commissions
        FROM users u
        LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id
        WHERE u.role = 'MERCHANT'
      ),
      pending_stats AS (
        SELECT 
          COALESCE(SUM(mpr.requested_amount), 0) as total_pending_payouts,
          COUNT(DISTINCT mpr.merchant_id) as merchants_with_pending_payouts
        FROM merchant_payout_requests mpr
        WHERE mpr.status IN ('PENDING', 'APPROVED', 'PROCESSING')
      )
      SELECT 
        ps.total_merchants,
        ps.total_platform_sales,
        ps.total_platform_commissions,
        pds.total_pending_payouts,
        pds.merchants_with_pending_payouts
      FROM platform_stats ps, pending_stats pds
    `;

    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];

    const totalPages = Math.ceil(total / limit);

    const response: MerchantFinancialsResponse = {
      merchants: merchantsResult.rows,
      summary: {
        total_merchants: parseInt(summary.total_merchants),
        total_platform_sales: parseFloat(summary.total_platform_sales),
        total_platform_commissions: parseFloat(summary.total_platform_commissions),
        total_pending_payouts: parseFloat(summary.total_pending_payouts),
        merchants_with_pending_payouts: parseInt(summary.merchants_with_pending_payouts)
      },
      page,
      limit,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching merchant financials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
