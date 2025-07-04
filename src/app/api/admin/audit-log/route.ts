import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Admin API Key Validation
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for admin route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

interface AuditLogEntry {
  id: number;
  admin_username: string;
  action: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  details: Record<string, any> | null;
  timestamp: string;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CreateAuditLogRequest {
  action: string;
  target_entity_type?: string;
  target_entity_id?: string;
  details?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const action = searchParams.get('action') || '';
    const targetEntityType = searchParams.get('target_entity_type') || '';
    const targetEntityId = searchParams.get('target_entity_id') || '';
    const adminUsername = searchParams.get('admin_username') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    // Build WHERE clause conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (targetEntityType) {
      conditions.push(`target_entity_type = $${paramIndex}`);
      params.push(targetEntityType);
      paramIndex++;
    }

    if (targetEntityId) {
      conditions.push(`target_entity_id = $${paramIndex}`);
      params.push(targetEntityId);
      paramIndex++;
    }

    if (adminUsername) {
      conditions.push(`admin_username ILIKE $${paramIndex}`);
      params.push(`%${adminUsername}%`);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM admin_audit_log 
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get audit logs with pagination
    const logsQuery = `
      SELECT 
        id, admin_username, action, target_entity_type, 
        target_entity_id, details, timestamp
      FROM admin_audit_log 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const logsParams = [...params, limit, offset];
    const logsResult = await pool.query(logsQuery, logsParams);

    const totalPages = Math.ceil(total / limit);

    const response: AuditLogResponse = {
      logs: logsResult.rows.map(row => ({
        ...row,
        details: row.details || null
      })),
      total,
      page,
      limit,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching audit logs:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      searchParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      apiKeyPresent: !!apiKey
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateAuditLogRequest = await request.json();
    const { action, target_entity_type, target_entity_id, details } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Insert audit log entry
    const insertQuery = `
      INSERT INTO admin_audit_log (admin_username, action, target_entity_type, target_entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, timestamp
    `;

    const result = await pool.query(insertQuery, [
      'admin_user', // TODO: Get actual admin username from auth context
      action,
      target_entity_type || null,
      target_entity_id || null,
      details ? JSON.stringify(details) : null
    ]);

    return NextResponse.json({
      message: 'Audit log entry created successfully',
      id: result.rows[0].id,
      timestamp: result.rows[0].timestamp
    });

  } catch (error) {
    console.error('Error creating audit log entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
