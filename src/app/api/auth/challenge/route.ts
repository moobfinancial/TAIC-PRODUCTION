import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

// Assume pool is configured in src/lib/db.ts and exported
// For this example, I'll mock it if actual db.ts is not available
// In a real scenario, import { pool } from '@/lib/db';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Make sure this is set in your environment
});

function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const nonce = generateNonce();

    // Upsert user: If walletAddress exists, update auth_nonce.
    // If not, create a new user record.
    const query = `
      INSERT INTO users (wallet_address, auth_nonce, role)
      VALUES ($1, $2, 'user')
      ON CONFLICT (wallet_address)
      DO UPDATE SET auth_nonce = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING id, wallet_address, auth_nonce;
    `;
    // Note: Adjust default role or other fields as necessary.
    // If username/email are mandatory and unique, this simple upsert might fail
    // or need more complex logic if walletAddress is not the sole primary identifier.
    // Based on the schema, wallet_address is UNIQUE, so this should work.

    const { rows } = await pool.query(query, [walletAddress.toLowerCase(), nonce]);

    if (rows.length === 0) {
      // This case should ideally not be reached due to RETURNING clause
      return NextResponse.json({ error: 'Failed to upsert user and generate nonce' }, { status: 500 });
    }

    return NextResponse.json({ nonce });

  } catch (error) {
    console.error('Challenge API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
