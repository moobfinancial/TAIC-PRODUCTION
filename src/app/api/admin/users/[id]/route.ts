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

// Detailed user profile interface for admin view
interface AdminUserProfile {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: string;
  wallet_address: string | null;
  is_active: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  wallet_verified: boolean;
  business_name: string | null;
  business_description: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  order_count: number;
  total_spent: number;
  addresses: UserAddress[];
}

interface UserAddress {
  id: number;
  address_nickname: string | null;
  contact_name: string;
  company_name: string | null;
  street_address_line1: string;
  street_address_line2: string | null;
  city: string;
  state_province_region: string;
  postal_zip_code: string;
  country_code: string;
  phone_number: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user profile with order statistics
    const userQuery = `
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.wallet_address,
        u.is_active, u.is_superuser, u.email_verified, u.wallet_verified, 
        u.business_name, u.business_description, u.created_at, u.updated_at, 
        u.last_login_at,
        COALESCE(order_stats.order_count, 0) as order_count,
        COALESCE(order_stats.total_spent, 0) as total_spent
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as order_count,
          SUM(amount) as total_spent
        FROM orders 
        WHERE status IN ('completed', 'delivered')
        GROUP BY user_id
      ) order_stats ON u.id = order_stats.user_id
      WHERE u.id = $1
    `;

    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Get user addresses (handle missing table gracefully)
    let addresses: UserAddress[] = [];
    try {
      const addressQuery = `
        SELECT
          id, address_nickname, contact_name, company_name,
          street_address_line1, street_address_line2, city,
          state_province_region, postal_zip_code, country_code,
          phone_number, is_default_shipping, is_default_billing,
          created_at
        FROM user_addresses
        WHERE user_id = $1
        ORDER BY is_default_shipping DESC, is_default_billing DESC, created_at DESC
      `;

      const addressResult = await pool.query(addressQuery, [userId]);
      addresses = addressResult.rows;
    } catch (error) {
      console.warn('user_addresses table not found, returning empty addresses array');
      addresses = [];
    }

    const userProfile: AdminUserProfile = {
      ...user,
      total_spent: parseFloat(user.total_spent) || 0,
      addresses: addresses
    };

    return NextResponse.json(userProfile);

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const userId = params.id;
    const body = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { 
      is_active, 
      role, 
      email_verified, 
      wallet_verified,
      admin_notes 
    } = body;

    // Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (typeof is_active === 'boolean') {
      updateFields.push(`is_active = $${paramIndex}`);
      updateParams.push(is_active);
      paramIndex++;
    }

    if (role && ['SHOPPER', 'MERCHANT', 'ADMIN'].includes(role)) {
      updateFields.push(`role = $${paramIndex}`);
      updateParams.push(role);
      paramIndex++;
    }

    if (typeof email_verified === 'boolean') {
      updateFields.push(`email_verified = $${paramIndex}`);
      updateParams.push(email_verified);
      paramIndex++;
    }

    if (typeof wallet_verified === 'boolean') {
      updateFields.push(`wallet_verified = $${paramIndex}`);
      updateParams.push(wallet_verified);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateParams.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, is_active, email_verified, wallet_verified, updated_at
    `;

    const result = await pool.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Record audit log entry for this admin action
    try {
      const auditDetails: Record<string, any> = {};

      if (typeof is_active === 'boolean') {
        auditDetails.is_active_changed = { from: 'unknown', to: is_active };
      }
      if (role) {
        auditDetails.role_changed = { from: 'unknown', to: role };
      }
      if (typeof email_verified === 'boolean') {
        auditDetails.email_verified_changed = { from: 'unknown', to: email_verified };
      }
      if (typeof wallet_verified === 'boolean') {
        auditDetails.wallet_verified_changed = { from: 'unknown', to: wallet_verified };
      }
      if (admin_notes) {
        auditDetails.admin_notes = admin_notes;
      }

      // Insert audit log entry
      await pool.query(
        `INSERT INTO admin_audit_log (admin_username, action, target_entity_type, target_entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'admin_user', // TODO: Get actual admin username from auth context
          'user_updated',
          'user',
          userId,
          JSON.stringify(auditDetails)
        ]
      );
    } catch (auditError) {
      console.error('Failed to record audit log:', auditError);
      // Don't fail the main operation if audit logging fails
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
