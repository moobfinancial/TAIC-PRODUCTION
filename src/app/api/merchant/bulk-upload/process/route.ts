import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { pool } from '@/lib/db';

interface ProcessOptions {
  validateOnly?: boolean;
  autoApprove?: boolean;
}

async function processUpload(req: NextRequest, merchantUser: any) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const optionsStr = formData.get('options') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'No session ID provided' }, { status: 400 });
    }

    const options: ProcessOptions = optionsStr ? JSON.parse(optionsStr) : {};
    
    const client = await pool.connect();
    
    try {
      // Update session status to processing
      await client.query(`
        UPDATE bulk_upload_sessions 
        SET status = 'processing', started_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND merchant_id = $2
      `, [sessionId, merchantUser.id]);

      // Forward to existing FastAPI bulk upload endpoint
      const fastApiFormData = new FormData();
      fastApiFormData.append('file', file);
      fastApiFormData.append('merchant_id', merchantUser.id);
      
      const fastApiResponse = await fetch('http://localhost:8000/bulk-upload/', {
        method: 'POST',
        body: fastApiFormData,
      });

      if (!fastApiResponse.ok) {
        throw new Error(`FastAPI bulk upload failed: ${fastApiResponse.statusText}`);
      }

      const result = await fastApiResponse.json();
      
      // Update session with results
      const summary = {
        totalRows: result.total_rows || 0,
        processed: result.processed_rows || 0,
        successful: result.successful_rows || 0,
        failed: result.failed_rows || 0,
        skipped: 0
      };

      await client.query(`
        UPDATE bulk_upload_sessions 
        SET 
          status = $1,
          actual_rows = $2,
          processed_rows = $3,
          successful_rows = $4,
          failed_rows = $5,
          completed_at = CURRENT_TIMESTAMP,
          error_summary = $6
        WHERE id = $7
      `, [
        result.success ? 'completed' : 'failed',
        summary.totalRows,
        summary.processed,
        summary.successful,
        summary.failed,
        JSON.stringify(result.errors || []),
        sessionId
      ]);

      // Store detailed errors if any
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          await client.query(`
            INSERT INTO bulk_upload_errors (
              session_id, row_number, error_type, error_message, 
              field_name, field_value, severity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            sessionId,
            error.row || 0,
            error.type || 'UNKNOWN_ERROR',
            error.message || 'Unknown error occurred',
            error.field || null,
            error.value || null,
            error.severity || 'error'
          ]);
        }
      }

      return NextResponse.json({
        success: result.success,
        uploadId: sessionId,
        summary,
        errors: result.errors || [],
        processedAt: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Bulk upload processing error:', error);
    
    // Update session status to failed
    if (formData.get('sessionId')) {
      try {
        const client = await pool.connect();
        await client.query(`
          UPDATE bulk_upload_sessions 
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [formData.get('sessionId')]);
        client.release();
      } catch (dbError) {
        console.error('Failed to update session status:', dbError);
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload processing failed'
    }, { status: 500 });
  }
}

export const POST = withMerchantAuth(processUpload);
