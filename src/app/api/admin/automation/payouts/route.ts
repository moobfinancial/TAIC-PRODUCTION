import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AutomatedPayoutEngine } from '@/lib/automation/automatedPayoutEngine';
import { TreasuryWalletSystem } from '@/lib/treasury/treasuryWalletSystem';
import { CryptoWalletService } from '@/lib/crypto/walletService';
import { NetworkType } from '@/lib/crypto/walletUtils';

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

const CreateAutomatedPayoutSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('TAIC'),
  destinationWallet: z.string().min(1, 'Destination wallet is required'),
  destinationNetwork: z.enum(['FANTOM', 'ETHEREUM', 'POLYGON', 'BSC', 'BITCOIN']),
  scheduleType: z.enum(['SCHEDULED', 'THRESHOLD_TRIGGERED', 'REAL_TIME', 'MANUAL_OVERRIDE']),
  scheduledFor: z.string().datetime().optional(),
  originalPayoutRequestId: z.number().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  metadata: z.any().optional()
});

const UpdateRiskScoreSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID'),
  overallScore: z.number().min(0).max(100).optional(),
  automationLevel: z.enum(['FULL', 'PARTIAL', 'MANUAL_REVIEW']).optional(),
  dailyLimit: z.number().positive().optional(),
  weeklyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  singleTransactionLimit: z.number().positive().optional(),
  requiresApprovalAbove: z.number().positive().optional()
});

const EmergencyControlSchema = z.object({
  action: z.enum(['HALT', 'RESUME']),
  reason: z.string().min(1, 'Reason is required'),
  authorizedBy: z.string().min(1, 'Authorization required')
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
  dailyLimits: {
    LOW: '10000',
    MEDIUM: '100000',
    HIGH: '1000000',
    CRITICAL: '10000000'
  },
  monthlyLimits: {
    LOW: '100000',
    MEDIUM: '1000000',
    HIGH: '10000000',
    CRITICAL: '100000000'
  },
  riskThresholds: {
    low: 25,
    medium: 50,
    high: 75,
    critical: 90
  },
  complianceRequired: true,
  auditingEnabled: true,
  geofencingEnabled: false,
  allowedRegions: ['US', 'EU', 'CA'],
  timeBasedRestrictions: {
    enabled: false,
    allowedHours: { start: 9, end: 17 },
    timezone: 'UTC'
  }
});

const cryptoWalletService = new CryptoWalletService();
const automationEngine = new AutomatedPayoutEngine(treasurySystem, cryptoWalletService);

// GET - Fetch automated payout requests and system status
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const merchantId = searchParams.get('merchantId');
  const automationDecision = searchParams.get('automationDecision');
  const priority = searchParams.get('priority');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const includeMetrics = searchParams.get('includeMetrics') === 'true';

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Build query with filters
    let whereConditions = ['1=1'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`apr.status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (merchantId) {
      whereConditions.push(`apr.merchant_id = $${paramIndex++}`);
      queryParams.push(merchantId);
    }

    if (automationDecision) {
      whereConditions.push(`apr.automation_decision = $${paramIndex++}`);
      queryParams.push(automationDecision);
    }

    if (priority) {
      whereConditions.push(`apr.priority = $${paramIndex++}`);
      queryParams.push(priority);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get automated payout requests
    const requestsQuery = `
      SELECT 
        apr.*,
        u.email as merchant_email,
        mrs.automation_level,
        mrs.overall_score as merchant_risk_score,
        psc.schedule_type as config_schedule_type,
        psc.frequency_type
      FROM automated_payout_requests apr
      LEFT JOIN users u ON apr.merchant_id = u.id
      LEFT JOIN merchant_risk_scores mrs ON apr.merchant_id = mrs.merchant_id
      LEFT JOIN payout_schedule_configs psc ON apr.merchant_id = psc.merchant_id
      WHERE ${whereClause}
      ORDER BY apr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    queryParams.push(limit, offset);

    const requestsResult = await client.query(requestsQuery, queryParams);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as processing_requests,
        COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as executed_requests,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_requests,
        COUNT(CASE WHEN automation_decision = 'MANUAL_REVIEW' AND status = 'PENDING' THEN 1 END) as manual_review_queue,
        COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' THEN 1 END) as auto_approved,
        COUNT(CASE WHEN automation_decision = 'AUTO_REJECT' THEN 1 END) as auto_rejected,
        AVG(CASE WHEN status = 'EXECUTED' THEN EXTRACT(EPOCH FROM (executed_at - created_at)) END) as avg_processing_time,
        SUM(CASE WHEN status = 'EXECUTED' AND created_at > CURRENT_DATE THEN amount ELSE 0 END) as daily_volume
      FROM automated_payout_requests
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;

    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];

    // Get queue status
    const queueStatus = automationEngine.getQueueStatus();

    // Get automation metrics if requested
    let metrics = null;
    if (includeMetrics) {
      metrics = await automationEngine.getAutomationMetrics('DAILY');
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM automated_payout_requests apr
      WHERE ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      requests: requestsResult.rows.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        merchantEmail: row.merchant_email,
        originalPayoutRequestId: row.original_payout_request_id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        destinationWallet: row.destination_wallet,
        destinationNetwork: row.destination_network,
        scheduleType: row.schedule_type,
        scheduledFor: row.scheduled_for,
        priority: row.priority,
        status: row.status,
        riskScore: row.risk_score,
        automationDecision: row.automation_decision,
        processingAttempts: row.processing_attempts,
        maxAttempts: row.max_attempts,
        lastAttemptAt: row.last_attempt_at,
        executedAt: row.executed_at,
        transactionHash: row.transaction_hash,
        failureReason: row.failure_reason,
        treasuryTransactionId: row.treasury_transaction_id,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        merchantRiskScore: row.merchant_risk_score,
        automationLevel: row.automation_level,
        configScheduleType: row.config_schedule_type,
        frequencyType: row.frequency_type
      })),
      summary: {
        totalRequests: parseInt(summary.total_requests),
        pendingRequests: parseInt(summary.pending_requests),
        processingRequests: parseInt(summary.processing_requests),
        executedRequests: parseInt(summary.executed_requests),
        failedRequests: parseInt(summary.failed_requests),
        manualReviewQueue: parseInt(summary.manual_review_queue),
        autoApproved: parseInt(summary.auto_approved),
        autoRejected: parseInt(summary.auto_rejected),
        averageProcessingTime: parseFloat(summary.avg_processing_time) || 0,
        dailyVolume: parseFloat(summary.daily_volume) || 0
      },
      queueStatus,
      metrics,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      filters: {
        status: status || null,
        merchantId: merchantId || null,
        automationDecision: automationDecision || null,
        priority: priority || null
      }
    });

  } catch (error: any) {
    console.error("Error fetching automated payout requests:", error);
    return NextResponse.json({ error: "Failed to fetch automated payout requests", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Create new automated payout request
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = CreateAutomatedPayoutSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const {
    merchantId,
    amount,
    currency,
    destinationWallet,
    destinationNetwork,
    scheduleType,
    scheduledFor,
    originalPayoutRequestId,
    priority,
    metadata
  } = validatedData;

  try {
    // Parse scheduled date if provided
    const scheduledDate = scheduledFor ? new Date(scheduledFor) : new Date();

    // Create automated payout request
    const automatedRequest = await automationEngine.createAutomatedPayoutRequest(
      merchantId,
      amount,
      currency,
      destinationWallet,
      destinationNetwork as NetworkType,
      scheduleType,
      scheduledDate,
      originalPayoutRequestId,
      metadata
    );

    return NextResponse.json({
      success: true,
      message: 'Automated payout request created successfully',
      request: {
        id: automatedRequest.id,
        merchantId: automatedRequest.merchantId,
        amount: automatedRequest.amount,
        currency: automatedRequest.currency,
        destinationWallet: automatedRequest.destinationWallet,
        destinationNetwork: automatedRequest.destinationNetwork,
        scheduleType: automatedRequest.scheduleType,
        scheduledFor: automatedRequest.scheduledFor.toISOString(),
        priority: automatedRequest.priority,
        status: automatedRequest.status,
        riskScore: automatedRequest.riskScore,
        automationDecision: automatedRequest.automationDecision,
        createdAt: automatedRequest.createdAt.toISOString()
      }
    });

  } catch (error: any) {
    console.error("Error creating automated payout request:", error);
    return NextResponse.json({ error: 'Failed to create automated payout request', details: error.message }, { status: 500 });
  }
}
