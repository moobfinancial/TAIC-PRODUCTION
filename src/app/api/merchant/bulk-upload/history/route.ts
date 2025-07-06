import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { pool } from '@/lib/db';

async function getUploadHistory(req: NextRequest, merchantUser: any) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    
    const offset = (page - 1) * limit;
    
    const client = await pool.connect();
    
    try {
      // Build query with optional status filter
      let whereClause = 'WHERE merchant_id = $1';
      let queryParams: any[] = [merchantUser.id];
      
      if (status) {
        whereClause += ' AND status = $2';
        queryParams.push(status);
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM bulk_upload_sessions 
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const dataQuery = `
        SELECT 
          id as session_id,
          filename,
          status,
          actual_rows as total_rows,
          processed_rows,
          successful_rows,
          failed_rows,
          file_size,
          created_at,
          started_at,
          completed_at,
          error_summary
        FROM bulk_upload_sessions 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      
      queryParams.push(limit, offset);
      const dataResult = await client.query(dataQuery, queryParams);
      
      const uploads = dataResult.rows.map(row => ({
        sessionId: row.session_id,
        filename: row.filename,
        status: row.status,
        summary: {
          totalRows: row.total_rows || 0,
          processed: row.processed_rows || 0,
          successful: row.successful_rows || 0,
          failed: row.failed_rows || 0,
          skipped: 0
        },
        fileSize: row.file_size,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        hasErrors: row.failed_rows > 0
      }));
      
      return NextResponse.json({
        uploads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching upload history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload history' },
      { status: 500 }
    );
  }
}

export const GET = withMerchantAuth(getUploadHistory);
