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
 * GET /api/admin/security/monitoring
 * Get comprehensive security monitoring dashboard data
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
    const timeframe = url.searchParams.get('timeframe') || '24h';
    const includeDetails = url.searchParams.get('details') === 'true';
    const eventType = url.searchParams.get('eventType');
    const severity = url.searchParams.get('severity');

    let client;
    try {
      client = await pool.connect();

      // Get security metrics
      const securityMetrics = await securityEngine.getSecurityMetrics();

      // Get recent security events
      let eventsQuery = `
        SELECT 
          id,
          event_type,
          severity,
          user_id,
          ip_address,
          details,
          resolved,
          created_at,
          actions
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '${timeframe === '7d' ? '7 days' : timeframe === '30d' ? '30 days' : '24 hours'}'
      `;

      const queryParams: any[] = [];
      let paramIndex = 1;

      if (eventType) {
        eventsQuery += ` AND event_type = $${paramIndex}`;
        queryParams.push(eventType);
        paramIndex++;
      }

      if (severity) {
        eventsQuery += ` AND severity = $${paramIndex}`;
        queryParams.push(severity);
        paramIndex++;
      }

      eventsQuery += ` ORDER BY created_at DESC LIMIT 100`;

      // Get compliance violations
      const violationsQuery = `
        SELECT 
          id,
          rule_name,
          violation_type,
          severity,
          entity_type,
          entity_id,
          status,
          created_at
        FROM compliance_violations
        WHERE created_at > NOW() - INTERVAL '${timeframe === '7d' ? '7 days' : timeframe === '30d' ? '30 days' : '24 hours'}'
        ORDER BY created_at DESC
        LIMIT 50
      `;

      // Get security incidents
      const incidentsQuery = `
        SELECT 
          id,
          incident_type,
          severity,
          status,
          title,
          affected_systems,
          discovered_at,
          resolved_at
        FROM security_incidents
        WHERE discovered_at > NOW() - INTERVAL '30 days'
        ORDER BY discovered_at DESC
        LIMIT 20
      `;

      // Get threat intelligence
      const threatsQuery = `
        SELECT 
          threat_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM threat_intelligence
        WHERE is_active = true
        GROUP BY threat_type
        ORDER BY count DESC
      `;

      // Get dashboard summaries
      const dashboardQuery = `
        SELECT 
          (SELECT row_to_json(security_dashboard_summary) FROM security_dashboard_summary) as security_summary,
          (SELECT row_to_json(compliance_dashboard_summary) FROM compliance_dashboard_summary) as compliance_summary,
          (SELECT calculate_security_score()) as security_score
      `;

      const [eventsResult, violationsResult, incidentsResult, threatsResult, dashboardResult] = await Promise.all([
        client.query(eventsQuery, queryParams),
        client.query(violationsQuery),
        client.query(incidentsQuery),
        client.query(threatsQuery),
        client.query(dashboardQuery)
      ]);

      const dashboardData = dashboardResult.rows[0];

      const response = {
        success: true,
        data: {
          overview: {
            securityScore: dashboardData.security_score,
            securityMetrics,
            securitySummary: dashboardData.security_summary,
            complianceSummary: dashboardData.compliance_summary
          },
          events: {
            recent: eventsResult.rows,
            total: eventsResult.rows.length
          },
          violations: {
            recent: violationsResult.rows,
            total: violationsResult.rows.length
          },
          incidents: {
            recent: incidentsResult.rows,
            total: incidentsResult.rows.length
          },
          threats: {
            intelligence: threatsResult.rows
          },
          timeframe,
          lastUpdated: new Date()
        }
      };

      return NextResponse.json(response);

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error fetching security monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch security monitoring data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/security/monitoring
 * Create security event or trigger security actions
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
    const { action, eventData, incidentData } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();

      if (action === 'create_security_event') {
        if (!eventData) {
          return NextResponse.json(
            { error: 'Missing eventData for security event creation' },
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

        // Create security event
        const securityEvent = await securityEngine.processSecurityEvent({
          eventType: eventData.eventType,
          severity: eventData.severity,
          userId: eventData.userId,
          ipAddress: eventData.ipAddress || getClientIP(request),
          userAgent: eventData.userAgent || request.headers.get('user-agent') || 'Unknown',
          details: eventData.details || {}
        });

        return NextResponse.json({
          success: true,
          message: 'Security event created successfully',
          data: {
            eventId: securityEvent.id,
            actionsExecuted: securityEvent.actions.length,
            event: securityEvent
          }
        });

      } else if (action === 'create_incident') {
        if (!incidentData) {
          return NextResponse.json(
            { error: 'Missing incidentData for incident creation' },
            { status: 400 }
          );
        }

        // Create security incident
        const incidentId = `INC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const insertQuery = `
          INSERT INTO security_incidents (
            id, incident_type, severity, title, description, affected_systems,
            affected_users, reported_by, discovered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, created_at
        `;

        const result = await client.query(insertQuery, [
          incidentId,
          incidentData.incidentType,
          incidentData.severity,
          incidentData.title,
          incidentData.description,
          incidentData.affectedSystems || [],
          incidentData.affectedUsers || [],
          incidentData.reportedBy || 'system',
          incidentData.discoveredAt || new Date()
        ]);

        return NextResponse.json({
          success: true,
          message: 'Security incident created successfully',
          data: {
            incidentId: result.rows[0].id,
            createdAt: result.rows[0].created_at
          }
        });

      } else if (action === 'resolve_event') {
        const { eventId, resolution } = body;
        
        if (!eventId) {
          return NextResponse.json(
            { error: 'Missing eventId for event resolution' },
            { status: 400 }
          );
        }

        const updateQuery = `
          UPDATE security_events 
          SET resolved = true, resolved_at = NOW(), resolved_by = $1
          WHERE id = $2
          RETURNING id, resolved_at
        `;

        const result = await client.query(updateQuery, [
          resolution?.resolvedBy || 'admin',
          eventId
        ]);

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Security event not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Security event resolved successfully',
          data: {
            eventId: result.rows[0].id,
            resolvedAt: result.rows[0].resolved_at
          }
        });

      } else if (action === 'block_ip') {
        const { ipAddress, reason, duration } = body;
        
        if (!ipAddress) {
          return NextResponse.json(
            { error: 'Missing ipAddress for IP blocking' },
            { status: 400 }
          );
        }

        // Add to threat intelligence
        const insertQuery = `
          INSERT INTO threat_intelligence (
            threat_type, indicator_value, confidence_score, severity,
            source, description
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `;

        const result = await client.query(insertQuery, [
          'MALICIOUS_IP',
          ipAddress,
          90,
          'HIGH',
          'admin_manual',
          reason || 'Manually blocked by administrator'
        ]);

        return NextResponse.json({
          success: true,
          message: 'IP address blocked successfully',
          data: {
            threatId: result.rows[0].id,
            ipAddress,
            blockedAt: new Date()
          }
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: create_security_event, create_incident, resolve_event, block_ip' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error processing security monitoring action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process security action',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/security/monitoring
 * Update security events, incidents, or policies
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

      if (action === 'update_incident') {
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (updates.status) {
          updateFields.push(`status = $${paramIndex}`);
          values.push(updates.status);
          paramIndex++;
        }

        if (updates.assignedTo) {
          updateFields.push(`assigned_to = $${paramIndex}`);
          values.push(updates.assignedTo);
          paramIndex++;
        }

        if (updates.containmentActions) {
          updateFields.push(`containment_actions = $${paramIndex}`);
          values.push(updates.containmentActions);
          paramIndex++;
        }

        if (updates.resolution) {
          updateFields.push(`lessons_learned = $${paramIndex}`);
          values.push(updates.resolution);
          paramIndex++;
        }

        if (updates.status === 'CLOSED') {
          updateFields.push(`resolved_at = NOW()`);
        }

        updateFields.push(`updated_at = NOW()`);
        values.push(id);

        const updateQuery = `
          UPDATE security_incidents 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING id, status, updated_at
        `;

        const result = await client.query(updateQuery, values);

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Security incident not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Security incident updated successfully',
          data: result.rows[0]
        });

      } else if (action === 'update_violation') {
        const updateQuery = `
          UPDATE compliance_violations 
          SET status = $1, assigned_to = $2, resolution = $3,
              resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END
          WHERE id = $4
          RETURNING id, status, resolved_at
        `;

        const result = await client.query(updateQuery, [
          updates.status,
          updates.assignedTo,
          updates.resolution,
          id
        ]);

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Compliance violation not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Compliance violation updated successfully',
          data: result.rows[0]
        });

      } else {
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: update_incident, update_violation' },
          { status: 400 }
        );
      }

    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error updating security monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update security data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
