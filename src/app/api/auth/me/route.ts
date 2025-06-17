import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import jwt from 'jsonwebtoken';

interface AuthenticatedUser {
  userId: number; // Changed from string to number to match DB schema for id
  email?: string;
  walletAddress?: string;
  role: string;
  iat: number;
  exp: number;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization header missing or malformed' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Token missing' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined');
      // It's crucial not to leak sensitive info like "JWT_SECRET is not defined" to the client in production.
      // For development, this console error is fine. For production, a generic message is better.
      return NextResponse.json({ message: 'Configuration error' }, { status: 500 });
    }

    let decoded: AuthenticatedUser;
    try {
      // Explicitly type the decoded token if possible, or handle potential undefined properties.
      const verifiedPayload = jwt.verify(token, jwtSecret);
      if (typeof verifiedPayload === 'string' || !verifiedPayload.userId) {
          // Handle case where payload is string or essential fields are missing
          return NextResponse.json({ message: 'Invalid token payload' }, { status: 401 });
      }
      decoded = verifiedPayload as AuthenticatedUser;

    } catch (error) {
      // Handle different JWT errors specifically if needed (e.g., TokenExpiredError, JsonWebTokenError)
      console.error('JWT verification error:', error);
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    // Retrieve user from DB using userId from token
    // Support both email-based and wallet-based authentication
    let userResult;
    
    if (decoded.walletAddress) {
      // For wallet-based authentication, use username field as temporary wallet_address storage
      userResult = await pool.query(
        'SELECT id, username AS wallet_address, username, email, role, taic_balance, display_name FROM users WHERE id = $1 AND username = $2',
        [decoded.userId, decoded.walletAddress.toLowerCase()]
      );
    } else {
      // For email-based authentication
      userResult = await pool.query(
        'SELECT id, username, email, role, taic_balance, display_name FROM users WHERE id = $1',
        [decoded.userId]
      );
    }

    if (userResult.rows.length === 0) {
      // This could happen if the user was deleted after the token was issued, or if wallet_address changed.
      return NextResponse.json({ message: 'User not found or token details mismatch' }, { status: 404 });
    }

    const user = userResult.rows[0];

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address || null,
        username: user.username,
        email: user.email,
        displayName: user.display_name, // Added displayName
        role: user.role,
        taicBalance: user.taic_balance, // Ensure this is being selected and returned
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    const message = (error instanceof Error && error.message) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
