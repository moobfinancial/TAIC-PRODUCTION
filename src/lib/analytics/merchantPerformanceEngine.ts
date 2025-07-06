import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export interface MerchantPerformanceMetrics {
  merchantId: string;
  merchantEmail: string;
  businessName: string;
  
  // Financial Performance
  financial: {
    totalRevenue: number;
    totalCommissions: number;
    netEarnings: number;
    availableBalance: number;
    monthlyRevenue: number;
    revenueGrowth: number; // percentage
    averageOrderValue: number;
    commissionRate: number;
  };
  
  // Order Performance
  orders: {
    totalOrders: number;
    monthlyOrders: number;
    orderGrowth: number; // percentage
    fulfillmentRate: number; // percentage
    cancellationRate: number; // percentage
    averageProcessingTime: number; // hours
    recentOrders: number; // last 30 days
    ordersByStatus: Record<string, number>;
  };
  
  // Product Performance
  products: {
    totalProducts: number;
    activeProducts: number;
    approvedProducts: number;
    approvalRate: number; // percentage
    topPerformers: ProductPerformance[];
    inventoryHealth: number; // percentage
    lowStockAlerts: number;
    outOfStockAlerts: number;
  };
  
  // Automation Performance
  automation: {
    riskScore: number;
    automationLevel: string;
    automationRate: number; // percentage
    payoutEfficiency: number; // percentage
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
    totalAutomatedPayouts: number;
    automationSavings: number;
  };
  
  // Payout Performance
  payouts: {
    totalPayouts: number;
    totalPayoutAmount: number;
    averagePayoutAmount: number;
    payoutFrequency: number; // days between payouts
    pendingPayouts: number;
    successfulPayouts: number;
    payoutSuccessRate: number; // percentage
    lastPayoutDate: Date | null;
  };
  
  // Platform Performance
  platform: {
    performanceScore: number; // 0-100
    platformRank: number;
    percentile: number; // top X% of merchants
    merchantTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
    accountAge: number; // days
    verificationStatus: {
      emailVerified: boolean;
      walletVerified: boolean;
      businessVerified: boolean;
    };
  };
  
  // Trends and Insights
  trends: {
    revenueGrowthTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    orderVolumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    performanceTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    seasonalityIndex: number; // 0-100
  };
  
  lastUpdated: Date;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
  profit: number;
  conversionRate: number;
  averageRating: number;
  inventoryLevel: number;
}

export interface MerchantComparison {
  metric: string;
  merchantValue: number;
  platformAverage: number;
  percentile: number;
  trend: 'ABOVE' | 'BELOW' | 'AVERAGE';
}

export interface PerformanceInsight {
  type: 'OPPORTUNITY' | 'WARNING' | 'SUCCESS' | 'RECOMMENDATION';
  category: 'REVENUE' | 'ORDERS' | 'PRODUCTS' | 'AUTOMATION' | 'PAYOUTS';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actionable: boolean;
  recommendation?: string;
}

export interface PlatformAnalytics {
  totalMerchants: number;
  activeMerchants: number;
  totalRevenue: number;
  totalOrders: number;
  averagePerformanceScore: number;
  topPerformers: MerchantPerformanceMetrics[];
  merchantDistribution: {
    byTier: Record<string, number>;
    byAutomationLevel: Record<string, number>;
    byPerformanceScore: Record<string, number>;
  };
  platformTrends: {
    revenueGrowth: number;
    merchantGrowth: number;
    orderGrowth: number;
    automationAdoption: number;
  };
}

/**
 * Advanced Merchant Performance Analytics Engine
 * Provides comprehensive performance metrics, insights, and benchmarking
 */
export class MerchantPerformanceEngine {
  private performanceCache: Map<string, MerchantPerformanceMetrics> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive performance metrics for a merchant
   */
  public async getMerchantPerformance(merchantId: string, forceRefresh: boolean = false): Promise<MerchantPerformanceMetrics> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid(merchantId)) {
      const cached = this.performanceCache.get(merchantId);
      if (cached) return cached;
    }

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      
      // Get merchant basic info
      const merchantInfo = await this.getMerchantBasicInfo(client, merchantId);
      
      // Get financial performance
      const financial = await this.getFinancialPerformance(client, merchantId);
      
      // Get order performance
      const orders = await this.getOrderPerformance(client, merchantId);
      
      // Get product performance
      const products = await this.getProductPerformance(client, merchantId);
      
      // Get automation performance
      const automation = await this.getAutomationPerformance(client, merchantId);
      
      // Get payout performance
      const payouts = await this.getPayoutPerformance(client, merchantId);
      
      // Get platform performance
      const platform = await this.getPlatformPerformance(client, merchantId);
      
      // Calculate trends
      const trends = await this.calculateTrends(client, merchantId);
      
      const performance: MerchantPerformanceMetrics = {
        merchantId,
        merchantEmail: merchantInfo.email,
        businessName: merchantInfo.businessName,
        financial,
        orders,
        products,
        automation,
        payouts,
        platform,
        trends,
        lastUpdated: new Date()
      };
      
      // Cache the result
      this.performanceCache.set(merchantId, performance);
      this.cacheExpiry.set(merchantId, Date.now() + this.CACHE_DURATION);
      
      return performance;
      
    } catch (error) {
      console.error('Error calculating merchant performance:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get merchant basic information
   */
  private async getMerchantBasicInfo(client: PoolClient, merchantId: string): Promise<any> {
    const query = `
      SELECT 
        email,
        business_name,
        email_verified,
        wallet_verified,
        created_at
      FROM users 
      WHERE id = $1 AND role = 'MERCHANT'
    `;
    
    const result = await client.query(query, [merchantId]);
    if (result.rows.length === 0) {
      throw new Error('Merchant not found');
    }
    
    return {
      email: result.rows[0].email,
      businessName: result.rows[0].business_name || 'Unknown Business',
      emailVerified: result.rows[0].email_verified,
      walletVerified: result.rows[0].wallet_verified,
      createdAt: result.rows[0].created_at
    };
  }

  /**
   * Calculate financial performance metrics
   */
  private async getFinancialPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const query = `
      SELECT 
        SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN transaction_type = 'COMMISSION' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_commissions,
        SUM(CASE WHEN transaction_type = 'PAYOUT' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_payouts,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as available_balance,
        SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' 
                 AND created_at > NOW() - INTERVAL '30 days' THEN amount ELSE 0 END) as monthly_revenue,
        SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' 
                 AND created_at > NOW() - INTERVAL '60 days' 
                 AND created_at <= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END) as previous_monthly_revenue,
        COUNT(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN 1 END) as total_sales_count,
        AVG(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount END) as avg_order_value
      FROM merchant_transactions 
      WHERE merchant_id = $1
    `;
    
    const result = await client.query(query, [merchantId]);
    const row = result.rows[0];
    
    const totalRevenue = parseFloat(row.total_revenue) || 0;
    const totalCommissions = parseFloat(row.total_commissions) || 0;
    const totalPayouts = parseFloat(row.total_payouts) || 0;
    const monthlyRevenue = parseFloat(row.monthly_revenue) || 0;
    const previousMonthlyRevenue = parseFloat(row.previous_monthly_revenue) || 0;
    
    const revenueGrowth = previousMonthlyRevenue > 0 
      ? ((monthlyRevenue - previousMonthlyRevenue) / previousMonthlyRevenue) * 100 
      : 0;
    
    const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      totalCommissions,
      netEarnings: totalRevenue - totalCommissions,
      availableBalance: parseFloat(row.available_balance) || 0,
      monthlyRevenue,
      revenueGrowth,
      averageOrderValue: parseFloat(row.avg_order_value) || 0,
      commissionRate
    };
  }

  /**
   * Calculate order performance metrics
   */
  private async getOrderPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const orderQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as monthly_orders,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '60 days' 
                   AND created_at <= NOW() - INTERVAL '30 days' THEN 1 END) as previous_monthly_orders,
        COUNT(CASE WHEN status IN ('delivered', 'completed') THEN 1 END) as fulfilled_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_processing_time
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.merchant_id = $1
    `;
    
    const statusQuery = `
      SELECT 
        o.status,
        COUNT(*) as count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.merchant_id = $1
      GROUP BY o.status
    `;
    
    const [orderResult, statusResult] = await Promise.all([
      client.query(orderQuery, [merchantId]),
      client.query(statusQuery, [merchantId])
    ]);
    
    const orderRow = orderResult.rows[0];
    const totalOrders = parseInt(orderRow.total_orders) || 0;
    const monthlyOrders = parseInt(orderRow.monthly_orders) || 0;
    const previousMonthlyOrders = parseInt(orderRow.previous_monthly_orders) || 0;
    const fulfilledOrders = parseInt(orderRow.fulfilled_orders) || 0;
    const cancelledOrders = parseInt(orderRow.cancelled_orders) || 0;
    
    const orderGrowth = previousMonthlyOrders > 0 
      ? ((monthlyOrders - previousMonthlyOrders) / previousMonthlyOrders) * 100 
      : 0;
    
    const fulfillmentRate = totalOrders > 0 ? (fulfilledOrders / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    
    const ordersByStatus: Record<string, number> = {};
    statusResult.rows.forEach(row => {
      ordersByStatus[row.status] = parseInt(row.count);
    });
    
    return {
      totalOrders,
      monthlyOrders,
      orderGrowth,
      fulfillmentRate,
      cancellationRate,
      averageProcessingTime: parseFloat(orderRow.avg_processing_time) || 0,
      recentOrders: parseInt(orderRow.recent_orders) || 0,
      ordersByStatus
    };
  }

  /**
   * Check if cache is valid for merchant
   */
  private isCacheValid(merchantId: string): boolean {
    const expiry = this.cacheExpiry.get(merchantId);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Calculate product performance metrics
   */
  private async getProductPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const productQuery = `
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_products,
        COUNT(CASE WHEN approval_status = 'approved' AND stock_quantity > 0 THEN 1 END) as active_products,
        COUNT(CASE WHEN stock_quantity <= reorder_level AND stock_quantity > 0 THEN 1 END) as low_stock_alerts,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_alerts
      FROM products
      WHERE merchant_id = $1
    `;

    const topProductsQuery = `
      SELECT
        p.id as product_id,
        p.name as product_name,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.price_per_item) as revenue,
        SUM(oi.quantity * (oi.price_per_item - COALESCE(p.cost_price, 0))) as profit,
        p.stock_quantity as inventory_level
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.merchant_id = $1 AND (o.status IS NULL OR o.status IN ('delivered', 'completed'))
      GROUP BY p.id, p.name, p.stock_quantity
      ORDER BY total_sold DESC NULLS LAST
      LIMIT 10
    `;

    const [productResult, topProductsResult] = await Promise.all([
      client.query(productQuery, [merchantId]),
      client.query(topProductsQuery, [merchantId])
    ]);

    const productRow = productResult.rows[0];
    const totalProducts = parseInt(productRow.total_products) || 0;
    const approvedProducts = parseInt(productRow.approved_products) || 0;

    const approvalRate = totalProducts > 0 ? (approvedProducts / totalProducts) * 100 : 0;
    const inventoryHealth = totalProducts > 0
      ? ((totalProducts - parseInt(productRow.out_of_stock_alerts)) / totalProducts) * 100
      : 100;

    const topPerformers: ProductPerformance[] = topProductsResult.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      totalSold: parseInt(row.total_sold) || 0,
      revenue: parseFloat(row.revenue) || 0,
      profit: parseFloat(row.profit) || 0,
      conversionRate: 0, // Would need view/click data
      averageRating: 0, // Would need review data
      inventoryLevel: parseInt(row.inventory_level) || 0
    }));

    return {
      totalProducts,
      activeProducts: parseInt(productRow.active_products) || 0,
      approvedProducts,
      approvalRate,
      topPerformers,
      inventoryHealth,
      lowStockAlerts: parseInt(productRow.low_stock_alerts) || 0,
      outOfStockAlerts: parseInt(productRow.out_of_stock_alerts) || 0
    };
  }

  /**
   * Calculate automation performance metrics
   */
  private async getAutomationPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const riskQuery = `
      SELECT
        overall_score,
        automation_level,
        daily_limit,
        weekly_limit,
        monthly_limit
      FROM merchant_risk_scores
      WHERE merchant_id = $1
    `;

    const automationQuery = `
      SELECT
        COUNT(*) as total_automated_payouts,
        COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' THEN 1 END) as auto_approved,
        COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as successful_automated,
        SUM(CASE WHEN status = 'EXECUTED' THEN amount ELSE 0 END) as automated_volume
      FROM automated_payout_requests
      WHERE merchant_id = $1
    `;

    const [riskResult, automationResult] = await Promise.all([
      client.query(riskQuery, [merchantId]),
      client.query(automationQuery, [merchantId])
    ]);

    const riskRow = riskResult.rows[0];
    const automationRow = automationResult.rows[0];

    if (!riskRow) {
      // Default values if no risk score exists
      return {
        riskScore: 50,
        automationLevel: 'PARTIAL',
        automationRate: 0,
        payoutEfficiency: 0,
        dailyLimit: 5000,
        weeklyLimit: 25000,
        monthlyLimit: 100000,
        totalAutomatedPayouts: 0,
        automationSavings: 0
      };
    }

    const totalAutomatedPayouts = parseInt(automationRow?.total_automated_payouts) || 0;
    const autoApproved = parseInt(automationRow?.auto_approved) || 0;
    const successfulAutomated = parseInt(automationRow?.successful_automated) || 0;

    const automationRate = totalAutomatedPayouts > 0 ? (autoApproved / totalAutomatedPayouts) * 100 : 0;
    const payoutEfficiency = totalAutomatedPayouts > 0 ? (successfulAutomated / totalAutomatedPayouts) * 100 : 0;
    const automationSavings = successfulAutomated * 5; // $5 saved per automated payout

    return {
      riskScore: riskRow.overall_score,
      automationLevel: riskRow.automation_level,
      automationRate,
      payoutEfficiency,
      dailyLimit: parseFloat(riskRow.daily_limit),
      weeklyLimit: parseFloat(riskRow.weekly_limit),
      monthlyLimit: parseFloat(riskRow.monthly_limit),
      totalAutomatedPayouts,
      automationSavings
    };
  }

  /**
   * Calculate payout performance metrics
   */
  private async getPayoutPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const payoutQuery = `
      SELECT
        COUNT(*) as total_payouts,
        SUM(requested_amount) as total_payout_amount,
        AVG(requested_amount) as avg_payout_amount,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_payouts,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful_payouts,
        MAX(completed_at) as last_payout_date,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400) as avg_payout_time_days
      FROM merchant_payout_requests
      WHERE merchant_id = $1
    `;

    const result = await client.query(payoutQuery, [merchantId]);
    const row = result.rows[0];

    const totalPayouts = parseInt(row.total_payouts) || 0;
    const successfulPayouts = parseInt(row.successful_payouts) || 0;
    const payoutSuccessRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 0;

    return {
      totalPayouts,
      totalPayoutAmount: parseFloat(row.total_payout_amount) || 0,
      averagePayoutAmount: parseFloat(row.avg_payout_amount) || 0,
      payoutFrequency: parseFloat(row.avg_payout_time_days) || 0,
      pendingPayouts: parseInt(row.pending_payouts) || 0,
      successfulPayouts,
      payoutSuccessRate,
      lastPayoutDate: row.last_payout_date ? new Date(row.last_payout_date) : null
    };
  }

  /**
   * Calculate platform performance and ranking
   */
  private async getPlatformPerformance(client: PoolClient, merchantId: string): Promise<any> {
    const merchantInfo = await client.query(`
      SELECT created_at, email_verified, wallet_verified
      FROM users
      WHERE id = $1
    `, [merchantId]);

    const performanceQuery = `
      WITH merchant_scores AS (
        SELECT
          merchant_id,
          (
            COALESCE(revenue_score, 0) * 0.3 +
            COALESCE(order_score, 0) * 0.25 +
            COALESCE(automation_score, 0) * 0.2 +
            COALESCE(product_score, 0) * 0.15 +
            COALESCE(payout_score, 0) * 0.1
          ) as performance_score
        FROM (
          SELECT
            u.id as merchant_id,
            LEAST(100, (COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount END), 0) / 1000)) as revenue_score,
            LEAST(100, COUNT(DISTINCT o.id) * 2) as order_score,
            COALESCE(100 - mrs.overall_score, 50) as automation_score,
            LEAST(100, COUNT(DISTINCT p.id) * 5) as product_score,
            LEAST(100, COUNT(DISTINCT mpr.id) * 10) as payout_score
          FROM users u
          LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id
          LEFT JOIN products p ON u.id = p.merchant_id
          LEFT JOIN orders o ON o.id IN (
            SELECT DISTINCT oi.order_id FROM order_items oi
            WHERE oi.product_id = p.id
          )
          LEFT JOIN merchant_payout_requests mpr ON u.id = mpr.merchant_id AND mpr.status = 'COMPLETED'
          LEFT JOIN merchant_risk_scores mrs ON u.id = mrs.merchant_id
          WHERE u.role = 'MERCHANT'
          GROUP BY u.id, mrs.overall_score
        ) scores
      ),
      ranked_merchants AS (
        SELECT
          merchant_id,
          performance_score,
          ROW_NUMBER() OVER (ORDER BY performance_score DESC) as rank,
          COUNT(*) OVER () as total_merchants
        FROM merchant_scores
      )
      SELECT
        performance_score,
        rank,
        total_merchants,
        (rank::float / total_merchants * 100) as percentile
      FROM ranked_merchants
      WHERE merchant_id = $1
    `;

    const result = await client.query(performanceQuery, [merchantId]);
    const row = result.rows[0];

    const performanceScore = parseFloat(row?.performance_score) || 0;
    const platformRank = parseInt(row?.rank) || 1;
    const totalMerchants = parseInt(row?.total_merchants) || 1;
    const percentile = parseFloat(row?.percentile) || 100;

    // Calculate merchant tier based on performance score
    let merchantTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
    if (performanceScore >= 80) merchantTier = 'DIAMOND';
    else if (performanceScore >= 65) merchantTier = 'PLATINUM';
    else if (performanceScore >= 50) merchantTier = 'GOLD';
    else if (performanceScore >= 35) merchantTier = 'SILVER';
    else merchantTier = 'BRONZE';

    const merchantRow = merchantInfo.rows[0];
    const accountAge = Math.floor((Date.now() - new Date(merchantRow.created_at).getTime()) / (1000 * 60 * 60 * 24));

    return {
      performanceScore,
      platformRank,
      percentile: 100 - percentile, // Convert to "top X%" format
      merchantTier,
      accountAge,
      verificationStatus: {
        emailVerified: merchantRow.email_verified,
        walletVerified: merchantRow.wallet_verified,
        businessVerified: false // Would need additional verification data
      }
    };
  }

  /**
   * Calculate performance trends
   */
  private async calculateTrends(client: PoolClient, merchantId: string): Promise<any> {
    const trendQuery = `
      SELECT
        SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED'
                 AND mt.created_at > NOW() - INTERVAL '30 days' THEN mt.amount ELSE 0 END) as recent_revenue,
        SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED'
                 AND mt.created_at > NOW() - INTERVAL '60 days'
                 AND mt.created_at <= NOW() - INTERVAL '30 days' THEN mt.amount ELSE 0 END) as previous_revenue,
        COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders,
        COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '60 days'
                   AND o.created_at <= NOW() - INTERVAL '30 days' THEN 1 END) as previous_orders
      FROM users u
      LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id
      LEFT JOIN products p ON u.id = p.merchant_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE u.id = $1
    `;

    const result = await client.query(trendQuery, [merchantId]);
    const row = result.rows[0];

    const recentRevenue = parseFloat(row.recent_revenue) || 0;
    const previousRevenue = parseFloat(row.previous_revenue) || 0;
    const recentOrders = parseInt(row.recent_orders) || 0;
    const previousOrders = parseInt(row.previous_orders) || 0;

    const revenueChange = previousRevenue > 0 ? (recentRevenue - previousRevenue) / previousRevenue : 0;
    const orderChange = previousOrders > 0 ? (recentOrders - previousOrders) / previousOrders : 0;

    const revenueGrowthTrend = revenueChange > 0.1 ? 'INCREASING' : revenueChange < -0.1 ? 'DECREASING' : 'STABLE';
    const orderVolumeTrend = orderChange > 0.1 ? 'INCREASING' : orderChange < -0.1 ? 'DECREASING' : 'STABLE';

    // Simple performance trend based on revenue and order trends
    let performanceTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    if (revenueGrowthTrend === 'INCREASING' && orderVolumeTrend === 'INCREASING') {
      performanceTrend = 'IMPROVING';
    } else if (revenueGrowthTrend === 'DECREASING' && orderVolumeTrend === 'DECREASING') {
      performanceTrend = 'DECLINING';
    } else {
      performanceTrend = 'STABLE';
    }

    return {
      revenueGrowthTrend,
      orderVolumeTrend,
      performanceTrend,
      seasonalityIndex: 50 // Would need historical data for proper calculation
    };
  }

  /**
   * Generate performance insights and recommendations
   */
  public async generateInsights(merchantId: string): Promise<PerformanceInsight[]> {
    const performance = await this.getMerchantPerformance(merchantId);
    const insights: PerformanceInsight[] = [];

    // Revenue insights
    if (performance.financial.revenueGrowth < -10) {
      insights.push({
        type: 'WARNING',
        category: 'REVENUE',
        title: 'Revenue Decline Detected',
        description: `Revenue has decreased by ${Math.abs(performance.financial.revenueGrowth).toFixed(1)}% this month`,
        impact: 'HIGH',
        actionable: true,
        recommendation: 'Review product pricing, marketing strategies, and customer feedback to identify improvement opportunities'
      });
    } else if (performance.financial.revenueGrowth > 20) {
      insights.push({
        type: 'SUCCESS',
        category: 'REVENUE',
        title: 'Strong Revenue Growth',
        description: `Revenue has increased by ${performance.financial.revenueGrowth.toFixed(1)}% this month`,
        impact: 'HIGH',
        actionable: false
      });
    }

    // Order performance insights
    if (performance.orders.fulfillmentRate < 85) {
      insights.push({
        type: 'WARNING',
        category: 'ORDERS',
        title: 'Low Fulfillment Rate',
        description: `Only ${performance.orders.fulfillmentRate.toFixed(1)}% of orders are being fulfilled successfully`,
        impact: 'HIGH',
        actionable: true,
        recommendation: 'Review order processing workflow and inventory management to improve fulfillment rates'
      });
    }

    if (performance.orders.cancellationRate > 15) {
      insights.push({
        type: 'WARNING',
        category: 'ORDERS',
        title: 'High Cancellation Rate',
        description: `${performance.orders.cancellationRate.toFixed(1)}% of orders are being cancelled`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Analyze cancellation reasons and improve product descriptions, pricing, or customer service'
      });
    }

    // Product insights
    if (performance.products.inventoryHealth < 70) {
      insights.push({
        type: 'WARNING',
        category: 'PRODUCTS',
        title: 'Inventory Management Issues',
        description: `${performance.products.outOfStockAlerts} products are out of stock, ${performance.products.lowStockAlerts} have low stock`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Implement automated reordering and improve inventory forecasting'
      });
    }

    if (performance.products.approvalRate < 80) {
      insights.push({
        type: 'OPPORTUNITY',
        category: 'PRODUCTS',
        title: 'Product Approval Optimization',
        description: `Only ${performance.products.approvalRate.toFixed(1)}% of products are approved`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Review product submission guidelines and improve product quality before submission'
      });
    }

    // Automation insights
    if (performance.automation.automationLevel === 'MANUAL_REVIEW' && performance.automation.riskScore < 60) {
      insights.push({
        type: 'OPPORTUNITY',
        category: 'AUTOMATION',
        title: 'Automation Upgrade Available',
        description: `Your risk score of ${performance.automation.riskScore} qualifies you for higher automation levels`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Contact support to upgrade your automation level and reduce manual processing delays'
      });
    }

    if (performance.automation.payoutEfficiency < 80 && performance.automation.totalAutomatedPayouts > 5) {
      insights.push({
        type: 'WARNING',
        category: 'AUTOMATION',
        title: 'Payout Processing Issues',
        description: `Only ${performance.automation.payoutEfficiency.toFixed(1)}% of automated payouts are successful`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Review payout wallet addresses and ensure sufficient treasury balance'
      });
    }

    // Payout insights
    if (performance.payouts.payoutSuccessRate < 90 && performance.payouts.totalPayouts > 3) {
      insights.push({
        type: 'WARNING',
        category: 'PAYOUTS',
        title: 'Payout Success Rate Issues',
        description: `${performance.payouts.payoutSuccessRate.toFixed(1)}% payout success rate is below optimal`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: 'Verify wallet addresses and ensure compliance with payout requirements'
      });
    }

    // Performance tier insights
    if (performance.platform.merchantTier === 'BRONZE' && performance.platform.accountAge > 30) {
      insights.push({
        type: 'OPPORTUNITY',
        category: 'REVENUE',
        title: 'Performance Tier Upgrade',
        description: 'Increase your performance score to unlock higher merchant tiers and benefits',
        impact: 'LOW',
        actionable: true,
        recommendation: 'Focus on increasing order volume, improving fulfillment rates, and maintaining good automation scores'
      });
    }

    return insights;
  }

  /**
   * Compare merchant performance with platform averages
   */
  public async getMerchantComparison(merchantId: string): Promise<MerchantComparison[]> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const performance = await this.getMerchantPerformance(merchantId);

      // Get platform averages
      const platformQuery = `
        SELECT
          AVG(revenue_total) as avg_revenue,
          AVG(order_count) as avg_orders,
          AVG(fulfillment_rate) as avg_fulfillment,
          AVG(automation_rate) as avg_automation,
          AVG(payout_success_rate) as avg_payout_success
        FROM (
          SELECT
            u.id,
            COALESCE(SUM(CASE WHEN mt.transaction_type = 'SALE' AND mt.status = 'COMPLETED' THEN mt.amount END), 0) as revenue_total,
            COUNT(DISTINCT o.id) as order_count,
            CASE WHEN COUNT(DISTINCT o.id) > 0
                 THEN COUNT(CASE WHEN o.status IN ('delivered', 'completed') THEN 1 END)::float / COUNT(DISTINCT o.id) * 100
                 ELSE 0 END as fulfillment_rate,
            COALESCE(apr_stats.automation_rate, 0) as automation_rate,
            COALESCE(payout_stats.success_rate, 0) as payout_success_rate
          FROM users u
          LEFT JOIN merchant_transactions mt ON u.id = mt.merchant_id
          LEFT JOIN products p ON u.id = p.merchant_id
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id
          LEFT JOIN (
            SELECT
              merchant_id,
              CASE WHEN COUNT(*) > 0
                   THEN COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' THEN 1 END)::float / COUNT(*) * 100
                   ELSE 0 END as automation_rate
            FROM automated_payout_requests
            GROUP BY merchant_id
          ) apr_stats ON u.id = apr_stats.merchant_id
          LEFT JOIN (
            SELECT
              merchant_id,
              CASE WHEN COUNT(*) > 0
                   THEN COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::float / COUNT(*) * 100
                   ELSE 0 END as success_rate
            FROM merchant_payout_requests
            GROUP BY merchant_id
          ) payout_stats ON u.id = payout_stats.merchant_id
          WHERE u.role = 'MERCHANT'
          GROUP BY u.id, apr_stats.automation_rate, payout_stats.success_rate
        ) merchant_stats
      `;

      const result = await client.query(platformQuery);
      const platformAvg = result.rows[0];

      const comparisons: MerchantComparison[] = [
        {
          metric: 'Monthly Revenue',
          merchantValue: performance.financial.monthlyRevenue,
          platformAverage: parseFloat(platformAvg.avg_revenue) || 0,
          percentile: 0, // Would calculate based on ranking
          trend: performance.financial.monthlyRevenue > (parseFloat(platformAvg.avg_revenue) || 0) ? 'ABOVE' : 'BELOW'
        },
        {
          metric: 'Fulfillment Rate',
          merchantValue: performance.orders.fulfillmentRate,
          platformAverage: parseFloat(platformAvg.avg_fulfillment) || 0,
          percentile: 0,
          trend: performance.orders.fulfillmentRate > (parseFloat(platformAvg.avg_fulfillment) || 0) ? 'ABOVE' : 'BELOW'
        },
        {
          metric: 'Automation Rate',
          merchantValue: performance.automation.automationRate,
          platformAverage: parseFloat(platformAvg.avg_automation) || 0,
          percentile: 0,
          trend: performance.automation.automationRate > (parseFloat(platformAvg.avg_automation) || 0) ? 'ABOVE' : 'BELOW'
        },
        {
          metric: 'Payout Success Rate',
          merchantValue: performance.payouts.payoutSuccessRate,
          platformAverage: parseFloat(platformAvg.avg_payout_success) || 0,
          percentile: 0,
          trend: performance.payouts.payoutSuccessRate > (parseFloat(platformAvg.avg_payout_success) || 0) ? 'ABOVE' : 'BELOW'
        }
      ];

      return comparisons;

    } catch (error) {
      console.error('Error generating merchant comparison:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get platform-wide analytics
   */
  public async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const platformQuery = `
        SELECT
          COUNT(DISTINCT u.id) as total_merchants,
          COUNT(DISTINCT CASE WHEN recent_activity.has_recent_activity THEN u.id END) as active_merchants,
          SUM(COALESCE(revenue_stats.total_revenue, 0)) as total_revenue,
          SUM(COALESCE(order_stats.total_orders, 0)) as total_orders,
          AVG(COALESCE(performance_stats.performance_score, 0)) as avg_performance_score
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
            SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue
          FROM merchant_transactions
          GROUP BY merchant_id
        ) revenue_stats ON u.id = revenue_stats.merchant_id
        LEFT JOIN (
          SELECT
            p.merchant_id,
            COUNT(DISTINCT o.id) as total_orders
          FROM products p
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id
          GROUP BY p.merchant_id
        ) order_stats ON u.id = order_stats.merchant_id
        LEFT JOIN (
          SELECT
            merchant_id,
            (100 - COALESCE(overall_score, 50)) as performance_score
          FROM merchant_risk_scores
        ) performance_stats ON u.id = performance_stats.merchant_id
        WHERE u.role = 'MERCHANT'
      `;

      const distributionQuery = `
        SELECT
          tier_distribution.tier,
          tier_distribution.count,
          automation_distribution.automation_level,
          automation_distribution.count as automation_count
        FROM (
          SELECT
            CASE
              WHEN performance_score >= 80 THEN 'DIAMOND'
              WHEN performance_score >= 65 THEN 'PLATINUM'
              WHEN performance_score >= 50 THEN 'GOLD'
              WHEN performance_score >= 35 THEN 'SILVER'
              ELSE 'BRONZE'
            END as tier,
            COUNT(*) as count
          FROM (
            SELECT
              u.id,
              COALESCE(100 - mrs.overall_score, 50) as performance_score
            FROM users u
            LEFT JOIN merchant_risk_scores mrs ON u.id = mrs.merchant_id
            WHERE u.role = 'MERCHANT'
          ) merchant_tiers
          GROUP BY tier
        ) tier_distribution
        FULL OUTER JOIN (
          SELECT
            COALESCE(automation_level, 'PARTIAL') as automation_level,
            COUNT(*) as count
          FROM users u
          LEFT JOIN merchant_risk_scores mrs ON u.id = mrs.merchant_id
          WHERE u.role = 'MERCHANT'
          GROUP BY automation_level
        ) automation_distribution ON true
      `;

      const [platformResult, distributionResult] = await Promise.all([
        client.query(platformQuery),
        client.query(distributionQuery)
      ]);

      const platformRow = platformResult.rows[0];

      const byTier: Record<string, number> = {};
      const byAutomationLevel: Record<string, number> = {};

      distributionResult.rows.forEach(row => {
        if (row.tier) byTier[row.tier] = parseInt(row.count);
        if (row.automation_level) byAutomationLevel[row.automation_level] = parseInt(row.automation_count);
      });

      // Get top performers (simplified)
      const topPerformers: MerchantPerformanceMetrics[] = []; // Would implement full calculation

      return {
        totalMerchants: parseInt(platformRow.total_merchants) || 0,
        activeMerchants: parseInt(platformRow.active_merchants) || 0,
        totalRevenue: parseFloat(platformRow.total_revenue) || 0,
        totalOrders: parseInt(platformRow.total_orders) || 0,
        averagePerformanceScore: parseFloat(platformRow.avg_performance_score) || 0,
        topPerformers,
        merchantDistribution: {
          byTier,
          byAutomationLevel,
          byPerformanceScore: {} // Would implement score distribution
        },
        platformTrends: {
          revenueGrowth: 0, // Would calculate from historical data
          merchantGrowth: 0,
          orderGrowth: 0,
          automationAdoption: 0
        }
      };

    } catch (error) {
      console.error('Error getting platform analytics:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Clear cache for specific merchant
   */
  public clearCache(merchantId?: string): void {
    if (merchantId) {
      this.performanceCache.delete(merchantId);
      this.cacheExpiry.delete(merchantId);
    } else {
      this.performanceCache.clear();
      this.cacheExpiry.clear();
    }
  }
}
