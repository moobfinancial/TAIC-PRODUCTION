// Updated version of the challenge route to use the wallet_address column
// Replace the contents of src/app/api/auth/challenge/route.ts with this code
// AFTER the database migration has been completed

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Import the configured pool from lib/db.ts
import { pool } from '@/lib/db';

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

    // Using the dedicated wallet_address column for proper wallet authentication
    const query = `
      INSERT INTO users (wallet_address, auth_nonce, role)
      VALUES ($1, $2, 'user')
      ON CONFLICT (wallet_address)
      DO UPDATE SET auth_nonce = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING id, wallet_address, auth_nonce;
    `;

    const values = [walletAddress.toLowerCase(), nonce];
    
    const result = await pool.query(query, values);
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'Failed to create or update user' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Challenge created',
      nonce: user.auth_nonce,
      userId: user.id
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
