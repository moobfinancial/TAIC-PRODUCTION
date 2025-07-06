import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { pool } from '@/lib/db';

async function getUploadStatus(
  req: NextRequest, 
  merchantUser: any,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    
    try {
      // Get session details
      const sessionQuery = `
        SELECT 
          id,
          merchant_id,
          filename,
          file_size,
          expected_rows,
          actual_rows,
          processed_rows,
          successful_rows,
          failed_rows,
          status,
          created_at,
          started_at,
          completed_at,
          error_summary
        FROM bulk_upload_sessions 
        WHERE id = $1 AND merchant_id = $2
      `;
      
      const sessionResult = await client.query(sessionQuery, [sessionId, merchantUser.id]);
      
      if (sessionResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Upload session not found' },
          { status: 404 }
        );
      }
      
      const session = sessionResult.rows[0];
      
      // Calculate progress
      let progress = 0;
      let currentPhase = 'created';
      let estimatedTimeRemaining = null;
      
      if (session.status === 'processing') {
        if (session.processed_rows && session.expected_rows) {
          progress = Math.round((session.processed_rows / session.expected_rows) * 100);
        }
        currentPhase = 'processing_products';
        
        // Estimate time remaining based on processing speed
        if (session.started_at && session.processed_rows > 0) {
          const elapsedMs = Date.now() - new Date(session.started_at).getTime();
          const processingRate = session.processed_rows / (elapsedMs / 1000); // rows per second
          const remainingRows = session.expected_rows - session.processed_rows;
          estimatedTimeRemaining = Math.round(remainingRows / processingRate);
        }
      } else if (session.status === 'completed') {
        progress = 100;
        currentPhase = 'completed';
      } else if (session.status === 'failed') {
        progress = 0;
        currentPhase = 'failed';
      }
      
      // Get recent errors if any
      let recentErrors = [];
      if (session.failed_rows > 0) {
        const errorsQuery = `
          SELECT 
            row_number,
            error_type,
            error_message,
            field_name,
            field_value,
            severity
          FROM bulk_upload_errors 
          WHERE session_id = $1 
          ORDER BY id DESC 
          LIMIT 5
        `;
        
        const errorsResult = await client.query(errorsQuery, [sessionId]);
        recentErrors = errorsResult.rows;
      }
      
      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
        progress: {
          percentage: progress,
          processedRows: session.processed_rows || 0,
          totalRows: session.expected_rows || 0,
          estimatedTimeRemaining
        },
        currentPhase,
        summary: {
          totalRows: session.actual_rows || session.expected_rows || 0,
          processed: session.processed_rows || 0,
          successful: session.successful_rows || 0,
          failed: session.failed_rows || 0,
          skipped: 0
        },
        timing: {
          createdAt: session.created_at,
          startedAt: session.started_at,
          completedAt: session.completed_at
        },
        recentErrors,
        lastUpdate: new Date().toISOString()
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching upload status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload status' },
      { status: 500 }
    );
  }
}

export const GET = withMerchantAuth(getUploadStatus);
