import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name }: RegisterRequest = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 409 });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert the new user
    const result = await pool.query(
      `INSERT INTO users (id, email, username, password_hash, display_name, role, taic_balance)
       VALUES (gen_random_uuid(), $1, $1, $2, $3, 'user', 0)
       RETURNING id, email, username, display_name, role, taic_balance`,
      [
        email.toLowerCase(),
        hashedPassword,
        name || null
      ]
    );

    const user = result.rows[0];

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
        taicBalance: user.taic_balance
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    // Check if error is an object and has a message property
    const message = (error instanceof Error && error.message) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
