import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { MerchantPerformanceEngine } from '@/lib/analytics/merchantPerformanceEngine';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

const performanceEngine = new MerchantPerformanceEngine();

async function validateAdminApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const expectedKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY;
  
  if (!apiKey || !expectedKey) {
    return false;
  }
  
  return apiKey === expectedKey;
}

/**
 * GET /api/admin/analytics/platform
 * Get comprehensive platform analytics and merchant performance overview
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin API key
    if (!await validateAdminApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing admin API key' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || 'MONTHLY';
    const includeTopPerformers = url.searchParams.get('topPerformers') === 'true';
    const includeTrends = url.searchParams.get('trends') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Get platform analytics
    const platformAnalytics = await performanceEngine.getPlatformAnalytics();

    let client;
    try {
      client = await pool.connect();

      // Get detailed platform metrics
      const platformMetricsQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as total_merchants,
          COUNT(DISTINCT CASE WHEN recent_activity.has_recent_activity THEN u.id END) as active_merchants,
          COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN u.id END) as new_merchants_30d,
          SUM(COALESCE(financial.total_revenue, 0)) as total_platform_revenue,
          SUM(COALESCE(financial.total_commissions, 0)) as total_platform_commissions,
          COUNT(DISTINCT orders.order_id) as total_orders,
          AVG(COALESCE(performance.performance_score, 0)) as avg_performance_score,
          COUNT(DISTINCT CASE WHEN automation.automation_level = 'FULL' THEN u.id END) as full_automation_merchants,
          COUNT(DISTINCT CASE WHEN automation.automation_level = 'PARTIAL' THEN u.id END) as partial_automation_merchants,
          COUNT(DISTINCT CASE WHEN automation.automation_level = 'MANUAL_REVIEW' THEN u.id END) as manual_review_merchants
        FROM users u
        LEFT JOIN (
          SELECT 
            merchant_id,
            CASE WHEN COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) > 0 
                 THEN true ELSE false END as has_recent_activity
          FROM merchant_transactions
          GROUP BY merchant_id
        ) recent_activity ON u.id = recent_activity.merchant_id
        LEFT JOIN (
          SELECT 
            merchant_id,
            SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue,
            SUM(CASE WHEN transaction_type = 'COMMISSION' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_commissions
          FROM merchant_transactions
          GROUP BY merchant_id
        ) financial ON u.id = financial.merchant_id
        LEFT JOIN (
          SELECT DISTINCT p.merchant_id, o.id as order_id
          FROM products p
          JOIN order_items oi ON p.id = oi.product_id
          JOIN orders o ON oi.order_id = o.id
        ) orders ON u.id = orders.merchant_id
        LEFT JOIN (
          SELECT 
            merchant_id,
            (100 - COALESCE(overall_score, 50)) as performance_score
          FROM merchant_risk_scores
        ) performance ON u.id = performance.merchant_id
        LEFT JOIN merchant_risk_scores automation ON u.id = automation.merchant_id
        WHERE u.role = 'MERCHANT'
      `;

      // Get merchant tier distribution
      const tierDistributionQuery = `
        SELECT 
          CASE 
            WHEN performance_score >= 80 THEN 'DIAMOND'
            WHEN performance_score >= 65 THEN 'PLATINUM'
            WHEN performance_score >= 50 THEN 'GOLD'
            WHEN performance_score >= 35 THEN 'SILVER'
            ELSE 'BRONZE'
          END as tier,
          COUNT(*) as count,
          AVG(total_revenue) as avg_revenue,
          AVG(total_orders) as avg_orders
        FROM (
          SELECT 
            u.id,
            COALESCE(100 - mrs.overall_score, 50) as performance_score,
            COALESCE(financial.total_revenue, 0) as total_revenue,
            COALESCE(order_stats.total_orders, 0) as total_orders
          FROM users u
          LEFT JOIN merchant_risk_scores mrs ON u.id = mrs.merchant_id
          LEFT JOIN (
            SELECT 
              merchant_id,
              SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue
            FROM merchant_transactions
            GROUP BY merchant_id
          ) financial ON u.id = financial.merchant_id
          LEFT JOIN (
            SELECT 
              p.merchant_id,
              COUNT(DISTINCT o.id) as total_orders
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN orders o ON oi.order_id = o.id
            GROUP BY p.merchant_id
          ) order_stats ON u.id = order_stats.merchant_id
          WHERE u.role = 'MERCHANT'
        ) merchant_tiers
        GROUP BY tier
        ORDER BY 
          CASE tier
            WHEN 'DIAMOND' THEN 1
            WHEN 'PLATINUM' THEN 2
            WHEN 'GOLD' THEN 3
            WHEN 'SILVER' THEN 4
            WHEN 'BRONZE' THEN 5
          END
      `;

      // Get top performing merchants if requested
      let topPerformersQuery = '';
      if (includeTopPerformers) {
        topPerformersQuery = `
          SELECT 
            u.id,
            u.email,
            u.business_name,
            COALESCE(100 - mrs.overall_score, 50) as performance_score,
            COALESCE(financial.total_revenue, 0) as total_revenue,
            COALESCE(financial.total_commissions, 0) as total_commissions,
            COALESCE(order_stats.total_orders, 0) as total_orders,
            COALESCE(order_stats.fulfillment_rate, 0) as fulfillment_rate,
            mrs.automation_level,
            EXTRACT(DAYS FROM (CURRENT_DATE - u.created_at::date)) as account_age_days
          FROM users u
          LEFT JOIN merchant_risk_scores mrs ON u.id = mrs.merchant_id
          LEFT JOIN (
            SELECT 
              merchant_id,
              SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue,
              SUM(CASE WHEN transaction_type = 'COMMISSION' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_commissions
            FROM merchant_transactions
            GROUP BY merchant_id
          ) financial ON u.id = financial.merchant_id
          LEFT JOIN (
            SELECT 
              p.merchant_id,
              COUNT(DISTINCT o.id) as total_orders,
              CASE WHEN COUNT(DISTINCT o.id) > 0 
                   THEN COUNT(CASE WHEN o.status IN ('delivered', 'completed') THEN 1 END)::float / COUNT(DISTINCT o.id) * 100 
                   ELSE 0 END as fulfillment_rate
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN orders o ON oi.order_id = o.id
            GROUP BY p.merchant_id
          ) order_stats ON u.id = order_stats.merchant_id
          WHERE u.role = 'MERCHANT'
          ORDER BY performance_score DESC, total_revenue DESC
          LIMIT $1
        `;
      }

      // Get growth trends if requested
      let trendsQuery = '';
      if (includeTrends) {
        trendsQuery = `
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(CASE WHEN role = 'MERCHANT' THEN 1 END) as new_merchants,
            SUM(CASE WHEN role = 'MERCHANT' THEN 1 ELSE 0 END) OVER (ORDER BY DATE_TRUNC('month', created_at)) as cumulative_merchants
          FROM users
          WHERE created_at >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month
        `;
      }

      // Execute queries
      const promises = [
        client.query(platformMetricsQuery),
        client.query(tierDistributionQuery)
      ];

      if (includeTopPerformers) {
        promises.push(client.query(topPerformersQuery, [limit]));
      }

      if (includeTrends) {
        promises.push(client.query(trendsQuery));
      }

      const results = await Promise.all(promises);
      
      const platformMetrics = results[0].rows[0];
      const tierDistribution = results[1].rows;
      const topPerformers = includeTopPerformers ? results[2].rows : [];
      const trends = includeTrends ? results[results.length - 1].rows : [];

      // Calculate growth rates
      const currentMonthMerchants = parseInt(platformMetrics.total_merchants);
      const newMerchants30d = parseInt(platformMetrics.new_merchants_30d);
      const merchantGrowthRate = currentMonthMerchants > 0 ? (newMerchants30d / currentMonthMerchants) * 100 : 0;

      // Calculate automation adoption rate
      const totalMerchantsWithAutomation = parseInt(platformMetrics.full_automation_merchants) + 
                                          parseInt(platformMetrics.partial_automation_merchants) + 
                                          parseInt(platformMetrics.manual_review_merchants);
      const automationAdoptionRate = totalMerchantsWithAutomation > 0 
        ? ((parseInt(platformMetrics.full_automation_merchants) + parseInt(platformMetrics.partial_automation_merchants)) / totalMerchantsWithAutomation) * 100
        : 0;

      const response = {
        success: true,
        data: {
          overview: {
            totalMerchants: parseInt(platformMetrics.total_merchants),
            activeMerchants: parseInt(platformMetrics.active_merchants),
            newMerchants30d: newMerchants30d,
            totalRevenue: parseFloat(platformMetrics.total_platform_revenue) || 0,
            totalCommissions: parseFloat(platformMetrics.total_platform_commissions) || 0,
            totalOrders: parseInt(platformMetrics.total_orders) || 0,
            averagePerformanceScore: parseFloat(platformMetrics.avg_performance_score) || 0,
            merchantGrowthRate,
            automationAdoptionRate
          },
          merchantDistribution: {
            byTier: tierDistribution.reduce((acc, row) => {
              acc[row.tier] = {
                count: parseInt(row.count),
                averageRevenue: parseFloat(row.avg_revenue) || 0,
                averageOrders: parseFloat(row.avg_orders) || 0
              };
              return acc;
            }, {} as Record<string, any>),
            byAutomationLevel: {
              FULL: parseInt(platformMetrics.full_automation_merchants),
              PARTIAL: parseInt(platformMetrics.partial_automation_merchants),
              MANUAL_REVIEW: parseInt(platformMetrics.manual_review_merchants)
            }
          },
          topPerformers: includeTopPerformers ? topPerformers.map(merchant => ({
            merchantId: merchant.id,
            email: merchant.email,
            businessName: merchant.business_name,
            performanceScore: parseFloat(merchant.performance_score),
            totalRevenue: parseFloat(merchant.total_revenue) || 0,
            totalCommissions: parseFloat(merchant.total_commissions) || 0,
            totalOrders: parseInt(merchant.total_orders) || 0,
            fulfillmentRate: parseFloat(merchant.fulfillment_rate) || 0,
            automationLevel: merchant.automation_level,
            accountAgeDays: parseInt(merchant.account_age_days)
          })) : [],
          trends: includeTrends ? {
            merchantGrowth: trends.map(row => ({
              month: row.month,
              newMerchants: parseInt(row.new_merchants),
              cumulativeMerchants: parseInt(row.cumulative_merchants)
            }))
          } : null,
          lastUpdated: new Date()
        }
      };

      return NextResponse.json(response);

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error fetching platform analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch platform analytics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/platform
 * Trigger platform analytics recalculation
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin API key
    if (!await validateAdminApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing admin API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, targetDate } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();

      if (action === 'recalculate_daily_metrics') {
        const date = targetDate ? new Date(targetDate) : new Date();
        
        // Call the database function to calculate daily metrics
        const result = await client.query(
          'SELECT calculate_daily_performance_metrics($1) as metrics_count',
          [date]
        );
        
        const metricsCount = result.rows[0].metrics_count;
        
        return NextResponse.json({
          success: true,
          message: `Daily performance metrics recalculated for ${metricsCount} merchants`,
          data: {
            date: date,
            metricsCalculated: metricsCount,
            recalculatedAt: new Date()
          }
        });

      } else if (action === 'update_platform_analytics') {
        const date = targetDate ? new Date(targetDate) : new Date();
        const timeframe = body.timeframe || 'DAILY';
        
        // Call the database function to update platform analytics
        await client.query(
          'SELECT update_platform_analytics($1, $2)',
          [date, timeframe]
        );
        
        return NextResponse.json({
          success: true,
          message: `Platform analytics updated for ${timeframe} timeframe`,
          data: {
            date: date,
            timeframe: timeframe,
            updatedAt: new Date()
          }
        });

      } else if (action === 'clear_performance_cache') {
        // Clear all performance cache
        performanceEngine.clearCache();
        
        return NextResponse.json({
          success: true,
          message: 'Performance cache cleared successfully',
          data: {
            clearedAt: new Date()
          }
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: recalculate_daily_metrics, update_platform_analytics, clear_performance_cache' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error processing platform analytics action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process analytics action',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
