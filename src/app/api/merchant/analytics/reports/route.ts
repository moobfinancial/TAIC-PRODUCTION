import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { MerchantPerformanceEngine } from '@/lib/analytics/merchantPerformanceEngine';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

const performanceEngine = new MerchantPerformanceEngine();

interface ReportRequest {
  reportName: string;
  reportType: 'PERFORMANCE' | 'FINANCIAL' | 'ORDERS' | 'PRODUCTS' | 'CUSTOM';
  dateRangeStart: string;
  dateRangeEnd: string;
  filters?: Record<string, any>;
  includeCharts?: boolean;
  format?: 'JSON' | 'CSV' | 'PDF';
}

interface ScheduledReportRequest {
  reportName: string;
  reportType: 'PERFORMANCE' | 'FINANCIAL' | 'ORDERS' | 'PRODUCTS' | 'CUSTOM';
  scheduleFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  filters?: Record<string, any>;
  isActive?: boolean;
}

async function authenticateRequest(request: NextRequest): Promise<{ user: any } | { error: string }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    if (!decoded.id || decoded.role !== 'MERCHANT') {
      return { error: 'Invalid token or insufficient permissions' };
    }

    return { user: decoded };
  } catch (error) {
    return { error: 'Invalid token' };
  }
}

/**
 * GET /api/merchant/analytics/reports
 * Get merchant reports and scheduled reports
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    // Authenticate merchant
    const auth = await authenticateRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const merchantId = auth.user.id;
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type');
    const scheduled = url.searchParams.get('scheduled') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    client = await pool.connect();

    let query = `
      SELECT 
        id,
        report_name,
        report_type,
        date_range_start,
        date_range_end,
        filters,
        is_scheduled,
        schedule_frequency,
        next_generation_date,
        created_at,
        updated_at,
        CASE WHEN report_data IS NOT NULL THEN true ELSE false END as has_data
      FROM merchant_reports 
      WHERE merchant_id = $1
    `;
    
    const params: any[] = [merchantId];
    let paramIndex = 2;

    if (reportType) {
      query += ` AND report_type = $${paramIndex}`;
      params.push(reportType);
      paramIndex++;
    }

    if (scheduled) {
      query += ` AND is_scheduled = true`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM merchant_reports 
      WHERE merchant_id = $1
    `;
    const countParams = [merchantId];
    
    if (reportType) {
      countQuery += ` AND report_type = $2`;
      countParams.push(reportType);
    }
    
    if (scheduled) {
      countQuery += ` AND is_scheduled = true`;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      data: {
        reports: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching merchant reports:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch reports',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

/**
 * POST /api/merchant/analytics/reports
 * Generate a new report or create scheduled report
 */
export async function POST(request: NextRequest) {
  let client;
  try {
    // Authenticate merchant
    const auth = await authenticateRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const merchantId = auth.user.id;
    const body = await request.json();

    // Validate request based on whether it's a scheduled report or immediate report
    if (body.isScheduled) {
      const scheduleData = body as ScheduledReportRequest;
      
      if (!scheduleData.reportName || !scheduleData.reportType || !scheduleData.scheduleFrequency) {
        return NextResponse.json(
          { error: 'Missing required fields for scheduled report: reportName, reportType, scheduleFrequency' },
          { status: 400 }
        );
      }

      client = await pool.connect();

      // Calculate next generation date
      let nextGenerationDate = new Date();
      switch (scheduleData.scheduleFrequency) {
        case 'DAILY':
          nextGenerationDate.setDate(nextGenerationDate.getDate() + 1);
          break;
        case 'WEEKLY':
          nextGenerationDate.setDate(nextGenerationDate.getDate() + 7);
          break;
        case 'MONTHLY':
          nextGenerationDate.setMonth(nextGenerationDate.getMonth() + 1);
          break;
      }

      // Create scheduled report
      const insertQuery = `
        INSERT INTO merchant_reports (
          merchant_id, report_name, report_type, date_range_start, date_range_end,
          filters, report_data, generated_by, is_scheduled, schedule_frequency, next_generation_date
        ) VALUES ($1, $2, $3, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, $4, '{}', $5, true, $6, $7)
        RETURNING id, report_name, schedule_frequency, next_generation_date
      `;

      const result = await client.query(insertQuery, [
        merchantId,
        scheduleData.reportName,
        scheduleData.reportType,
        JSON.stringify(scheduleData.filters || {}),
        merchantId,
        scheduleData.scheduleFrequency,
        nextGenerationDate
      ]);

      return NextResponse.json({
        success: true,
        message: 'Scheduled report created successfully',
        data: result.rows[0]
      });

    } else {
      const reportData = body as ReportRequest;
      
      if (!reportData.reportName || !reportData.reportType || !reportData.dateRangeStart || !reportData.dateRangeEnd) {
        return NextResponse.json(
          { error: 'Missing required fields: reportName, reportType, dateRangeStart, dateRangeEnd' },
          { status: 400 }
        );
      }

      // Generate immediate report
      const reportContent = await generateReportData(merchantId, reportData);

      client = await pool.connect();

      // Save report to database
      const insertQuery = `
        INSERT INTO merchant_reports (
          merchant_id, report_name, report_type, date_range_start, date_range_end,
          filters, report_data, generated_by, is_scheduled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING id, report_name, created_at
      `;

      const result = await client.query(insertQuery, [
        merchantId,
        reportData.reportName,
        reportData.reportType,
        reportData.dateRangeStart,
        reportData.dateRangeEnd,
        JSON.stringify(reportData.filters || {}),
        JSON.stringify(reportContent),
        merchantId
      ]);

      return NextResponse.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          reportId: result.rows[0].id,
          reportName: result.rows[0].report_name,
          generatedAt: result.rows[0].created_at,
          reportData: reportContent
        }
      });
    }

  } catch (error: any) {
    console.error('Error creating merchant report:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create report',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

/**
 * Generate report data based on type and parameters
 */
async function generateReportData(merchantId: string, reportRequest: ReportRequest): Promise<any> {
  const startDate = new Date(reportRequest.dateRangeStart);
  const endDate = new Date(reportRequest.dateRangeEnd);

  switch (reportRequest.reportType) {
    case 'PERFORMANCE':
      return await generatePerformanceReport(merchantId, startDate, endDate, reportRequest.filters);
    
    case 'FINANCIAL':
      return await generateFinancialReport(merchantId, startDate, endDate, reportRequest.filters);
    
    case 'ORDERS':
      return await generateOrdersReport(merchantId, startDate, endDate, reportRequest.filters);
    
    case 'PRODUCTS':
      return await generateProductsReport(merchantId, startDate, endDate, reportRequest.filters);
    
    default:
      throw new Error(`Unsupported report type: ${reportRequest.reportType}`);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport(merchantId: string, startDate: Date, endDate: Date, filters?: any): Promise<any> {
  const performance = await performanceEngine.getMerchantPerformance(merchantId, true);
  const insights = await performanceEngine.generateInsights(merchantId);
  const comparison = await performanceEngine.getMerchantComparison(merchantId);

  return {
    reportType: 'PERFORMANCE',
    dateRange: { start: startDate, end: endDate },
    summary: {
      performanceScore: performance.platform.performanceScore,
      merchantTier: performance.platform.merchantTier,
      platformRank: performance.platform.platformRank,
      percentile: performance.platform.percentile
    },
    metrics: {
      financial: performance.financial,
      orders: performance.orders,
      products: performance.products,
      automation: performance.automation,
      payouts: performance.payouts
    },
    trends: performance.trends,
    insights: insights,
    platformComparison: comparison,
    generatedAt: new Date()
  };
}

/**
 * Generate financial report
 */
async function generateFinancialReport(merchantId: string, startDate: Date, endDate: Date, filters?: any): Promise<any> {
  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        transaction_type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        currency
      FROM merchant_transactions
      WHERE merchant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND status = 'COMPLETED'
      GROUP BY DATE_TRUNC('day', created_at), transaction_type, currency
      ORDER BY date, transaction_type
    `;

    const result = await client.query(query, [merchantId, startDate, endDate]);

    // Process data for report
    const dailyData: Record<string, any> = {};
    let totalRevenue = 0;
    let totalCommissions = 0;
    let totalPayouts = 0;

    result.rows.forEach(row => {
      const dateKey = row.date.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, sales: 0, commissions: 0, payouts: 0 };
      }

      const amount = parseFloat(row.total_amount);
      switch (row.transaction_type) {
        case 'SALE':
          dailyData[dateKey].sales += amount;
          totalRevenue += amount;
          break;
        case 'COMMISSION':
          dailyData[dateKey].commissions += amount;
          totalCommissions += amount;
          break;
        case 'PAYOUT':
          dailyData[dateKey].payouts += amount;
          totalPayouts += amount;
          break;
      }
    });

    return {
      reportType: 'FINANCIAL',
      dateRange: { start: startDate, end: endDate },
      summary: {
        totalRevenue,
        totalCommissions,
        totalPayouts,
        netEarnings: totalRevenue - totalCommissions,
        transactionCount: result.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0)
      },
      dailyBreakdown: Object.values(dailyData),
      generatedAt: new Date()
    };

  } finally {
    if (client) client.release();
  }
}

/**
 * Generate orders report
 */
async function generateOrdersReport(merchantId: string, startDate: Date, endDate: Date, filters?: any): Promise<any> {
  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT 
        o.id,
        o.status,
        o.amount,
        o.currency,
        o.created_at,
        o.updated_at,
        oi.product_name_snapshot,
        oi.quantity,
        oi.price_per_item
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.merchant_id = $1 
        AND o.created_at >= $2 
        AND o.created_at <= $3
      ORDER BY o.created_at DESC
    `;

    const result = await client.query(query, [merchantId, startDate, endDate]);

    // Process orders data
    const orders = result.rows;
    const statusCounts: Record<string, number> = {};
    let totalOrderValue = 0;

    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      totalOrderValue += parseFloat(order.amount);
    });

    return {
      reportType: 'ORDERS',
      dateRange: { start: startDate, end: endDate },
      summary: {
        totalOrders: orders.length,
        totalOrderValue,
        averageOrderValue: orders.length > 0 ? totalOrderValue / orders.length : 0,
        statusDistribution: statusCounts
      },
      orders: orders.slice(0, 100), // Limit to first 100 orders for report
      generatedAt: new Date()
    };

  } finally {
    if (client) client.release();
  }
}

/**
 * Generate products report
 */
async function generateProductsReport(merchantId: string, startDate: Date, endDate: Date, filters?: any): Promise<any> {
  let client;
  try {
    client = await pool.connect();

    const query = `
      SELECT 
        p.id,
        p.name,
        p.approval_status,
        p.stock_quantity,
        p.reorder_level,
        p.price,
        p.merchant_commission_rate,
        COALESCE(sales_data.total_sold, 0) as total_sold,
        COALESCE(sales_data.total_revenue, 0) as total_revenue
      FROM products p
      LEFT JOIN (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          SUM(oi.quantity * oi.price_per_item) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= $2 AND o.created_at <= $3
          AND o.status IN ('delivered', 'completed')
        GROUP BY oi.product_id
      ) sales_data ON p.id = sales_data.product_id
      WHERE p.merchant_id = $1
      ORDER BY sales_data.total_revenue DESC NULLS LAST
    `;

    const result = await client.query(query, [merchantId, startDate, endDate]);

    const products = result.rows;
    const totalProducts = products.length;
    const approvedProducts = products.filter(p => p.approval_status === 'approved').length;
    const lowStockProducts = products.filter(p => p.stock_quantity <= p.reorder_level).length;
    const outOfStockProducts = products.filter(p => p.stock_quantity === 0).length;

    return {
      reportType: 'PRODUCTS',
      dateRange: { start: startDate, end: endDate },
      summary: {
        totalProducts,
        approvedProducts,
        approvalRate: totalProducts > 0 ? (approvedProducts / totalProducts) * 100 : 0,
        lowStockProducts,
        outOfStockProducts,
        inventoryHealth: totalProducts > 0 ? ((totalProducts - outOfStockProducts) / totalProducts) * 100 : 100
      },
      topPerformers: products.slice(0, 10),
      inventoryAlerts: {
        lowStock: products.filter(p => p.stock_quantity <= p.reorder_level && p.stock_quantity > 0),
        outOfStock: products.filter(p => p.stock_quantity === 0)
      },
      generatedAt: new Date()
    };

  } finally {
    if (client) client.release();
  }
}
