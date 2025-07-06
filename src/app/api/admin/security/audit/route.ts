import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { SecurityComplianceEngine } from '@/lib/security/securityComplianceEngine';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

const securityEngine = new SecurityComplianceEngine();

async function validateAdminApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const expectedKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY;
  
  if (!apiKey || !expectedKey) {
    return false;
  }
  
  return apiKey === expectedKey;
}

/**
 * GET /api/admin/security/audit
 * Get comprehensive audit trail data
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
    const entityType = url.searchParams.get('entityType');
    const entityId = url.searchParams.get('entityId');
    const action = url.searchParams.get('action');
    const performedBy = url.searchParams.get('performedBy');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeDataChanges = url.searchParams.get('includeDataChanges') === 'true';

    let client;
    try {
      client = await pool.connect();

      // Build audit trail query
      let auditQuery = `
        SELECT 
          id,
          entity_type,
          entity_id,
          action,
          performed_by,
          ip_address,
          user_agent,
          details,
          ${includeDataChanges ? 'data_changes,' : ''}
          created_at
        FROM comprehensive_audit_trail
        WHERE 1=1
      `;

      const queryParams: any[] = [];
      let paramIndex = 1;

      if (entityType) {
        auditQuery += ` AND entity_type = $${paramIndex}`;
        queryParams.push(entityType);
        paramIndex++;
      }

      if (entityId) {
        auditQuery += ` AND entity_id = $${paramIndex}`;
        queryParams.push(entityId);
        paramIndex++;
      }

      if (action) {
        auditQuery += ` AND action ILIKE $${paramIndex}`;
        queryParams.push(`%${action}%`);
        paramIndex++;
      }

      if (performedBy) {
        auditQuery += ` AND performed_by = $${paramIndex}`;
        queryParams.push(performedBy);
        paramIndex++;
      }

      if (startDate) {
        auditQuery += ` AND created_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        auditQuery += ` AND created_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      auditQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      // Get audit trail entries
      const auditResult = await client.query(auditQuery, queryParams);

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) as total FROM comprehensive_audit_trail WHERE 1=1`;
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (entityType) {
        countQuery += ` AND entity_type = $${countParamIndex}`;
        countParams.push(entityType);
        countParamIndex++;
      }

      if (entityId) {
        countQuery += ` AND entity_id = $${countParamIndex}`;
        countParams.push(entityId);
        countParamIndex++;
      }

      if (action) {
        countQuery += ` AND action ILIKE $${countParamIndex}`;
        countParams.push(`%${action}%`);
        countParamIndex++;
      }

      if (performedBy) {
        countQuery += ` AND performed_by = $${countParamIndex}`;
        countParams.push(performedBy);
        countParamIndex++;
      }

      if (startDate) {
        countQuery += ` AND created_at >= $${countParamIndex}`;
        countParams.push(startDate);
        countParamIndex++;
      }

      if (endDate) {
        countQuery += ` AND created_at <= $${countParamIndex}`;
        countParams.push(endDate);
      }

      const countResult = await client.query(countQuery, countParams);

      // Get audit statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT entity_type) as entity_types,
          COUNT(DISTINCT performed_by) as unique_users,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as entries_24h,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as entries_7d,
          COUNT(CASE WHEN data_changes IS NOT NULL THEN 1 END) as entries_with_changes
        FROM comprehensive_audit_trail
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;

      const activityQuery = `
        SELECT 
          entity_type,
          COUNT(*) as count
        FROM comprehensive_audit_trail
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY entity_type
        ORDER BY count DESC
      `;

      const topUsersQuery = `
        SELECT 
          performed_by,
          COUNT(*) as action_count,
          COUNT(DISTINCT action) as unique_actions
        FROM comprehensive_audit_trail
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY performed_by
        ORDER BY action_count DESC
        LIMIT 10
      `;

      const [statsResult, activityResult, topUsersResult] = await Promise.all([
        client.query(statsQuery),
        client.query(activityQuery),
        client.query(topUsersQuery)
      ]);

      const stats = statsResult.rows[0];

      return NextResponse.json({
        success: true,
        data: {
          auditEntries: auditResult.rows,
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit,
            offset,
            hasMore: offset + limit < parseInt(countResult.rows[0].total)
          },
          statistics: {
            totalEntries: parseInt(stats.total_entries),
            entityTypes: parseInt(stats.entity_types),
            uniqueUsers: parseInt(stats.unique_users),
            entries24h: parseInt(stats.entries_24h),
            entries7d: parseInt(stats.entries_7d),
            entriesWithChanges: parseInt(stats.entries_with_changes)
          },
          activityByType: activityResult.rows,
          topUsers: topUsersResult.rows,
          lastUpdated: new Date()
        }
      });

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error fetching audit trail data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch audit trail data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/security/audit
 * Create audit trail entry
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
    const { entityType, entityId, action, performedBy, details, dataChanges } = body;

    if (!entityType || !entityId || !action || !performedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: entityType, entityId, action, performedBy' },
        { status: 400 }
      );
    }

    // Get client IP address
    const getClientIP = (req: NextRequest): string => {
      const forwarded = req.headers.get('x-forwarded-for');
      const realIP = req.headers.get('x-real-ip');

      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      if (realIP) {
        return realIP;
      }
      return '127.0.0.1';
    };

    // Create audit trail entry
    const auditEntry = await securityEngine.createAuditTrail({
      entityType,
      entityId,
      action,
      performedBy,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'Unknown',
      details: details || {},
      dataChanges: dataChanges || null
    });

    return NextResponse.json({
      success: true,
      message: 'Audit trail entry created successfully',
      data: {
        auditId: auditEntry.id,
        createdAt: auditEntry.timestamp
      }
    });

  } catch (error: any) {
    console.error('Error creating audit trail entry:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create audit trail entry',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/security/audit
 * Export audit trail data or perform audit operations
 */
export async function PUT(request: NextRequest) {
  try {
    // Validate admin API key
    if (!await validateAdminApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing admin API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, filters, format } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();

      if (action === 'export_audit_trail') {
        // Build export query based on filters
        let exportQuery = `
          SELECT 
            id,
            entity_type,
            entity_id,
            action,
            performed_by,
            ip_address,
            user_agent,
            details,
            data_changes,
            created_at
          FROM comprehensive_audit_trail
          WHERE 1=1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (filters?.entityType) {
          exportQuery += ` AND entity_type = $${paramIndex}`;
          queryParams.push(filters.entityType);
          paramIndex++;
        }

        if (filters?.startDate) {
          exportQuery += ` AND created_at >= $${paramIndex}`;
          queryParams.push(filters.startDate);
          paramIndex++;
        }

        if (filters?.endDate) {
          exportQuery += ` AND created_at <= $${paramIndex}`;
          queryParams.push(filters.endDate);
          paramIndex++;
        }

        exportQuery += ` ORDER BY created_at DESC`;

        if (filters?.limit) {
          exportQuery += ` LIMIT $${paramIndex}`;
          queryParams.push(filters.limit);
        }

        const exportResult = await client.query(exportQuery, queryParams);

        // Format data based on requested format
        let exportData;
        if (format === 'csv') {
          // Convert to CSV format
          const headers = ['ID', 'Entity Type', 'Entity ID', 'Action', 'Performed By', 'IP Address', 'Created At'];
          const csvRows = [headers.join(',')];
          
          exportResult.rows.forEach(row => {
            const csvRow = [
              row.id,
              row.entity_type,
              row.entity_id,
              row.action,
              row.performed_by,
              row.ip_address,
              row.created_at.toISOString()
            ].map(field => `"${field}"`).join(',');
            csvRows.push(csvRow);
          });
          
          exportData = csvRows.join('\n');
        } else {
          // Default JSON format
          exportData = exportResult.rows;
        }

        return NextResponse.json({
          success: true,
          message: 'Audit trail exported successfully',
          data: {
            format,
            recordCount: exportResult.rows.length,
            exportData,
            exportedAt: new Date()
          }
        });

      } else if (action === 'generate_audit_report') {
        const { reportPeriodStart, reportPeriodEnd, reportType } = body;

        if (!reportPeriodStart || !reportPeriodEnd) {
          return NextResponse.json(
            { error: 'Missing required fields: reportPeriodStart, reportPeriodEnd' },
            { status: 400 }
          );
        }

        // Generate comprehensive audit report
        const reportQuery = `
          SELECT 
            entity_type,
            COUNT(*) as total_actions,
            COUNT(DISTINCT performed_by) as unique_users,
            COUNT(DISTINCT entity_id) as unique_entities,
            COUNT(CASE WHEN data_changes IS NOT NULL THEN 1 END) as data_modifications,
            array_agg(DISTINCT action) as actions_performed
          FROM comprehensive_audit_trail
          WHERE created_at BETWEEN $1 AND $2
          GROUP BY entity_type
          ORDER BY total_actions DESC
        `;

        const timelineQuery = `
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as daily_actions,
            COUNT(DISTINCT performed_by) as daily_users
          FROM comprehensive_audit_trail
          WHERE created_at BETWEEN $1 AND $2
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date
        `;

        const [reportResult, timelineResult] = await Promise.all([
          client.query(reportQuery, [reportPeriodStart, reportPeriodEnd]),
          client.query(timelineQuery, [reportPeriodStart, reportPeriodEnd])
        ]);

        const auditReport = {
          reportType: reportType || 'COMPREHENSIVE_AUDIT',
          period: {
            start: reportPeriodStart,
            end: reportPeriodEnd
          },
          summary: {
            totalActions: reportResult.rows.reduce((sum, row) => sum + parseInt(row.total_actions), 0),
            uniqueUsers: new Set(reportResult.rows.flatMap(row => row.unique_users)).size,
            entityTypes: reportResult.rows.length,
            dataModifications: reportResult.rows.reduce((sum, row) => sum + parseInt(row.data_modifications), 0)
          },
          activityByEntityType: reportResult.rows,
          dailyTimeline: timelineResult.rows,
          generatedAt: new Date()
        };

        return NextResponse.json({
          success: true,
          message: 'Audit report generated successfully',
          data: {
            report: auditReport
          }
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: export_audit_trail, generate_audit_report' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error processing audit operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process audit operation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
