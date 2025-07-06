import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.MERCHANT_JWT_SECRET || process.env.JWT_SECRET || 'your-fallback-merchant-jwt-secret';

interface MerchantAuthPayload {
  merchantId: string;
}

// Merchant auth verification
async function verifyMerchantAuth(request: NextRequest): Promise<{ valid: boolean; merchantId?: string; error?: string; status?: number }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed', status: 401 };
  }
  const token = authHeader.substring(7);
  if (!token) {
    return { valid: false, error: 'Token not found', status: 401 };
  }
  try {
    if (!JWT_SECRET) {
        console.error("MERCHANT_JWT_SECRET or JWT_SECRET is not defined in environment variables.");
        return { valid: false, error: 'Authentication secret not configured on server.', status: 500 };
    }
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & MerchantAuthPayload;
    if (!decoded.merchantId) {
      return { valid: false, error: 'Invalid token: merchantId missing', status: 401 };
    }
    return { valid: true, merchantId: String(decoded.merchantId) };
  } catch (error: any) {
    let errorMessage = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') errorMessage = 'Token expired';
    return { valid: false, error: errorMessage, status: 401 };
  }
}

interface ProductApprovalStatus {
  id: string;
  name: string;
  approval_status: string;
  is_active: boolean;
  admin_review_notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  price: number;
  image_url: string | null;
}

interface ApprovalStatusSummary {
  totalProducts: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  draftCount: number;
  averageApprovalTime: number | null; // in hours
  recentSubmissions: number; // last 7 days
  recentApprovals: number; // last 7 days
  recentRejections: number; // last 7 days
}

// GET - Get approval status for merchant's products
export async function GET(request: NextRequest) {
  const authResult = await verifyMerchantAuth(request);
  if (!authResult.valid || !authResult.merchantId) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
  }
  const merchantId = authResult.merchantId;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // Filter by specific status
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const sortBy = searchParams.get('sortBy') || 'updated_at'; // updated_at, created_at, name, approval_status
  const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC, DESC

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Build the main query
    let whereConditions = ['p.merchant_id = $1'];
    let queryParams: any[] = [merchantId];
    let paramIndex = 2;

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      whereConditions.push(`p.approval_status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (!includeInactive) {
      whereConditions.push(`p.is_active = true`);
    }

    const whereClause = whereConditions.join(' AND ');
    const orderByClause = `ORDER BY p.${sortBy} ${sortOrder}`;

    // Get products with approval status
    const productsQuery = `
      SELECT 
        p.id,
        p.name,
        p.approval_status,
        p.is_active,
        p.admin_review_notes,
        p.price,
        p.image_url,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        -- Calculate submission time (when status changed to pending)
        (SELECT created_at FROM merchant_transactions 
         WHERE merchant_id = p.merchant_id 
         AND reference_id LIKE 'product_submission_%_' || p.id 
         ORDER BY created_at DESC LIMIT 1) as submitted_at,
        -- Calculate approval time (when status changed to approved)
        CASE 
          WHEN p.approval_status = 'approved' THEN p.updated_at
          ELSE NULL
        END as approved_at,
        -- Calculate rejection time (when status changed to rejected)
        CASE 
          WHEN p.approval_status = 'rejected' THEN p.updated_at
          ELSE NULL
        END as rejected_at
      FROM products p
      LEFT JOIN categories c ON p.platform_category_id = c.id
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    queryParams.push(limit, offset);

    const productsResult = await client.query(productsQuery, queryParams);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN approval_status NOT IN ('pending', 'approved', 'rejected') THEN 1 END) as draft_count,
        -- Average approval time in hours for approved products
        AVG(
          CASE 
            WHEN approval_status = 'approved' THEN 
              EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
            ELSE NULL
          END
        ) as avg_approval_time_hours,
        -- Recent activity (last 7 days)
        COUNT(CASE 
          WHEN created_at >= NOW() - INTERVAL '7 days' 
          AND approval_status = 'pending' THEN 1 
        END) as recent_submissions,
        COUNT(CASE 
          WHEN updated_at >= NOW() - INTERVAL '7 days' 
          AND approval_status = 'approved' THEN 1 
        END) as recent_approvals,
        COUNT(CASE 
          WHEN updated_at >= NOW() - INTERVAL '7 days' 
          AND approval_status = 'rejected' THEN 1 
        END) as recent_rejections
      FROM products
      WHERE merchant_id = $1
    `;

    const summaryResult = await client.query(summaryQuery, [merchantId]);
    const summaryData = summaryResult.rows[0];

    // Format products data
    const products: ProductApprovalStatus[] = productsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      approval_status: row.approval_status,
      is_active: row.is_active,
      admin_review_notes: row.admin_review_notes,
      submitted_at: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      rejected_at: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      category_name: row.category_name,
      price: parseFloat(row.price),
      image_url: row.image_url
    }));

    // Format summary data
    const summary: ApprovalStatusSummary = {
      totalProducts: parseInt(summaryData.total_products),
      pendingCount: parseInt(summaryData.pending_count),
      approvedCount: parseInt(summaryData.approved_count),
      rejectedCount: parseInt(summaryData.rejected_count),
      draftCount: parseInt(summaryData.draft_count),
      averageApprovalTime: summaryData.avg_approval_time_hours ? parseFloat(summaryData.avg_approval_time_hours) : null,
      recentSubmissions: parseInt(summaryData.recent_submissions),
      recentApprovals: parseInt(summaryData.recent_approvals),
      recentRejections: parseInt(summaryData.recent_rejections)
    };

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      WHERE ${whereConditions.join(' AND ')}
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
        status: status || 'all',
        includeInactive,
        sortBy,
        sortOrder
      }
    });

  } catch (error: any) {
    console.error("Error fetching product approval status:", error);
    return NextResponse.json({ error: "Failed to fetch product approval status", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
