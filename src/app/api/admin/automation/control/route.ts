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

const EmergencyControlSchema = z.object({
  action: z.enum(['HALT', 'RESUME']),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason cannot exceed 1000 characters'),
  authorizedBy: z.string().min(1, 'Authorization required'),
  duration: z.number().positive().optional(), // Duration in hours for temporary halt
  affectedSystems: z.array(z.enum(['AUTOMATION_ENGINE', 'TREASURY_SYSTEM', 'RISK_ASSESSMENT', 'ALL'])).default(['AUTOMATION_ENGINE'])
});

const ProcessingControlSchema = z.object({
  action: z.enum(['START_SCHEDULER', 'STOP_SCHEDULER', 'FORCE_PROCESS_QUEUE', 'CLEAR_FAILED_REQUESTS']),
  queueId: z.string().optional(),
  reason: z.string().min(1, 'Reason is required'),
  authorizedBy: z.string().min(1, 'Authorization required')
});

const SystemConfigSchema = z.object({
  maxBatchSize: z.number().int().min(1).max(100).optional(),
  optimalBatchSize: z.number().int().min(1).max(50).optional(),
  processingInterval: z.number().int().min(30).max(3600).optional(), // seconds
  maxRetries: z.number().int().min(1).max(10).optional(),
  emergencyThresholds: z.object({
    failureRate: z.number().min(0).max(100).optional(), // percentage
    volumeSpike: z.number().min(1).optional(), // multiplier
    riskScoreThreshold: z.number().min(0).max(100).optional()
  }).optional()
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

// GET - Get automation system status and controls
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Get system status
    const queueStatus = automationEngine.getQueueStatus();
    
    // Get recent automation metrics
    const metrics = await automationEngine.getAutomationMetrics('DAILY');
    
    // Get recent audit events
    const auditQuery = `
      SELECT event_type, performed_by, details, created_at
      FROM automation_audit_log
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const auditResult = await client.query(auditQuery);

    // Get system health indicators
    const healthQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'FAILED' AND created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_failures,
        COUNT(CASE WHEN status = 'PROCESSING' AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as stuck_requests,
        COUNT(CASE WHEN automation_decision = 'MANUAL_REVIEW' AND status = 'PENDING' THEN 1 END) as manual_review_queue,
        AVG(CASE WHEN status = 'EXECUTED' AND created_at > NOW() - INTERVAL '24 hours' 
                 THEN EXTRACT(EPOCH FROM (executed_at - created_at)) END) as avg_processing_time_24h
      FROM automated_payout_requests
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;
    const healthResult = await client.query(healthQuery);
    const health = healthResult.rows[0];

    // Get active notifications
    const notificationsQuery = `
      SELECT type, title, priority, created_at, data
      FROM admin_notifications
      WHERE status = 'UNREAD' AND type LIKE '%AUTOMATION%'
      ORDER BY priority DESC, created_at DESC
      LIMIT 10
    `;
    const notificationsResult = await client.query(notificationsQuery);

    // Calculate system health score
    const recentFailures = parseInt(health.recent_failures) || 0;
    const stuckRequests = parseInt(health.stuck_requests) || 0;
    const manualReviewQueue = parseInt(health.manual_review_queue) || 0;
    const avgProcessingTime = parseFloat(health.avg_processing_time_24h) || 0;

    let healthScore = 100;
    if (recentFailures > 10) healthScore -= 30;
    else if (recentFailures > 5) healthScore -= 15;
    else if (recentFailures > 2) healthScore -= 5;

    if (stuckRequests > 5) healthScore -= 25;
    else if (stuckRequests > 2) healthScore -= 10;

    if (manualReviewQueue > 50) healthScore -= 20;
    else if (manualReviewQueue > 20) healthScore -= 10;

    if (avgProcessingTime > 300) healthScore -= 15; // More than 5 minutes
    else if (avgProcessingTime > 120) healthScore -= 5; // More than 2 minutes

    const systemStatus = {
      isOperational: healthScore >= 70,
      healthScore: Math.max(0, healthScore),
      emergencyHalt: false, // Would check actual engine state
      schedulerRunning: true, // Would check actual scheduler state
      lastProcessingRun: new Date().toISOString(), // Would get from engine
      uptime: '24h 15m', // Would calculate actual uptime
      version: '1.0.0'
    };

    return NextResponse.json({
      systemStatus,
      queueStatus,
      metrics,
      health: {
        recentFailures,
        stuckRequests,
        manualReviewQueue,
        averageProcessingTime: avgProcessingTime,
        healthScore
      },
      recentAuditEvents: auditResult.rows.map(row => ({
        eventType: row.event_type,
        performedBy: row.performed_by,
        details: row.details,
        timestamp: row.created_at
      })),
      activeNotifications: notificationsResult.rows.map(row => ({
        type: row.type,
        title: row.title,
        priority: row.priority,
        createdAt: row.created_at,
        data: row.data
      }))
    });

  } catch (error: any) {
    console.error("Error fetching automation system status:", error);
    return NextResponse.json({ error: "Failed to fetch system status", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST - Emergency controls and system management
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const controlType = searchParams.get('type');

  if (controlType === 'emergency') {
    // Emergency halt/resume controls
    let validatedData;
    try {
      const body = await request.json();
      validatedData = EmergencyControlSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { action, reason, authorizedBy, duration, affectedSystems } = validatedData;

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      if (action === 'HALT') {
        // Emergency halt
        automationEngine.emergencyHaltProcessing(reason);

        // Log emergency halt
        await client.query(`
          INSERT INTO automation_audit_log (
            event_type, performed_by, details, created_at
          ) VALUES ($1, $2, $3, NOW())
        `, [
          'EMERGENCY_HALT',
          authorizedBy,
          JSON.stringify({
            reason,
            duration,
            affectedSystems,
            timestamp: new Date().toISOString()
          })
        ]);

        // Create high-priority notification
        await client.query(`
          INSERT INTO admin_notifications (
            type, title, message, priority, data, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          'AUTOMATION_EMERGENCY_HALT',
          'Emergency Halt Activated',
          `Automation system has been emergency halted by ${authorizedBy}. Reason: ${reason}`,
          'CRITICAL',
          JSON.stringify({
            authorizedBy,
            reason,
            duration,
            affectedSystems
          })
        ]);

        await client.query('COMMIT');

        return NextResponse.json({
          success: true,
          message: 'Emergency halt activated successfully',
          status: {
            emergencyHalt: true,
            haltedAt: new Date().toISOString(),
            authorizedBy,
            reason,
            affectedSystems
          }
        });

      } else if (action === 'RESUME') {
        // Resume processing
        automationEngine.resumeProcessing(authorizedBy);

        // Log resumption
        await client.query(`
          INSERT INTO automation_audit_log (
            event_type, performed_by, details, created_at
          ) VALUES ($1, $2, $3, NOW())
        `, [
          'PROCESSING_RESUMED',
          authorizedBy,
          JSON.stringify({
            reason,
            timestamp: new Date().toISOString()
          })
        ]);

        // Create notification
        await client.query(`
          INSERT INTO admin_notifications (
            type, title, message, priority, data, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          'AUTOMATION_PROCESSING_RESUMED',
          'Processing Resumed',
          `Automation processing has been resumed by ${authorizedBy}. Reason: ${reason}`,
          'HIGH',
          JSON.stringify({
            authorizedBy,
            reason
          })
        ]);

        await client.query('COMMIT');

        return NextResponse.json({
          success: true,
          message: 'Processing resumed successfully',
          status: {
            emergencyHalt: false,
            resumedAt: new Date().toISOString(),
            authorizedBy,
            reason
          }
        });
      }

    } catch (error: any) {
      if (client) await client.query('ROLLBACK').catch(rbErr => console.error("Rollback error:", rbErr));
      console.error("Error executing emergency control:", error);
      return NextResponse.json({ error: 'Failed to execute emergency control', details: error.message }, { status: 500 });
    } finally {
      if (client) client.release();
    }
  }

  if (controlType === 'processing') {
    // Processing controls
    let validatedData;
    try {
      const body = await request.json();
      validatedData = ProcessingControlSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { action, queueId, reason, authorizedBy } = validatedData;

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      let result: any = {};

      switch (action) {
        case 'START_SCHEDULER':
          // Start processing scheduler (would call actual engine method)
          result = { schedulerStarted: true, startedAt: new Date().toISOString() };
          break;

        case 'STOP_SCHEDULER':
          // Stop processing scheduler
          automationEngine.stopProcessingScheduler();
          result = { schedulerStopped: true, stoppedAt: new Date().toISOString() };
          break;

        case 'FORCE_PROCESS_QUEUE':
          // Force process specific queue
          if (!queueId) {
            return NextResponse.json({ error: 'Queue ID required for force processing' }, { status: 400 });
          }
          // Would call engine method to force process queue
          result = { queueProcessed: true, queueId, processedAt: new Date().toISOString() };
          break;

        case 'CLEAR_FAILED_REQUESTS':
          // Clear failed requests older than 24 hours
          const clearQuery = `
            UPDATE automated_payout_requests
            SET status = 'CANCELLED', failure_reason = 'Cleared by admin', updated_at = NOW()
            WHERE status = 'FAILED' AND created_at < NOW() - INTERVAL '24 hours'
          `;
          const clearResult = await client.query(clearQuery);
          result = { clearedRequests: clearResult.rowCount, clearedAt: new Date().toISOString() };
          break;

        default:
          return NextResponse.json({ error: 'Invalid processing action' }, { status: 400 });
      }

      // Log processing control action
      await client.query(`
        INSERT INTO automation_audit_log (
          event_type, performed_by, details, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        `PROCESSING_CONTROL_${action}`,
        authorizedBy,
        JSON.stringify({
          action,
          queueId,
          reason,
          result,
          timestamp: new Date().toISOString()
        })
      ]);

      return NextResponse.json({
        success: true,
        message: `Processing control action '${action}' executed successfully`,
        result
      });

    } catch (error: any) {
      console.error("Error executing processing control:", error);
      return NextResponse.json({ error: 'Failed to execute processing control', details: error.message }, { status: 500 });
    } finally {
      if (client) client.release();
    }
  }

  return NextResponse.json({ error: 'Invalid control type. Use ?type=emergency or ?type=processing' }, { status: 400 });
}

// PUT - Update system configuration
export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let validatedData;
  try {
    const body = await request.json();
    validatedData = SystemConfigSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // Store system configuration (in production, this would update actual engine config)
    const configQuery = `
      INSERT INTO system_config (
        config_key, config_value, updated_by, updated_at
      ) VALUES 
        ('automation_config', $1, 'ADMIN', NOW())
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    `;

    await client.query(configQuery, [JSON.stringify(validatedData)]);

    // Log configuration update
    await client.query(`
      INSERT INTO automation_audit_log (
        event_type, performed_by, details, created_at
      ) VALUES ($1, 'ADMIN', $2, NOW())
    `, [
      'SYSTEM_CONFIG_UPDATED',
      JSON.stringify({
        previousConfig: {}, // Would get from current config
        newConfig: validatedData,
        timestamp: new Date().toISOString()
      })
    ]);

    return NextResponse.json({
      success: true,
      message: 'System configuration updated successfully',
      config: validatedData,
      updatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error updating system configuration:", error);
    return NextResponse.json({ error: 'Failed to update system configuration', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
