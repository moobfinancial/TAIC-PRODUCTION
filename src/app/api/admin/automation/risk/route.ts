import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AutomatedPayoutEngine } from '@/lib/automation/automatedPayoutEngine';
import { TreasuryWalletSystem } from '@/lib/treasury/treasuryWalletSystem';
import { CryptoWalletService } from '@/lib/crypto/walletService';

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

const UpdateRiskScoreSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID'),
  overallScore: z.number().min(0).max(100).optional(),
  automationLevel: z.enum(['FULL', 'PARTIAL', 'MANUAL_REVIEW']).optional(),
  dailyLimit: z.number().positive().optional(),
  weeklyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  singleTransactionLimit: z.number().positive().optional(),
  requiresApprovalAbove: z.number().positive().optional(),
  factors: z.object({
    transactionHistory: z.number().min(0).max(25).optional(),
    chargebackRate: z.number().min(0).max(25).optional(),
    accountAge: z.number().min(0).max(15).optional(),
    verificationLevel: z.number().min(0).max(15).optional(),
    recentActivity: z.number().min(0).max(20).optional()
  }).optional()
});

const BulkRiskUpdateSchema = z.object({
  merchantIds: z.array(z.string().uuid()).min(1).max(100),
  automationLevel: z.enum(['FULL', 'PARTIAL', 'MANUAL_REVIEW']).optional(),
  adjustmentFactor: z.number().min(0.1).max(2.0).optional(), // Multiply limits by this factor
  reason: z.string().min(1, 'Reason is required')
});

// Initialize automation engine
const treasurySystem = new TreasuryWalletSystem({
  multiSigEnabled: true,
  hsmConfig: {
    enabled: process.env.HSM_ENABLED === 'true',
    provider: (process.env.HSM_PROVIDER as any) || 'AWS_CLOUDHSM',
    keyId: process.env.HSM_KEY_ID || '',
    region: process.env.HSM_REGION || 'us-east-1'
  },
  emergencyLockEnabled: true,
  dailyLimits: { LOW: '10000', MEDIUM: '100000', HIGH: '1000000', CRITICAL: '10000000' },
  monthlyLimits: { LOW: '100000', MEDIUM: '1000000', HIGH: '10000000', CRITICAL: '100000000' },
  riskThresholds: { low: 25, medium: 50, high: 75, critical: 90 },
  complianceRequired: true,
  auditingEnabled: true,
  geofencingEnabled: false,
  allowedRegions: ['US', 'EU', 'CA'],
  timeBasedRestrictions: { enabled: false, allowedHours: { start: 9, end: 17 }, timezone: 'UTC' }
});

const cryptoWalletService = new CryptoWalletService();
const automationEngine = new AutomatedPayoutEngine(treasurySystem, cryptoWalletService);

// GET - Fetch merchant risk scores and automation eligibility
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');
  const automationLevel = searchParams.get('automationLevel');
  const riskThreshold = searchParams.get('riskThreshold');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    if (merchantId) {
      // Get specific merchant risk score
      const merchantQuery = `
        SELECT 
          mrs.*,
          u.email as merchant_email,
          u.created_at as merchant_created_at,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders,
          COUNT(DISTINCT mpr.id) as total_payouts,
          COALESCE(SUM(mpr.requested_amount), 0) as total_payout_amount
        FROM merchant_risk_scores mrs
        LEFT JOIN users u ON mrs.merchant_id = u.id
        LEFT JOIN orders o ON u.id = o.merchant_id
        LEFT JOIN merchant_payout_requests mpr ON u.id = mpr.merchant_id
        WHERE mrs.merchant_id = $1
        GROUP BY mrs.id, u.email, u.created_at
      `;

      const result = await client.query(merchantQuery, [merchantId]);

      if (result.rows.length === 0) {
        // Try to calculate risk score for merchant
        try {
          const riskScore = await automationEngine.calculateMerchantRiskScore(merchantId);
          return NextResponse.json({
            riskScore: {
              merchantId: riskScore.merchantId,
              overallScore: riskScore.overallScore,
              factors: riskScore.factors,
              automationLevel: riskScore.automationLevel,
              dailyLimit: riskScore.dailyLimit,
              weeklyLimit: riskScore.weeklyLimit,
              monthlyLimit: riskScore.monthlyLimit,
              singleTransactionLimit: riskScore.singleTransactionLimit,
              requiresApprovalAbove: riskScore.requiresApprovalAbove,
              lastUpdated: riskScore.lastUpdated.toISOString(),
              isNewCalculation: true
            }
          });
        } catch (error) {
          return NextResponse.json({ error: 'Merchant not found or risk calculation failed' }, { status: 404 });
        }
      }

      const row = result.rows[0];
      return NextResponse.json({
        riskScore: {
          merchantId: row.merchant_id,
          merchantEmail: row.merchant_email,
          overallScore: row.overall_score,
          factors: {
            transactionHistory: row.transaction_history_score,
            chargebackRate: row.chargeback_rate_score,
            accountAge: row.account_age_score,
            verificationLevel: row.verification_level_score,
            recentActivity: row.recent_activity_score
          },
          automationLevel: row.automation_level,
          dailyLimit: parseFloat(row.daily_limit),
          weeklyLimit: parseFloat(row.weekly_limit),
          monthlyLimit: parseFloat(row.monthly_limit),
          singleTransactionLimit: parseFloat(row.single_transaction_limit),
          requiresApprovalAbove: parseFloat(row.requires_approval_above),
          lastUpdated: row.last_updated,
          isActive: row.is_active,
          merchantStats: {
            accountAge: Math.floor((Date.now() - new Date(row.merchant_created_at).getTime()) / (1000 * 60 * 60 * 24)),
            totalOrders: parseInt(row.total_orders),
            totalRevenue: parseFloat(row.total_revenue),
            recentOrders: parseInt(row.recent_orders),
            totalPayouts: parseInt(row.total_payouts),
            totalPayoutAmount: parseFloat(row.total_payout_amount)
          }
        }
      });
    }

    // Get all merchant risk scores with filters
    let whereConditions = ['mrs.is_active = true'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (automationLevel) {
      whereConditions.push(`mrs.automation_level = $${paramIndex++}`);
      queryParams.push(automationLevel);
    }

    if (riskThreshold) {
      const threshold = parseInt(riskThreshold);
      whereConditions.push(`mrs.overall_score >= $${paramIndex++}`);
      queryParams.push(threshold);
    }

    const whereClause = whereConditions.join(' AND ');

    const riskScoresQuery = `
      SELECT 
        mrs.*,
        u.email as merchant_email,
        u.created_at as merchant_created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders
      FROM merchant_risk_scores mrs
      LEFT JOIN users u ON mrs.merchant_id = u.id
      LEFT JOIN orders o ON u.id = o.merchant_id
      WHERE ${whereClause}
      GROUP BY mrs.id, u.email, u.created_at
      ORDER BY mrs.overall_score DESC, mrs.last_updated DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    queryParams.push(limit, offset);

    const riskScoresResult = await client.query(riskScoresQuery, queryParams);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_merchants,
        COUNT(CASE WHEN automation_level = 'FULL' THEN 1 END) as full_automation,
        COUNT(CASE WHEN automation_level = 'PARTIAL' THEN 1 END) as partial_automation,
        COUNT(CASE WHEN automation_level = 'MANUAL_REVIEW' THEN 1 END) as manual_review,
        AVG(overall_score) as average_risk_score,
        COUNT(CASE WHEN overall_score >= 70 THEN 1 END) as high_risk_merchants,
        COUNT(CASE WHEN overall_score <= 30 THEN 1 END) as low_risk_merchants
      FROM merchant_risk_scores
      WHERE is_active = true
    `;

    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merchant_risk_scores mrs
      WHERE ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      riskScores: riskScoresResult.rows.map(row => ({
        merchantId: row.merchant_id,
        merchantEmail: row.merchant_email,
        overallScore: row.overall_score,
        factors: {
          transactionHistory: row.transaction_history_score,
          chargebackRate: row.chargeback_rate_score,
          accountAge: row.account_age_score,
          verificationLevel: row.verification_level_score,
          recentActivity: row.recent_activity_score
        },
        automationLevel: row.automation_level,
        dailyLimit: parseFloat(row.daily_limit),
        weeklyLimit: parseFloat(row.weekly_limit),
        monthlyLimit: parseFloat(row.monthly_limit),
        singleTransactionLimit: parseFloat(row.single_transaction_limit),
        requiresApprovalAbove: parseFloat(row.requires_approval_above),
        lastUpdated: row.last_updated,
        merchantStats: {
          accountAge: Math.floor((Date.now() - new Date(row.merchant_created_at).getTime()) / (1000 * 60 * 60 * 24)),
          totalOrders: parseInt(row.total_orders),
          totalRevenue: parseFloat(row.total_revenue),
          recentOrders: parseInt(row.recent_orders)
        }
      })),
      summary: {
        totalMerchants: parseInt(summary.total_merchants),
        fullAutomation: parseInt(summary.full_automation),
        partialAutomation: parseInt(summary.partial_automation),
        manualReview: parseInt(summary.manual_review),
        averageRiskScore: parseFloat(summary.average_risk_score) || 0,
        highRiskMerchants: parseInt(summary.high_risk_merchants),
        lowRiskMerchants: parseInt(summary.low_risk_merchants)
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      filters: {
        automationLevel: automationLevel || null,
        riskThreshold: riskThreshold || null
      }
    });

  } catch (error: any) {
    console.error("Error fetching merchant risk scores:", error);
    return NextResponse.json({ error: "Failed to fetch merchant risk scores", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// PUT - Update merchant risk score
export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = UpdateRiskScoreSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { merchantId, overallScore, automationLevel, dailyLimit, weeklyLimit, monthlyLimit, singleTransactionLimit, requiresApprovalAbove, factors } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check if merchant exists
    const merchantCheck = await client.query('SELECT id FROM users WHERE id = $1 AND role = $2', [merchantId, 'MERCHANT']);
    if (merchantCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get current risk score
    const currentQuery = `
      SELECT * FROM merchant_risk_scores WHERE merchant_id = $1
    `;
    const currentResult = await client.query(currentQuery, [merchantId]);

    let updateQuery: string;
    let updateParams: any[];

    if (currentResult.rows.length === 0) {
      // Create new risk score
      updateQuery = `
        INSERT INTO merchant_risk_scores (
          merchant_id, overall_score, transaction_history_score, chargeback_rate_score,
          account_age_score, verification_level_score, recent_activity_score,
          automation_level, daily_limit, weekly_limit, monthly_limit,
          single_transaction_limit, requires_approval_above, last_updated, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), true)
        RETURNING *
      `;
      updateParams = [
        merchantId,
        overallScore || 50,
        factors?.transactionHistory || 15,
        factors?.chargebackRate || 15,
        factors?.accountAge || 8,
        factors?.verificationLevel || 8,
        factors?.recentActivity || 10,
        automationLevel || 'PARTIAL',
        dailyLimit || 5000,
        weeklyLimit || 25000,
        monthlyLimit || 100000,
        singleTransactionLimit || 2500,
        requiresApprovalAbove || 5000
      ];
    } else {
      // Update existing risk score
      const current = currentResult.rows[0];
      updateQuery = `
        UPDATE merchant_risk_scores SET
          overall_score = $2,
          transaction_history_score = $3,
          chargeback_rate_score = $4,
          account_age_score = $5,
          verification_level_score = $6,
          recent_activity_score = $7,
          automation_level = $8,
          daily_limit = $9,
          weekly_limit = $10,
          monthly_limit = $11,
          single_transaction_limit = $12,
          requires_approval_above = $13,
          last_updated = NOW()
        WHERE merchant_id = $1
        RETURNING *
      `;
      updateParams = [
        merchantId,
        overallScore !== undefined ? overallScore : current.overall_score,
        factors?.transactionHistory !== undefined ? factors.transactionHistory : current.transaction_history_score,
        factors?.chargebackRate !== undefined ? factors.chargebackRate : current.chargeback_rate_score,
        factors?.accountAge !== undefined ? factors.accountAge : current.account_age_score,
        factors?.verificationLevel !== undefined ? factors.verificationLevel : current.verification_level_score,
        factors?.recentActivity !== undefined ? factors.recentActivity : current.recent_activity_score,
        automationLevel !== undefined ? automationLevel : current.automation_level,
        dailyLimit !== undefined ? dailyLimit : parseFloat(current.daily_limit),
        weeklyLimit !== undefined ? weeklyLimit : parseFloat(current.weekly_limit),
        monthlyLimit !== undefined ? monthlyLimit : parseFloat(current.monthly_limit),
        singleTransactionLimit !== undefined ? singleTransactionLimit : parseFloat(current.single_transaction_limit),
        requiresApprovalAbove !== undefined ? requiresApprovalAbove : parseFloat(current.requires_approval_above)
      ];
    }

    const updateResult = await client.query(updateQuery, updateParams);
    const updatedRiskScore = updateResult.rows[0];

    // Log the update in audit trail
    await client.query(`
      INSERT INTO automation_audit_log (
        event_type, performed_by, details, created_at
      ) VALUES ($1, 'ADMIN', $2, NOW())
    `, [
      'RISK_SCORE_UPDATED',
      JSON.stringify({
        merchantId,
        previousValues: currentResult.rows[0] || null,
        newValues: updatedRiskScore,
        updateType: currentResult.rows.length === 0 ? 'CREATE' : 'UPDATE'
      })
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Merchant risk score updated successfully',
      riskScore: {
        merchantId: updatedRiskScore.merchant_id,
        overallScore: updatedRiskScore.overall_score,
        factors: {
          transactionHistory: updatedRiskScore.transaction_history_score,
          chargebackRate: updatedRiskScore.chargeback_rate_score,
          accountAge: updatedRiskScore.account_age_score,
          verificationLevel: updatedRiskScore.verification_level_score,
          recentActivity: updatedRiskScore.recent_activity_score
        },
        automationLevel: updatedRiskScore.automation_level,
        dailyLimit: parseFloat(updatedRiskScore.daily_limit),
        weeklyLimit: parseFloat(updatedRiskScore.weekly_limit),
        monthlyLimit: parseFloat(updatedRiskScore.monthly_limit),
        singleTransactionLimit: parseFloat(updatedRiskScore.single_transaction_limit),
        requiresApprovalAbove: parseFloat(updatedRiskScore.requires_approval_above),
        lastUpdated: updatedRiskScore.last_updated
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error updating merchant risk score:", error);
    return NextResponse.json({ error: 'Failed to update merchant risk score', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Bulk update merchant risk scores or recalculate
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'recalculate') {
    // Recalculate risk scores for all merchants
    try {
      let client: PoolClient | undefined;
      client = await pool.connect();

      const merchantsQuery = `
        SELECT id FROM users WHERE role = 'MERCHANT' AND is_active = true
      `;
      const merchantsResult = await client.query(merchantsQuery);
      client.release();

      const results = [];
      for (const merchant of merchantsResult.rows) {
        try {
          const riskScore = await automationEngine.refreshMerchantRiskScore(merchant.id);
          results.push({
            merchantId: merchant.id,
            success: true,
            riskScore: riskScore.overallScore,
            automationLevel: riskScore.automationLevel
          });
        } catch (error) {
          results.push({
            merchantId: merchant.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Risk scores recalculated for ${results.length} merchants`,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error: any) {
      console.error("Error recalculating risk scores:", error);
      return NextResponse.json({ error: 'Failed to recalculate risk scores', details: error.message }, { status: 500 });
    }
  }

  // Bulk update
  let validatedData;
  try {
    const body = await request.json();
    validatedData = BulkRiskUpdateSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { merchantIds, automationLevel, adjustmentFactor, reason } = validatedData;

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const results = [];

    for (const merchantId of merchantIds) {
      try {
        let updateQuery = '';
        let updateParams: any[] = [merchantId];

        if (automationLevel && adjustmentFactor) {
          updateQuery = `
            UPDATE merchant_risk_scores SET
              automation_level = $2,
              daily_limit = daily_limit * $3,
              weekly_limit = weekly_limit * $3,
              monthly_limit = monthly_limit * $3,
              single_transaction_limit = single_transaction_limit * $3,
              requires_approval_above = requires_approval_above * $3,
              last_updated = NOW()
            WHERE merchant_id = $1
            RETURNING merchant_id, automation_level, daily_limit
          `;
          updateParams.push(automationLevel, adjustmentFactor);
        } else if (automationLevel) {
          updateQuery = `
            UPDATE merchant_risk_scores SET
              automation_level = $2,
              last_updated = NOW()
            WHERE merchant_id = $1
            RETURNING merchant_id, automation_level, daily_limit
          `;
          updateParams.push(automationLevel);
        } else if (adjustmentFactor) {
          updateQuery = `
            UPDATE merchant_risk_scores SET
              daily_limit = daily_limit * $2,
              weekly_limit = weekly_limit * $2,
              monthly_limit = monthly_limit * $2,
              single_transaction_limit = single_transaction_limit * $2,
              requires_approval_above = requires_approval_above * $2,
              last_updated = NOW()
            WHERE merchant_id = $1
            RETURNING merchant_id, automation_level, daily_limit
          `;
          updateParams.push(adjustmentFactor);
        }

        if (updateQuery) {
          const updateResult = await client.query(updateQuery, updateParams);
          if (updateResult.rows.length > 0) {
            results.push({
              merchantId,
              success: true,
              updatedValues: updateResult.rows[0]
            });
          } else {
            results.push({
              merchantId,
              success: false,
              error: 'Merchant risk score not found'
            });
          }
        }

      } catch (error) {
        results.push({
          merchantId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log bulk update in audit trail
    await client.query(`
      INSERT INTO automation_audit_log (
        event_type, performed_by, details, created_at
      ) VALUES ($1, 'ADMIN', $2, NOW())
    `, [
      'BULK_RISK_UPDATE',
      JSON.stringify({
        merchantIds,
        automationLevel,
        adjustmentFactor,
        reason,
        results: results.length,
        successful: results.filter(r => r.success).length
      })
    ]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Bulk update completed for ${merchantIds.length} merchants`,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
    console.error("Error performing bulk risk update:", error);
    return NextResponse.json({ error: 'Failed to perform bulk update', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
