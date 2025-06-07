import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/db';
import { authenticateMerchant, MerchantJwtPayload } from '@/lib/merchantAuth';

// Token refresh endpoint
export async function POST(req: NextRequest) {
  console.log('Token refresh request received');
  try {
    // Authenticate the merchant using the current token
    const authResult = await authenticateMerchant(req);
    console.log('Auth result:', JSON.stringify(authResult, null, 2));
    
    if (!authResult.authenticated || !authResult.user) {
      console.log('Authentication failed:', authResult);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Generate a new token with the same merchant data
    const merchant = authResult.user;
    console.log('Merchant data for token:', JSON.stringify(merchant, null, 2));
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    console.log('JWT_SECRET is defined, proceeding with token creation');
    
    // Create a new token with a new expiration date
    const token = jwt.sign(
      { 
        userId: merchant.id,
        username: merchant.username,
        email: merchant.email,
        role: 'merchant'
      },
      jwtSecret,
      { expiresIn: '7d' } // Token expires in 7 days
    );
    
    // Note: We're skipping the last_login update as the column doesn't exist in the database schema
    // If tracking last login time is needed, the users table would need to be altered to add this column
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to refresh token', details: errorMessage },
      { status: 500 }
    );
  }
}
