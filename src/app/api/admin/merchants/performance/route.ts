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

// Merchant Performance Interfaces
interface MerchantPerformanceMetrics {
  merchant_id: string;
  business_name: string;
  email: string;
  total_sales: number;
  total_orders: number;
  average_order_value: number;
  total_commissions_paid: number;
  total_payouts: number;
  current_balance: number;
  conversion_rate: number;
  customer_satisfaction: number;
  account_age_days: number;
  last_sale_date: string | null;
  performance_score: number;
  performance_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  growth_trend: 'GROWING' | 'STABLE' | 'DECLINING';
}

interface PlatformPerformanceOverview {
  total_active_merchants: number;
  total_platform_sales: number;
  total_platform_commissions: number;
  average_merchant_performance_score: number;
  top_performing_merchants: number;
  underperforming_merchants: number;
  new_merchants_this_month: number;
  merchant_retention_rate: number;
}

interface MerchantPerformanceResponse {
  merchants: MerchantPerformanceMetrics[];
  platform_overview: PlatformPerformanceOverview;
  performance_trends: {
    sales_growth_30d: number;
    commission_growth_30d: number;
    new_merchant_growth_30d: number;
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
    const sortBy = searchParams.get('sortBy') || 'performance_score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const tierFilter = searchParams.get('tier') || 'all'; // all, bronze, silver, gold, platinum
    const trendFilter = searchParams.get('trend') || 'all'; // all, growing, stable, declining

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortFields = ['performance_score', 'total_sales', 'total_orders', 'business_name', 'account_age_days'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'performance_score';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE clause for filtering
    let whereConditions = ["u.role = 'MERCHANT'", "u.is_active = true"];
    let params: any[] = [];
    let paramIndex = 1;

    // Get merchant performance metrics
    const merchantsQuery = `
      WITH merchant_stats AS (
        SELECT 
          mt.merchant_id,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_sales,
          COUNT(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN 1 END) as total_orders,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_commissions_paid,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'PAYOUT' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_payouts,
          COALESCE(SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as current_balance,
          MAX(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.created_at END) as last_sale_date
        FROM merchant_transactions mt
        GROUP BY mt.merchant_id
      ),
      merchant_performance AS (
        SELECT 
          u.id as merchant_id,
          u.business_name,
          u.email,
          u.created_at,
          COALESCE(ms.total_sales, 0) as total_sales,
          COALESCE(ms.total_orders, 0) as total_orders,
          CASE 
            WHEN ms.total_orders > 0 THEN ms.total_sales / ms.total_orders 
            ELSE 0 
          END as average_order_value,
          COALESCE(ms.total_commissions_paid, 0) as total_commissions_paid,
          COALESCE(ms.total_payouts, 0) as total_payouts,
          COALESCE(ms.current_balance, 0) as current_balance,
          ms.last_sale_date,
          EXTRACT(EPOCH FROM (NOW() - u.created_at))/86400 as account_age_days,
          -- Mock conversion rate and satisfaction (would be calculated from real data)
          CASE 
            WHEN ms.total_orders > 100 THEN 3.5 + (RANDOM() * 1.5)
            WHEN ms.total_orders > 50 THEN 2.5 + (RANDOM() * 2.0)
            WHEN ms.total_orders > 10 THEN 1.5 + (RANDOM() * 2.5)
            ELSE 0.5 + (RANDOM() * 2.0)
          END as conversion_rate,
          CASE 
            WHEN ms.total_orders > 50 THEN 4.0 + (RANDOM() * 1.0)
            WHEN ms.total_orders > 20 THEN 3.5 + (RANDOM() * 1.5)
            WHEN ms.total_orders > 5 THEN 3.0 + (RANDOM() * 2.0)
            ELSE 2.5 + (RANDOM() * 2.5)
          END as customer_satisfaction
        FROM users u
        LEFT JOIN merchant_stats ms ON u.id = ms.merchant_id
        WHERE ${whereConditions.join(' AND ')}
      ),
      merchant_performance_scored AS (
        SELECT 
          *,
          -- Calculate performance score (0-100)
          LEAST(100, GREATEST(0, 
            (CASE WHEN total_sales > 0 THEN LEAST(30, total_sales / 1000) ELSE 0 END) +
            (CASE WHEN total_orders > 0 THEN LEAST(25, total_orders / 2) ELSE 0 END) +
            (CASE WHEN conversion_rate > 0 THEN LEAST(20, conversion_rate * 4) ELSE 0 END) +
            (CASE WHEN customer_satisfaction > 0 THEN LEAST(15, customer_satisfaction * 3) ELSE 0 END) +
            (CASE WHEN account_age_days > 30 THEN LEAST(10, account_age_days / 30) ELSE 0 END)
          )) as performance_score
        FROM merchant_performance
      ),
      merchant_performance_final AS (
        SELECT 
          *,
          CASE 
            WHEN performance_score >= 80 THEN 'PLATINUM'
            WHEN performance_score >= 60 THEN 'GOLD'
            WHEN performance_score >= 40 THEN 'SILVER'
            ELSE 'BRONZE'
          END as performance_tier,
          CASE 
            WHEN last_sale_date IS NULL THEN 'DECLINING'
            WHEN last_sale_date >= NOW() - INTERVAL '7 days' AND total_sales > 1000 THEN 'GROWING'
            WHEN last_sale_date >= NOW() - INTERVAL '30 days' THEN 'STABLE'
            ELSE 'DECLINING'
          END as growth_trend
        FROM merchant_performance_scored
      )
      SELECT * FROM merchant_performance_final
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const merchantsParams = [...params, limit, offset];
    const merchantsResult = await pool.query(merchantsQuery, merchantsParams);

    // Apply client-side filtering for tier and trend
    let filteredMerchants = merchantsResult.rows;
    
    if (tierFilter !== 'all') {
      filteredMerchants = filteredMerchants.filter(merchant => 
        merchant.performance_tier.toLowerCase() === tierFilter.toLowerCase()
      );
    }
    
    if (trendFilter !== 'all') {
      filteredMerchants = filteredMerchants.filter(merchant => 
        merchant.growth_trend.toLowerCase() === trendFilter.toLowerCase()
      );
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get platform overview statistics
    const overviewQuery = `
      WITH platform_stats AS (
        SELECT 
          COUNT(DISTINCT u.id) as total_active_merchants,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_platform_sales,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as total_platform_commissions,
          COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_merchants_this_month
        FROM users u
        LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id
        WHERE u.role = 'MERCHANT' AND u.is_active = true
      ),
      performance_distribution AS (
        SELECT 
          COUNT(CASE WHEN performance_score >= 70 THEN 1 END) as top_performing,
          COUNT(CASE WHEN performance_score < 40 THEN 1 END) as underperforming,
          AVG(performance_score) as avg_performance_score
        FROM (
          SELECT 
            u.id,
            LEAST(100, GREATEST(0, 
              (CASE WHEN ms.total_sales > 0 THEN LEAST(30, ms.total_sales / 1000) ELSE 0 END) +
              (CASE WHEN ms.total_orders > 0 THEN LEAST(25, ms.total_orders / 2) ELSE 0 END) +
              15 + 10 -- Mock conversion and satisfaction scores
            )) as performance_score
          FROM users u
          LEFT JOIN (
            SELECT 
              mt.merchant_id,
              SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END) as total_sales,
              COUNT(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN 1 END) as total_orders
            FROM merchant_transactions mt
            GROUP BY mt.merchant_id
          ) ms ON u.id = ms.merchant_id
          WHERE u.role = 'MERCHANT' AND u.is_active = true
        ) perf_calc
      )
      SELECT 
        ps.total_active_merchants,
        ps.total_platform_sales,
        ps.total_platform_commissions,
        ps.new_merchants_this_month,
        pd.top_performing as top_performing_merchants,
        pd.underperforming as underperforming_merchants,
        pd.avg_performance_score as average_merchant_performance_score,
        85.5 as merchant_retention_rate -- Mock retention rate
      FROM platform_stats ps, performance_distribution pd
    `;

    const overviewResult = await pool.query(overviewQuery);
    const overview = overviewResult.rows[0];

    // Get performance trends (30-day comparison)
    const trendsQuery = `
      WITH current_period AS (
        SELECT 
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as current_sales,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as current_commissions,
          COUNT(DISTINCT u.id) as current_new_merchants
        FROM users u
        LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id AND mt.created_at >= NOW() - INTERVAL '30 days'
        WHERE u.role = 'MERCHANT'
      ),
      previous_period AS (
        SELECT 
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as previous_sales,
          COALESCE(SUM(CASE WHEN mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED' THEN ABS(mt.amount) ELSE 0 END), 0) as previous_commissions,
          COUNT(DISTINCT u.id) as previous_new_merchants
        FROM users u
        LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id 
          AND mt.created_at >= NOW() - INTERVAL '60 days' 
          AND mt.created_at < NOW() - INTERVAL '30 days'
        WHERE u.role = 'MERCHANT'
      )
      SELECT 
        CASE 
          WHEN cp.current_sales > 0 AND pp.previous_sales > 0 
          THEN ((cp.current_sales - pp.previous_sales) / pp.previous_sales) * 100
          ELSE 0 
        END as sales_growth_30d,
        CASE 
          WHEN cp.current_commissions > 0 AND pp.previous_commissions > 0 
          THEN ((cp.current_commissions - pp.previous_commissions) / pp.previous_commissions) * 100
          ELSE 0 
        END as commission_growth_30d,
        CASE 
          WHEN cp.current_new_merchants > 0 AND pp.previous_new_merchants > 0 
          THEN ((cp.current_new_merchants - pp.previous_new_merchants) / pp.previous_new_merchants) * 100
          ELSE 0 
        END as new_merchant_growth_30d
      FROM current_period cp, previous_period pp
    `;

    const trendsResult = await pool.query(trendsQuery);
    const trends = trendsResult.rows[0];

    const totalPages = Math.ceil(total / limit);

    const response: MerchantPerformanceResponse = {
      merchants: filteredMerchants,
      platform_overview: {
        total_active_merchants: parseInt(overview.total_active_merchants),
        total_platform_sales: parseFloat(overview.total_platform_sales),
        total_platform_commissions: parseFloat(overview.total_platform_commissions),
        average_merchant_performance_score: parseFloat(overview.average_merchant_performance_score),
        top_performing_merchants: parseInt(overview.top_performing_merchants),
        underperforming_merchants: parseInt(overview.underperforming_merchants),
        new_merchants_this_month: parseInt(overview.new_merchants_this_month),
        merchant_retention_rate: parseFloat(overview.merchant_retention_rate)
      },
      performance_trends: {
        sales_growth_30d: parseFloat(trends.sales_growth_30d) || 0,
        commission_growth_30d: parseFloat(trends.commission_growth_30d) || 0,
        new_merchant_growth_30d: parseFloat(trends.new_merchant_growth_30d) || 0
      },
      page,
      limit,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching merchant performance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
