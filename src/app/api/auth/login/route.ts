import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password }: LoginRequest = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Get user by email
    const result = await pool.query(
      'SELECT id, email, username, password_hash, display_name, role, taic_balance FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    const user = result.rows[0];

    // Check if this is a wallet-based account
    if (user.password_hash === 'wallet_auth') {
      return NextResponse.json({ 
        message: 'This account uses wallet authentication. Please connect your wallet to login.' 
      }, { status: 403 });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json({ message: 'Internal server error: JWT configuration missing' }, { status: 500 });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Return the user and token
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        taicBalance: user.taic_balance,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    // Check if error is an object and has a message property
    const message = (error instanceof Error && error.message) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
