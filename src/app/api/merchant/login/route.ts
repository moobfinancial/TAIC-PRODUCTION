import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { verifyPassword } from '@/lib/passwordUtils';
import { sign } from 'jsonwebtoken';

// JWT secret from environment variables or fallback
const JWT_SECRET = process.env.JWT_SECRET || 'merchant-jwt-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // Token expires in 7 days

// Define validation schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { email, password } = validationResult.data;
    
    // Find user by email
    const result = await pool.query(
      `SELECT id, username, email, hashed_password, role, business_name 
       FROM users 
       WHERE email = $1 AND role = 'MERCHANT'`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    const user = result.rows[0];
    
    // Verify password
    const passwordValid = await verifyPassword(password, user.hashed_password);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Return user data and token
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        businessName: user.business_name,
      },
      token,
    });
  } catch (error) {
    console.error('Merchant login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
