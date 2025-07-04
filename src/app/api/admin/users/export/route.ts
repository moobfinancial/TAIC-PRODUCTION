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

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get('export') || 'csv';
    const userIds = searchParams.get('user_ids');

    // Build query based on whether specific user IDs are requested
    let query = `
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
    `;

    const params: any[] = [];
    
    if (userIds) {
      const userIdArray = userIds.split(',').filter(id => id.trim());
      if (userIdArray.length > 0) {
        const placeholders = userIdArray.map((_, index) => `$${index + 1}`).join(',');
        query += ` WHERE u.id IN (${placeholders})`;
        params.push(...userIdArray);
      }
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await pool.query(query, params);
    const users = result.rows;

    if (exportFormat === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'ID', 'Username', 'Email', 'Full Name', 'Role', 'Wallet Address',
        'Active', 'Superuser', 'Email Verified', 'Wallet Verified',
        'Business Name', 'Business Description', 'Order Count', 'Total Spent',
        'Created At', 'Updated At', 'Last Login At'
      ];

      const csvRows = users.map(user => [
        user.id,
        user.username || '',
        user.email || '',
        user.full_name || '',
        user.role,
        user.wallet_address || '',
        user.is_active ? 'Yes' : 'No',
        user.is_superuser ? 'Yes' : 'No',
        user.email_verified ? 'Yes' : 'No',
        user.wallet_verified ? 'Yes' : 'No',
        user.business_name || '',
        user.business_description || '',
        user.order_count,
        user.total_spent,
        user.created_at,
        user.updated_at,
        user.last_login_at || ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(field => {
            // Escape fields that contain commas, quotes, or newlines
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
              return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
          }).join(',')
        )
      ].join('\n');

      // Record audit log for export action
      try {
        await pool.query(
          `INSERT INTO admin_audit_log (admin_username, action, target_entity_type, target_entity_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'admin_user', // TODO: Get actual admin username from auth context
            'user_export',
            'user',
            null,
            JSON.stringify({
              export_format: 'csv',
              user_count: users.length,
              specific_users: !!userIds,
              exported_at: new Date().toISOString()
            })
          ]
        );
      } catch (auditError) {
        console.error('Failed to record audit log for export:', auditError);
        // Don't fail the export if audit logging fails
      }

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // For JSON export (fallback)
    return NextResponse.json({
      users,
      exported_at: new Date().toISOString(),
      total_count: users.length
    });

  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
