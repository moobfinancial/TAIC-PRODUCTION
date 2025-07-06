import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@/lib/db';

interface CreateSessionRequest {
  filename: string;
  fileSize: number;
  expectedRows: number;
}

async function createUploadSession(req: NextRequest, merchantUser: any) {
  try {
    const body: CreateSessionRequest = await req.json();
    const { filename, fileSize, expectedRows } = body;

    // Validate input
    if (!filename || !fileSize || expectedRows === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, expectedRows' },
        { status: 400 }
      );
    }

    if (fileSize > 50 * 1024 * 1024) { // 50MB limit
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    const client = await pool.connect();

    try {
      // Create upload session record
      await client.query(`
        INSERT INTO bulk_upload_sessions (
          id, merchant_id, filename, file_size, expected_rows, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [sessionId, merchantUser.id, filename, fileSize, expectedRows, 'created']);

      return NextResponse.json({
        sessionId,
        status: 'created',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating upload session:', error);
    return NextResponse.json(
      { error: 'Failed to create upload session' },
      { status: 500 }
    );
  }
}

export const POST = withMerchantAuth(createUploadSession);
