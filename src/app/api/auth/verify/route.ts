import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';

// Assume pool is configured in src/lib/db.ts and exported
// For this example, I'll mock it if actual db.ts is not available
// In a real scenario, import { pool } from '@/lib/db';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Make sure this is set in your environment
});

// Ensure you have a JWT_SECRET in your environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-and-long-enough-jwt-secret';
if (JWT_SECRET === 'your-super-secret-and-long-enough-jwt-secret') {
  console.warn("Using default JWT_SECRET. Please set a strong secret in your environment variables.");
}

export async function POST(request: Request) {
  try {
    const { walletAddress, signature } = await request.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 });
    }

    const lowercasedWalletAddress = walletAddress.toLowerCase();

    // 1. Retrieve user by walletAddress and their stored auth_nonce
    const userQuery = 'SELECT id, wallet_address, auth_nonce, username, email, role, taic_balance FROM users WHERE wallet_address = $1';
    const { rows: users } = await pool.query(userQuery, [lowercasedWalletAddress]);

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    if (!user.auth_nonce) {
      return NextResponse.json({ error: 'Nonce not found or already used. Please request a new challenge.' }, { status: 403 });
    }

    // 2. Construct the expected signed message
    // This message MUST match exactly what the frontend will sign
    const message = `Logging in to TAIC: ${user.auth_nonce}`;

    // 3. Use ethers.verifyMessage(message, signature) to get the signer's address
    let recoveredAddress;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch (e) {
      console.error("Error verifying signature:", e);
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
    }


    // 4. If recovered address matches walletAddress
    if (recoveredAddress.toLowerCase() === lowercasedWalletAddress) {
      // Clear/update auth_nonce in the database to prevent reuse
      const updateNonceQuery = 'UPDATE users SET auth_nonce = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
      await pool.query(updateNonceQuery, [user.id]);

      // Generate a JWT
      const tokenPayload = {
        userId: user.id,
        walletAddress: user.wallet_address,
        role: user.role,
        // Add any other claims you need
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' }); // Adjust expiration as needed

      // Return token and user info
      return NextResponse.json({
        token,
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          email: user.email,
          role: user.role,
          taicBalance: user.taic_balance, // Ensure this is numeric in DB
        },
      });
    } else {
      // Signature does not match the wallet address
      return NextResponse.json({ error: 'Signature verification failed. Wallet address mismatch.' }, { status: 403 });
    }

  } catch (error) {
    console.error('Verify API error:', error);
    // Check if it's a PG error (e.g. DB connection)
    if (error && typeof error === 'object' && 'code' in error) {
        return NextResponse.json({ error: `Database error: ${error.code}`}, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
