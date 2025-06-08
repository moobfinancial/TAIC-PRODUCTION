import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Assume pool is configured in src/lib/db.ts and exported
// For this example, I'll mock it if actual db.ts is not available
// In a real scenario, import { pool } from '@/lib/db';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Make sure this is set in your environment
});

// Ensure you have a JWT_SECRET in your environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-and-long-enough-jwt-secret';
if (JWT_SECRET === 'your-super-secret-and-long-enough-jwt-secret' && process.env.NODE_ENV !== 'test') {
  console.warn("Using default JWT_SECRET. Please set a strong secret in your environment variables for production.");
}

interface TokenPayload {
  userId: number;
  walletAddress: string;
  role: string;
  iat: number;
  exp: number;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or malformed' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token missing from Authorization header' }, { status: 401 });
    }

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      // Token verification failed (e.g., expired, invalid signature)
      console.error('JWT verification error:', error);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!decoded.userId) {
        return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // Retrieve user from DB using userId from token
    const userQuery = `
      SELECT id, wallet_address, username, email, role, taic_balance, cashback_balance
      FROM users
      WHERE id = $1;
    `;
    const { rows: users } = await pool.query(userQuery, [decoded.userId]);

    if (users.length === 0) {
      // This case might happen if the user was deleted after token issuance
      return NextResponse.json({ error: 'User not found for token' }, { status: 404 });
    }

    const user = users[0];

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        username: user.username,
        email: user.email,
        role: user.role,
        taicBalance: parseFloat(user.taic_balance),
        cashbackBalance: parseFloat(user.cashback_balance)
      },
    });

  } catch (error) {
    console.error('Me API error:', error);
    // Check if it's a PG error (e.g. DB connection)
    if (error && typeof error === 'object' && 'code' in error) {
        return NextResponse.json({ error: `Database error: ${error.code}`}, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
