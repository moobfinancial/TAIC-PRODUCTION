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
 * GET /api/admin/security/compliance
 * Get compliance rules, violations, and reports
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
    const type = url.searchParams.get('type') || 'overview';
    const ruleType = url.searchParams.get('ruleType');
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let client;
    try {
      client = await pool.connect();

      if (type === 'rules') {
        // Get compliance rules
        let rulesQuery = `
          SELECT 
            id,
            rule_type,
            name,
            description,
            severity,
            enabled,
            conditions,
            actions,
            created_at,
            updated_at
          FROM compliance_rules
          WHERE 1=1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (ruleType) {
          rulesQuery += ` AND rule_type = $${paramIndex}`;
          queryParams.push(ruleType);
          paramIndex++;
        }

        rulesQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);

        const rulesResult = await client.query(rulesQuery, queryParams);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM compliance_rules WHERE 1=1`;
        const countParams: any[] = [];
        let countParamIndex = 1;

        if (ruleType) {
          countQuery += ` AND rule_type = $${countParamIndex}`;
          countParams.push(ruleType);
        }

        const countResult = await client.query(countQuery, countParams);

        return NextResponse.json({
          success: true,
          data: {
            rules: rulesResult.rows,
            pagination: {
              total: parseInt(countResult.rows[0].total),
              limit,
              offset,
              hasMore: offset + limit < parseInt(countResult.rows[0].total)
            }
          }
        });

      } else if (type === 'violations') {
        // Get compliance violations
        let violationsQuery = `
          SELECT 
            cv.id,
            cv.rule_id,
            cv.rule_name,
            cv.violation_type,
            cv.severity,
            cv.entity_type,
            cv.entity_id,
            cv.details,
            cv.status,
            cv.assigned_to,
            cv.resolution,
            cv.created_at,
            cv.resolved_at,
            cr.description as rule_description
          FROM compliance_violations cv
          LEFT JOIN compliance_rules cr ON cv.rule_id = cr.id
          WHERE 1=1
        `;

        const queryParams: any[] = [];
        let paramIndex = 1;

        if (status) {
          violationsQuery += ` AND cv.status = $${paramIndex}`;
          queryParams.push(status);
          paramIndex++;
        }

        if (severity) {
          violationsQuery += ` AND cv.severity = $${paramIndex}`;
          queryParams.push(severity);
          paramIndex++;
        }

        if (ruleType) {
          violationsQuery += ` AND cv.violation_type = $${paramIndex}`;
          queryParams.push(ruleType);
          paramIndex++;
        }

        violationsQuery += ` ORDER BY cv.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);

        const violationsResult = await client.query(violationsQuery, queryParams);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM compliance_violations WHERE 1=1`;
        const countParams: any[] = [];
        let countParamIndex = 1;

        if (status) {
          countQuery += ` AND status = $${countParamIndex}`;
          countParams.push(status);
          countParamIndex++;
        }

        if (severity) {
          countQuery += ` AND severity = $${countParamIndex}`;
          countParams.push(severity);
          countParamIndex++;
        }

        if (ruleType) {
          countQuery += ` AND violation_type = $${countParamIndex}`;
          countParams.push(ruleType);
        }

        const countResult = await client.query(countQuery, countParams);

        return NextResponse.json({
          success: true,
          data: {
            violations: violationsResult.rows,
            pagination: {
              total: parseInt(countResult.rows[0].total),
              limit,
              offset,
              hasMore: offset + limit < parseInt(countResult.rows[0].total)
            }
          }
        });

      } else if (type === 'reports') {
        // Get compliance reports
        const reportsQuery = `
          SELECT 
            id,
            report_type,
            report_period_start,
            report_period_end,
            status,
            generated_by,
            reviewed_by,
            approved_by,
            submitted_to,
            submission_deadline,
            created_at,
            updated_at,
            submitted_at
          FROM compliance_reports
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2
        `;

        const reportsResult = await client.query(reportsQuery, [limit, offset]);

        const countResult = await client.query('SELECT COUNT(*) as total FROM compliance_reports');

        return NextResponse.json({
          success: true,
          data: {
            reports: reportsResult.rows,
            pagination: {
              total: parseInt(countResult.rows[0].total),
              limit,
              offset,
              hasMore: offset + limit < parseInt(countResult.rows[0].total)
            }
          }
        });

      } else {
        // Get compliance overview
        const overviewQuery = `
          SELECT 
            (SELECT COUNT(*) FROM compliance_rules WHERE enabled = true) as active_rules,
            (SELECT COUNT(*) FROM compliance_violations WHERE status = 'OPEN') as open_violations,
            (SELECT COUNT(*) FROM compliance_violations WHERE status = 'INVESTIGATING') as investigating_violations,
            (SELECT COUNT(*) FROM compliance_violations WHERE created_at > NOW() - INTERVAL '24 hours') as violations_24h,
            (SELECT COUNT(*) FROM compliance_reports WHERE status = 'DRAFT') as draft_reports,
            (SELECT COUNT(*) FROM compliance_reports WHERE status = 'REVIEW') as pending_reports,
            (SELECT row_to_json(compliance_dashboard_summary) FROM compliance_dashboard_summary) as dashboard_summary
        `;

        const violationsByTypeQuery = `
          SELECT 
            violation_type,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_count
          FROM compliance_violations
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY violation_type
          ORDER BY count DESC
        `;

        const rulesByTypeQuery = `
          SELECT 
            rule_type,
            COUNT(*) as total_rules,
            COUNT(CASE WHEN enabled = true THEN 1 END) as active_rules
          FROM compliance_rules
          GROUP BY rule_type
          ORDER BY total_rules DESC
        `;

        const [overviewResult, violationsByTypeResult, rulesByTypeResult] = await Promise.all([
          client.query(overviewQuery),
          client.query(violationsByTypeQuery),
          client.query(rulesByTypeQuery)
        ]);

        const overview = overviewResult.rows[0];

        return NextResponse.json({
          success: true,
          data: {
            overview: {
              activeRules: parseInt(overview.active_rules),
              openViolations: parseInt(overview.open_violations),
              investigatingViolations: parseInt(overview.investigating_violations),
              violations24h: parseInt(overview.violations_24h),
              draftReports: parseInt(overview.draft_reports),
              pendingReports: parseInt(overview.pending_reports),
              dashboardSummary: overview.dashboard_summary
            },
            violationsByType: violationsByTypeResult.rows,
            rulesByType: rulesByTypeResult.rows,
            lastUpdated: new Date()
          }
        });
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error fetching compliance data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch compliance data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/security/compliance
 * Create compliance rules, reports, or evaluate compliance
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
    const { action, ruleData, reportData, evaluationData } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();

      if (action === 'create_rule') {
        if (!ruleData) {
          return NextResponse.json(
            { error: 'Missing ruleData for rule creation' },
            { status: 400 }
          );
        }

        const ruleId = `RULE_${ruleData.ruleType}_${Date.now()}`;
        
        const insertQuery = `
          INSERT INTO compliance_rules (
            id, rule_type, name, description, severity, enabled, conditions, actions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, created_at
        `;

        const result = await client.query(insertQuery, [
          ruleId,
          ruleData.ruleType,
          ruleData.name,
          ruleData.description,
          ruleData.severity,
          ruleData.enabled !== false,
          JSON.stringify(ruleData.conditions || []),
          JSON.stringify(ruleData.actions || [])
        ]);

        // Add rule to security engine
        securityEngine.addComplianceRule({
          id: ruleId,
          ruleType: ruleData.ruleType,
          name: ruleData.name,
          description: ruleData.description,
          severity: ruleData.severity,
          enabled: ruleData.enabled !== false,
          conditions: ruleData.conditions || [],
          actions: ruleData.actions || [],
          lastUpdated: new Date()
        });

        return NextResponse.json({
          success: true,
          message: 'Compliance rule created successfully',
          data: {
            ruleId: result.rows[0].id,
            createdAt: result.rows[0].created_at
          }
        });

      } else if (action === 'create_report') {
        if (!reportData) {
          return NextResponse.json(
            { error: 'Missing reportData for report creation' },
            { status: 400 }
          );
        }

        const reportId = `RPT_${reportData.reportType}_${Date.now()}`;
        
        // Generate report data
        const generatedData = await client.query(
          'SELECT generate_compliance_report_data($1, $2, $3) as report_data',
          [reportData.reportType, reportData.periodStart, reportData.periodEnd]
        );

        const insertQuery = `
          INSERT INTO compliance_reports (
            id, report_type, report_period_start, report_period_end,
            report_data, generated_by, submission_deadline
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, created_at
        `;

        const result = await client.query(insertQuery, [
          reportId,
          reportData.reportType,
          reportData.periodStart,
          reportData.periodEnd,
          generatedData.rows[0].report_data,
          reportData.generatedBy || 'system',
          reportData.submissionDeadline
        ]);

        return NextResponse.json({
          success: true,
          message: 'Compliance report created successfully',
          data: {
            reportId: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            reportData: generatedData.rows[0].report_data
          }
        });

      } else if (action === 'evaluate_compliance') {
        if (!evaluationData) {
          return NextResponse.json(
            { error: 'Missing evaluationData for compliance evaluation' },
            { status: 400 }
          );
        }

        // Evaluate compliance using security engine
        const violations = await securityEngine.evaluateCompliance(
          evaluationData.entityType,
          evaluationData.entityId,
          evaluationData.data
        );

        return NextResponse.json({
          success: true,
          message: 'Compliance evaluation completed',
          data: {
            violations,
            violationCount: violations.length,
            evaluatedAt: new Date()
          }
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: create_rule, create_report, evaluate_compliance' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error processing compliance action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process compliance action',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/security/compliance
 * Update compliance rules, violations, or reports
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
    const { action, id, updates } = body;

    if (!action || !id) {
      return NextResponse.json(
        { error: 'Missing required fields: action and id' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();

      if (action === 'update_rule') {
        const updateQuery = `
          UPDATE compliance_rules 
          SET name = $1, description = $2, severity = $3, enabled = $4,
              conditions = $5, actions = $6, updated_at = NOW()
          WHERE id = $7
          RETURNING id, updated_at
        `;

        const result = await client.query(updateQuery, [
          updates.name,
          updates.description,
          updates.severity,
          updates.enabled,
          JSON.stringify(updates.conditions || []),
          JSON.stringify(updates.actions || []),
          id
        ]);

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Compliance rule not found' },
            { status: 404 }
          );
        }

        // Update rule in security engine
        securityEngine.updateComplianceRule(id, {
          name: updates.name,
          description: updates.description,
          severity: updates.severity,
          enabled: updates.enabled,
          conditions: updates.conditions || [],
          actions: updates.actions || []
        });

        return NextResponse.json({
          success: true,
          message: 'Compliance rule updated successfully',
          data: result.rows[0]
        });

      } else if (action === 'update_report') {
        const updateQuery = `
          UPDATE compliance_reports 
          SET status = $1, reviewed_by = $2, approved_by = $3,
              submitted_to = $4, updated_at = NOW(),
              submitted_at = CASE WHEN $1 = 'SUBMITTED' THEN NOW() ELSE submitted_at END
          WHERE id = $5
          RETURNING id, status, updated_at
        `;

        const result = await client.query(updateQuery, [
          updates.status,
          updates.reviewedBy,
          updates.approvedBy,
          updates.submittedTo,
          id
        ]);

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Compliance report not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Compliance report updated successfully',
          data: result.rows[0]
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: update_rule, update_report' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error updating compliance data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update compliance data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
