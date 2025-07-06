import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

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

interface PendingProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_name: string | null;
  merchant_id: string;
  merchant_name: string;
  merchant_email: string;
  approval_status: string;
  is_active: boolean;
  admin_review_notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  days_pending: number;
  priority_score: number;
  has_variants: boolean;
  variant_count: number;
  stock_quantity: number;
}

interface ApprovalQueueSummary {
  totalPending: number;
  highPriorityCount: number;
  overduePending: number; // > 3 days
  averagePendingDays: number;
  todaySubmissions: number;
  weeklySubmissions: number;
  merchantsWithPending: number;
}

// GET - Get pending products approval queue
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortBy = searchParams.get('sortBy') || 'priority_score'; // priority_score, created_at, updated_at, days_pending, merchant_name
  const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC, DESC
  const merchantId = searchParams.get('merchantId'); // Filter by specific merchant
  const priority = searchParams.get('priority'); // HIGH, NORMAL, LOW
  const search = searchParams.get('search'); // Search in product name or merchant name

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Build the main query with priority scoring
    let whereConditions = ["p.approval_status = 'pending'"];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (merchantId) {
      whereConditions.push(`p.merchant_id = $${paramIndex++}`);
      queryParams.push(merchantId);
    }

    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex++} OR u.username ILIKE $${paramIndex} OR u.business_name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Priority scoring algorithm:
    // - Days pending (weight: 3)
    // - Has variants (weight: 1)
    // - Price tier (weight: 2)
    // - Merchant submission frequency (weight: 1)
    const priorityScoreQuery = `
      (
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 * 3 +  -- Days pending * 3
        CASE WHEN p.has_variants THEN 1 ELSE 0 END +               -- Has variants bonus
        CASE 
          WHEN p.price > 100 THEN 2 
          WHEN p.price > 50 THEN 1 
          ELSE 0 
        END +                                                      -- Price tier bonus
        COALESCE(merchant_stats.submission_frequency_score, 0)     -- Merchant activity score
      )
    `;

    // Get pending products with detailed information
    const productsQuery = `
      WITH merchant_stats AS (
        SELECT 
          merchant_id,
          COUNT(*) as total_submissions,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_submissions,
          CASE 
            WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 10 THEN 2
            WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 5 THEN 1
            ELSE 0
          END as submission_frequency_score
        FROM products
        WHERE approval_status IN ('pending', 'approved', 'rejected')
        GROUP BY merchant_id
      )
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.merchant_id,
        p.approval_status,
        p.is_active,
        p.admin_review_notes,
        p.created_at,
        p.updated_at,
        p.has_variants,
        p.stock_quantity,
        c.name as category_name,
        u.username as merchant_name,
        u.email as merchant_email,
        u.business_name as merchant_business_name,
        -- Calculate submission time
        (SELECT created_at FROM merchant_transactions 
         WHERE merchant_id = p.merchant_id 
         AND reference_id LIKE 'product_submission_%_' || p.id 
         ORDER BY created_at DESC LIMIT 1) as submitted_at,
        -- Calculate days pending
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as days_pending,
        -- Priority score
        ${priorityScoreQuery} as priority_score,
        -- Variant count
        COALESCE(variant_counts.variant_count, 0) as variant_count
      FROM products p
      LEFT JOIN categories c ON p.platform_category_id = c.id
      LEFT JOIN users u ON p.merchant_id = u.id
      LEFT JOIN merchant_stats ON p.merchant_id = merchant_stats.merchant_id
      LEFT JOIN (
        SELECT product_id, COUNT(*) as variant_count
        FROM product_variants
        GROUP BY product_id
      ) variant_counts ON p.id = variant_counts.product_id
      WHERE ${whereClause}
      ORDER BY ${sortBy === 'priority_score' ? 'priority_score' : `p.${sortBy}`} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    queryParams.push(limit, offset);

    const productsResult = await client.query(productsQuery, queryParams);

    // Get summary statistics
    const summaryQuery = `
      WITH pending_stats AS (
        SELECT 
          COUNT(*) as total_pending,
          COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 > 3 THEN 1 END) as overdue_pending,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_pending_days,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_submissions,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as weekly_submissions,
          COUNT(DISTINCT merchant_id) as merchants_with_pending
        FROM products
        WHERE approval_status = 'pending'
      ),
      priority_stats AS (
        SELECT 
          COUNT(CASE WHEN ${priorityScoreQuery} > 10 THEN 1 END) as high_priority_count
        FROM products p
        LEFT JOIN (
          SELECT 
            merchant_id,
            CASE 
              WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 10 THEN 2
              WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 5 THEN 1
              ELSE 0
            END as submission_frequency_score
          FROM products
          WHERE approval_status IN ('pending', 'approved', 'rejected')
          GROUP BY merchant_id
        ) merchant_stats ON p.merchant_id = merchant_stats.merchant_id
        WHERE p.approval_status = 'pending'
      )
      SELECT 
        ps.*,
        prs.high_priority_count
      FROM pending_stats ps, priority_stats prs
    `;

    const summaryResult = await client.query(summaryQuery);
    const summaryData = summaryResult.rows[0];

    // Format products data
    const products: PendingProduct[] = productsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      image_url: row.image_url,
      category_name: row.category_name,
      merchant_id: row.merchant_id,
      merchant_name: row.merchant_business_name || row.merchant_name,
      merchant_email: row.merchant_email,
      approval_status: row.approval_status,
      is_active: row.is_active,
      admin_review_notes: row.admin_review_notes,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      submitted_at: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      days_pending: Math.round(parseFloat(row.days_pending) * 10) / 10,
      priority_score: Math.round(parseFloat(row.priority_score) * 10) / 10,
      has_variants: row.has_variants,
      variant_count: parseInt(row.variant_count),
      stock_quantity: parseInt(row.stock_quantity)
    }));

    // Format summary data
    const summary: ApprovalQueueSummary = {
      totalPending: parseInt(summaryData.total_pending),
      highPriorityCount: parseInt(summaryData.high_priority_count),
      overduePending: parseInt(summaryData.overdue_pending),
      averagePendingDays: summaryData.avg_pending_days ? Math.round(parseFloat(summaryData.avg_pending_days) * 10) / 10 : 0,
      todaySubmissions: parseInt(summaryData.today_submissions),
      weeklySubmissions: parseInt(summaryData.weekly_submissions),
      merchantsWithPending: parseInt(summaryData.merchants_with_pending)
    };

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN users u ON p.merchant_id = u.id
      WHERE ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset
    const totalCount = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      products,
      summary,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      filters: {
        merchantId: merchantId || null,
        priority: priority || null,
        search: search || null,
        sortBy,
        sortOrder
      }
    });

  } catch (error: any) {
    console.error("Error fetching pending products approval queue:", error);
    return NextResponse.json({ error: "Failed to fetch pending products approval queue", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
