// Admin audit logging utility for frontend
export interface AuditLogEntry {
  id: number;
  admin_username: string;
  action: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  details: Record<string, any> | null;
  timestamp: string;
}

export interface CreateAuditLogRequest {
  action: string;
  target_entity_type?: string;
  target_entity_id?: string;
  details?: Record<string, any>;
}

export class AdminAuditLogger {
  private adminApiKey: string;

  constructor(adminApiKey: string) {
    this.adminApiKey = adminApiKey;
  }

  /**
   * Record an admin action in the audit log
   */
  async recordAction(request: CreateAuditLogRequest): Promise<void> {
    try {
      const response = await fetch('/api/admin/audit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': this.adminApiKey,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.error('Failed to record audit log:', await response.text());
      }
    } catch (error) {
      console.error('Error recording audit log:', error);
    }
  }

  /**
   * Record user management actions
   */
  async recordUserAction(
    action: 'user_viewed' | 'user_updated' | 'user_activated' | 'user_deactivated' | 'user_role_changed' | 'user_verified',
    userId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.recordAction({
      action,
      target_entity_type: 'user',
      target_entity_id: userId,
      details,
    });
  }

  /**
   * Fetch audit logs with filtering
   */
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    target_entity_type?: string;
    target_entity_id?: string;
    admin_username?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }

    try {
      const response = await fetch(`/api/admin/audit-log?${searchParams.toString()}`, {
        headers: {
          'X-Admin-API-Key': this.adminApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Audit log API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: `/api/admin/audit-log?${searchParams.toString()}`,
          adminApiKey: this.adminApiKey ? 'present' : 'missing'
        });
        throw new Error(`Failed to fetch audit logs: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Network error fetching audit logs:', error);
      throw error;
    }
  }
}

// Helper function to create audit logger instance
export function createAuditLogger(adminApiKey: string): AdminAuditLogger {
  return new AdminAuditLogger(adminApiKey);
}

// Common audit action types for user management
export const USER_AUDIT_ACTIONS = {
  USER_VIEWED: 'user_viewed',
  USER_UPDATED: 'user_updated',
  USER_ACTIVATED: 'user_activated',
  USER_DEACTIVATED: 'user_deactivated',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_EMAIL_VERIFIED: 'user_email_verified',
  USER_EMAIL_UNVERIFIED: 'user_email_unverified',
  USER_WALLET_VERIFIED: 'user_wallet_verified',
  USER_WALLET_UNVERIFIED: 'user_wallet_unverified',
  BULK_USER_UPDATE: 'bulk_user_update',
  USER_EXPORT: 'user_export',
} as const;

export type UserAuditAction = typeof USER_AUDIT_ACTIONS[keyof typeof USER_AUDIT_ACTIONS];
