import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { MerchantPerformanceEngine } from '@/lib/analytics/merchantPerformanceEngine';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

const performanceEngine = new MerchantPerformanceEngine();

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
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
 * GET /api/merchant/analytics/performance
 * Get comprehensive performance metrics for authenticated merchant
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate merchant
    const auth = await authenticateRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const merchantId = auth.user.id;
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const includeInsights = url.searchParams.get('insights') === 'true';
    const includeComparison = url.searchParams.get('comparison') === 'true';

    // Get comprehensive performance metrics
    const performance = await performanceEngine.getMerchantPerformance(merchantId, forceRefresh);

    // Optionally include insights
    let insights = null;
    if (includeInsights) {
      insights = await performanceEngine.generateInsights(merchantId);
    }

    // Optionally include platform comparison
    let comparison = null;
    if (includeComparison) {
      comparison = await performanceEngine.getMerchantComparison(merchantId);
    }

    const response = {
      success: true,
      data: {
        performance,
        insights,
        comparison,
        lastUpdated: performance.lastUpdated
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching merchant performance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch performance metrics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merchant/analytics/performance
 * Trigger performance metrics recalculation
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate merchant
    const auth = await authenticateRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const merchantId = auth.user.id;

    // Clear cache and recalculate
    performanceEngine.clearCache(merchantId);
    const performance = await performanceEngine.getMerchantPerformance(merchantId, true);

    return NextResponse.json({
      success: true,
      message: 'Performance metrics recalculated successfully',
      data: {
        performance,
        recalculatedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('Error recalculating merchant performance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to recalculate performance metrics',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/merchant/analytics/performance
 * Update performance insights acknowledgment
 */
export async function PUT(request: NextRequest) {
  let client;
  try {
    // Authenticate merchant
    const auth = await authenticateRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const merchantId = auth.user.id;
    const body = await request.json();
    const { insightIds, action } = body;

    if (!insightIds || !Array.isArray(insightIds) || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: insightIds (array) and action' },
        { status: 400 }
      );
    }

    client = await pool.connect();

    if (action === 'acknowledge') {
      // Acknowledge insights
      const query = `
        UPDATE merchant_performance_insights 
        SET acknowledged_at = NOW(), acknowledged_by = $1, updated_at = NOW()
        WHERE id = ANY($2) AND merchant_id = $3 AND acknowledged_at IS NULL
        RETURNING id, title
      `;
      
      const result = await client.query(query, [merchantId, insightIds, merchantId]);
      
      return NextResponse.json({
        success: true,
        message: `${result.rows.length} insights acknowledged`,
        acknowledgedInsights: result.rows
      });

    } else if (action === 'dismiss') {
      // Dismiss insights (mark as inactive)
      const query = `
        UPDATE merchant_performance_insights 
        SET is_active = false, updated_at = NOW()
        WHERE id = ANY($1) AND merchant_id = $2 AND is_active = true
        RETURNING id, title
      `;
      
      const result = await client.query(query, [insightIds, merchantId]);
      
      return NextResponse.json({
        success: true,
        message: `${result.rows.length} insights dismissed`,
        dismissedInsights: result.rows
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "acknowledge" or "dismiss"' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error updating performance insights:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update insights',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
