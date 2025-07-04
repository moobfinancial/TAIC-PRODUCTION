import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Admin API Key Validation
function validateAdminApiKey(apiKey: string | null): boolean {
  const serverApiKey = process.env.ADMIN_API_KEY;
  if (!serverApiKey) {
    console.warn("ADMIN_API_KEY is not set on the server for admin route protection.");
    return false;
  }
  return apiKey === serverApiKey;
}

// User interface for admin view
interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  is_active: boolean;
  email_verified: boolean;
  wallet_verified: boolean;
  business_name: string | null;
  business_description: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface UsersListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Search parameters
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const emailVerified = searchParams.get('emailVerified') || '';
    const walletVerified = searchParams.get('walletVerified') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build WHERE clause conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Search filter (email, username, full_name, wallet_address)
    if (search) {
      conditions.push(`(
        email ILIKE $${paramIndex} OR 
        username ILIKE $${paramIndex} OR 
        full_name ILIKE $${paramIndex} OR 
        wallet_address ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Role filter
    if (role && ['SHOPPER', 'MERCHANT', 'ADMIN'].includes(role)) {
      conditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    // Status filter (active/inactive)
    if (status === 'active') {
      conditions.push(`is_active = true`);
    } else if (status === 'inactive') {
      conditions.push(`is_active = false`);
    }

    // Email verification filter
    if (emailVerified === 'true') {
      conditions.push(`email_verified = true`);
    } else if (emailVerified === 'false') {
      conditions.push(`email_verified = false`);
    }

    // Wallet verification filter
    if (walletVerified === 'true') {
      conditions.push(`wallet_verified = true`);
    } else if (walletVerified === 'false') {
      conditions.push(`wallet_verified = false`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column to prevent SQL injection
    const validSortColumns = ['created_at', 'updated_at', 'email', 'username', 'full_name', 'role', 'last_login_at'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get users with pagination
    const usersQuery = `
      SELECT 
        id, username, email, full_name, role, wallet_address,
        is_active, email_verified, wallet_verified, business_name, 
        business_description, created_at, updated_at, last_login_at
      FROM users 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const usersParams = [...params, limit, offset];
    const usersResult = await pool.query(usersQuery, usersParams);

    const totalPages = Math.ceil(total / limit);

    const response: UsersListResponse = {
      users: usersResult.rows,
      total,
      page,
      limit,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
