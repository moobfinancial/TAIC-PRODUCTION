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

    // Upsert user based on wallet address and set a new nonce for the challenge.
    // If a user with the wallet address exists, update their nonce.
    // If not, create a new user with the given wallet address and nonce.
    const query = `
      INSERT INTO users (wallet_address, username, auth_nonce, role)
      VALUES ($1, $1, $2, 'user')
      ON CONFLICT (wallet_address)
      DO UPDATE SET auth_nonce = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING id, wallet_address, auth_nonce;
    `;

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
