import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'merchant-jwt-secret-key-change-in-production';

export interface MerchantJwtPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Middleware to authenticate merchant users via JWT token
 */
export async function authenticateMerchant(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Missing or invalid authorization header',
        status: 401
      };
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return {
        authenticated: false,
        error: 'No token provided',
        status: 401
      };
    }

    try {
      // Verify and decode the token
      const decoded = verify(token, JWT_SECRET) as MerchantJwtPayload;
      
      // Check if user exists and is a merchant
      const { rows } = await pool.query(
        'SELECT id, username, email, role FROM users WHERE id = $1 AND role = $2',
        [decoded.userId, 'merchant']
      );

      if (rows.length === 0) {
        return {
          authenticated: false,
          error: 'User not found or not a merchant',
          status: 403
        };
      }

      // Return the authenticated user
      return {
        authenticated: true,
        user: {
          id: rows[0].id,
          username: rows[0].username,
          email: rows[0].email,
          role: rows[0].role
        }
      };
    } catch (error) {
      console.error('JWT verification error:', error);
      return {
        authenticated: false,
        error: 'Invalid or expired token',
        status: 401
      };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication error',
      status: 500
    };
  }
}

/**
 * Higher-order function to protect API routes that require merchant authentication
 */
export function withMerchantAuth(handler: Function) {
  return async (req: NextRequest) => {
    const authResult = await authenticateMerchant(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    
    // Add the authenticated user to the request for the handler to use
    return handler(req, authResult.user);
  };
}
