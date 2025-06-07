import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/passwordUtils';

// Define validation schema for merchant registration
const merchantRegistrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(255),
  businessDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate input
    const validationResult = merchantRegistrationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { username, email, password, businessName, businessDescription } = validationResult.data;
    
    // Check if username or email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 409 }
      );
    }
    
    // Hash the password
    const passwordHash = await hashPassword(password);
    
    // Insert the new merchant user
    const result = await pool.query(
      `INSERT INTO users 
        (username, email, password_hash, business_name, business_description, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, username, email, business_name, role, created_at`,
      [username, email, passwordHash, businessName, businessDescription || null, 'merchant']
    );
    
    const newMerchant = result.rows[0];
    
    // Transform the response to match camelCase naming convention
    const response = {
      id: newMerchant.id,
      username: newMerchant.username,
      email: newMerchant.email,
      businessName: newMerchant.business_name,
      role: newMerchant.role,
      createdAt: newMerchant.created_at,
    };
    
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Merchant registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register merchant' },
      { status: 500 }
    );
  }
}
