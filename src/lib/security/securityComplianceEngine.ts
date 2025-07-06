import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export interface SecurityEvent {
  id: string;
  eventType: 'LOGIN_ATTEMPT' | 'FAILED_LOGIN' | 'SUSPICIOUS_ACTIVITY' | 'UNAUTHORIZED_ACCESS' | 
            'DATA_ACCESS' | 'PRIVILEGE_ESCALATION' | 'SYSTEM_BREACH' | 'COMPLIANCE_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actions: SecurityAction[];
}

export interface SecurityAction {
  actionType: 'ALERT' | 'BLOCK_USER' | 'BLOCK_IP' | 'REQUIRE_2FA' | 'FORCE_LOGOUT' | 
             'ESCALATE' | 'AUDIT_LOG' | 'COMPLIANCE_REPORT';
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  executedAt?: Date;
  details: Record<string, any>;
}

export interface ComplianceRule {
  id: string;
  ruleType: 'AML' | 'KYC' | 'GDPR' | 'PCI_DSS' | 'SOX' | 'CCPA' | 'CUSTOM';
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  conditions: ComplianceCondition[];
  actions: ComplianceAction[];
  lastUpdated: Date;
}

export interface ComplianceCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS' | 'REGEX';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface ComplianceAction {
  actionType: 'BLOCK_TRANSACTION' | 'REQUIRE_APPROVAL' | 'GENERATE_REPORT' | 'NOTIFY_ADMIN' | 
             'FREEZE_ACCOUNT' | 'REQUEST_DOCUMENTATION' | 'ESCALATE_TO_COMPLIANCE';
  parameters: Record<string, any>;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  violationType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: 'USER' | 'TRANSACTION' | 'MERCHANT' | 'SYSTEM';
  entityId: string;
  details: Record<string, any>;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  resolvedEvents: number;
  averageResolutionTime: number; // hours
  topThreatTypes: Array<{ type: string; count: number }>;
  complianceScore: number; // 0-100
  activeViolations: number;
  blockedIPs: number;
  suspendedUsers: number;
}

export interface AuditTrail {
  id: string;
  entityType: 'USER' | 'TRANSACTION' | 'SYSTEM' | 'ADMIN' | 'MERCHANT';
  entityId: string;
  action: string;
  performedBy: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  dataChanges?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
}

/**
 * Comprehensive Security and Compliance Engine
 * Provides enterprise-grade security monitoring, threat detection, and regulatory compliance
 */
export class SecurityComplianceEngine {
  private securityRules: Map<string, ComplianceRule> = new Map();
  private activeThreats: Map<string, SecurityEvent> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspendedUsers: Set<string> = new Set();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default security and compliance rules
   */
  private initializeDefaultRules(): void {
    // AML Rule: Large transaction monitoring
    this.addComplianceRule({
      id: 'AML_LARGE_TRANSACTION',
      ruleType: 'AML',
      name: 'Large Transaction Monitoring',
      description: 'Monitor transactions above $10,000 for AML compliance',
      severity: 'HIGH',
      enabled: true,
      conditions: [
        { field: 'amount', operator: 'GREATER_THAN', value: 10000 }
      ],
      actions: [
        { actionType: 'REQUIRE_APPROVAL', parameters: { approvalLevel: 'COMPLIANCE_OFFICER' } },
        { actionType: 'GENERATE_REPORT', parameters: { reportType: 'AML_SUSPICIOUS_ACTIVITY' } }
      ],
      lastUpdated: new Date()
    });

    // KYC Rule: Unverified user transaction limits
    this.addComplianceRule({
      id: 'KYC_UNVERIFIED_LIMIT',
      ruleType: 'KYC',
      name: 'Unverified User Transaction Limit',
      description: 'Limit transactions for unverified users to $1,000',
      severity: 'MEDIUM',
      enabled: true,
      conditions: [
        { field: 'userVerified', operator: 'EQUALS', value: false, logicalOperator: 'AND' },
        { field: 'amount', operator: 'GREATER_THAN', value: 1000 }
      ],
      actions: [
        { actionType: 'BLOCK_TRANSACTION', parameters: { reason: 'KYC_VERIFICATION_REQUIRED' } },
        { actionType: 'REQUEST_DOCUMENTATION', parameters: { documentType: 'IDENTITY_VERIFICATION' } }
      ],
      lastUpdated: new Date()
    });

    // GDPR Rule: Data access logging
    this.addComplianceRule({
      id: 'GDPR_DATA_ACCESS',
      ruleType: 'GDPR',
      name: 'Personal Data Access Logging',
      description: 'Log all access to personal data for GDPR compliance',
      severity: 'MEDIUM',
      enabled: true,
      conditions: [
        { field: 'dataType', operator: 'CONTAINS', value: 'PERSONAL' }
      ],
      actions: [
        { actionType: 'GENERATE_REPORT', parameters: { reportType: 'GDPR_DATA_ACCESS' } }
      ],
      lastUpdated: new Date()
    });

    // Security Rule: Multiple failed login attempts
    this.addComplianceRule({
      id: 'SEC_FAILED_LOGINS',
      ruleType: 'CUSTOM',
      name: 'Multiple Failed Login Attempts',
      description: 'Detect and block multiple failed login attempts',
      severity: 'HIGH',
      enabled: true,
      conditions: [
        { field: 'failedAttempts', operator: 'GREATER_THAN', value: 5 }
      ],
      actions: [
        { actionType: 'FREEZE_ACCOUNT', parameters: { duration: '24h' } },
        { actionType: 'NOTIFY_ADMIN', parameters: { alertType: 'SECURITY_BREACH' } }
      ],
      lastUpdated: new Date()
    });
  }

  /**
   * Add a new compliance rule
   */
  public addComplianceRule(rule: ComplianceRule): void {
    this.securityRules.set(rule.id, rule);
  }

  /**
   * Process a security event and apply appropriate actions
   */
  public async processSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved' | 'actions'>): Promise<SecurityEvent> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false,
      actions: []
    };

    // Determine appropriate actions based on event type and severity
    const actions = this.determineSecurityActions(securityEvent);
    securityEvent.actions = actions;

    // Execute immediate actions
    await this.executeSecurityActions(securityEvent);

    // Store event
    this.activeThreats.set(securityEvent.id, securityEvent);

    // Store in database
    await this.storeSecurityEvent(securityEvent);

    return securityEvent;
  }

  /**
   * Evaluate compliance rules against data
   */
  public async evaluateCompliance(
    entityType: string,
    entityId: string,
    data: Record<string, any>
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    for (const rule of this.securityRules.values()) {
      if (!rule.enabled) continue;

      const isViolation = this.evaluateRuleConditions(rule.conditions, data);
      
      if (isViolation) {
        const violation: ComplianceViolation = {
          id: this.generateViolationId(),
          ruleId: rule.id,
          ruleName: rule.name,
          violationType: rule.ruleType,
          severity: rule.severity,
          entityType: entityType as any,
          entityId,
          details: data,
          status: 'OPEN',
          createdAt: new Date()
        };

        violations.push(violation);

        // Execute compliance actions
        await this.executeComplianceActions(rule.actions, violation);

        // Store violation
        await this.storeComplianceViolation(violation);
      }
    }

    return violations;
  }

  /**
   * Create comprehensive audit trail entry
   */
  public async createAuditTrail(auditData: Omit<AuditTrail, 'id' | 'timestamp'>): Promise<AuditTrail> {
    const auditEntry: AuditTrail = {
      ...auditData,
      id: this.generateAuditId(),
      timestamp: new Date()
    };

    await this.storeAuditTrail(auditEntry);
    return auditEntry;
  }

  /**
   * Get security metrics and dashboard data
   */
  public async getSecurityMetrics(): Promise<SecurityMetrics> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      // Get event counts
      const eventQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_events,
          COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_events,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_resolution_hours
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;

      const threatTypesQuery = `
        SELECT 
          event_type,
          COUNT(*) as count
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 5
      `;

      const complianceQuery = `
        SELECT 
          COUNT(*) as active_violations
        FROM compliance_violations
        WHERE status IN ('OPEN', 'INVESTIGATING')
      `;

      const [eventResult, threatResult, complianceResult] = await Promise.all([
        client.query(eventQuery),
        client.query(threatTypesQuery),
        client.query(complianceQuery)
      ]);

      const eventData = eventResult.rows[0];
      const threatTypes = threatResult.rows.map(row => ({
        type: row.event_type,
        count: parseInt(row.count)
      }));

      // Calculate compliance score (simplified)
      const totalRules = this.securityRules.size;
      const activeViolations = parseInt(complianceResult.rows[0]?.active_violations) || 0;
      const complianceScore = Math.max(0, 100 - (activeViolations * 10));

      return {
        totalEvents: parseInt(eventData.total_events) || 0,
        criticalEvents: parseInt(eventData.critical_events) || 0,
        resolvedEvents: parseInt(eventData.resolved_events) || 0,
        averageResolutionTime: parseFloat(eventData.avg_resolution_hours) || 0,
        topThreatTypes: threatTypes,
        complianceScore,
        activeViolations,
        blockedIPs: this.blockedIPs.size,
        suspendedUsers: this.suspendedUsers.size
      };

    } catch (error) {
      console.error('Error getting security metrics:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Determine appropriate security actions based on event
   */
  private determineSecurityActions(event: SecurityEvent): SecurityAction[] {
    const actions: SecurityAction[] = [];

    // Always create audit log
    actions.push({
      actionType: 'AUDIT_LOG',
      status: 'PENDING',
      details: { event: event.eventType, severity: event.severity }
    });

    // Severity-based actions
    switch (event.severity) {
      case 'CRITICAL':
        actions.push({
          actionType: 'ESCALATE',
          status: 'PENDING',
          details: { escalationLevel: 'SECURITY_TEAM' }
        });
        if (event.userId) {
          actions.push({
            actionType: 'FORCE_LOGOUT',
            status: 'PENDING',
            details: { userId: event.userId }
          });
        }
        break;

      case 'HIGH':
        actions.push({
          actionType: 'ALERT',
          status: 'PENDING',
          details: { alertType: 'HIGH_SEVERITY_SECURITY_EVENT' }
        });
        if (event.eventType === 'FAILED_LOGIN' && event.userId) {
          actions.push({
            actionType: 'REQUIRE_2FA',
            status: 'PENDING',
            details: { userId: event.userId }
          });
        }
        break;

      case 'MEDIUM':
        actions.push({
          actionType: 'ALERT',
          status: 'PENDING',
          details: { alertType: 'MEDIUM_SEVERITY_SECURITY_EVENT' }
        });
        break;
    }

    // Event-specific actions
    if (event.eventType === 'SUSPICIOUS_ACTIVITY' && event.ipAddress) {
      actions.push({
        actionType: 'BLOCK_IP',
        status: 'PENDING',
        details: { ipAddress: event.ipAddress, duration: '24h' }
      });
    }

    return actions;
  }

  /**
   * Execute security actions
   */
  private async executeSecurityActions(event: SecurityEvent): Promise<void> {
    for (const action of event.actions) {
      try {
        switch (action.actionType) {
          case 'BLOCK_IP':
            this.blockedIPs.add(action.details.ipAddress);
            action.status = 'EXECUTED';
            action.executedAt = new Date();
            break;

          case 'BLOCK_USER':
          case 'FORCE_LOGOUT':
            if (action.details.userId) {
              this.suspendedUsers.add(action.details.userId);
            }
            action.status = 'EXECUTED';
            action.executedAt = new Date();
            break;

          case 'ALERT':
          case 'ESCALATE':
            // In production, this would send notifications
            console.log(`Security Alert: ${action.actionType}`, action.details);
            action.status = 'EXECUTED';
            action.executedAt = new Date();
            break;

          case 'AUDIT_LOG':
            // Already handled by storing the event
            action.status = 'EXECUTED';
            action.executedAt = new Date();
            break;

          default:
            action.status = 'FAILED';
            break;
        }
      } catch (error) {
        console.error(`Failed to execute security action ${action.actionType}:`, error);
        action.status = 'FAILED';
      }
    }
  }

  /**
   * Evaluate rule conditions against data
   */
  private evaluateRuleConditions(conditions: ComplianceCondition[], data: Record<string, any>): boolean {
    if (conditions.length === 0) return false;

    let result = this.evaluateCondition(conditions[0], data);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, data);

      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: ComplianceCondition, data: Record<string, any>): boolean {
    const fieldValue = data[condition.field];

    switch (condition.operator) {
      case 'EQUALS':
        return fieldValue === condition.value;
      case 'NOT_EQUALS':
        return fieldValue !== condition.value;
      case 'GREATER_THAN':
        return Number(fieldValue) > Number(condition.value);
      case 'LESS_THAN':
        return Number(fieldValue) < Number(condition.value);
      case 'CONTAINS':
        return String(fieldValue).includes(String(condition.value));
      case 'REGEX':
        return new RegExp(condition.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Execute compliance actions
   */
  private async executeComplianceActions(actions: ComplianceAction[], violation: ComplianceViolation): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.actionType) {
          case 'BLOCK_TRANSACTION':
            // In production, this would block the transaction
            console.log('Transaction blocked due to compliance violation:', violation.id);
            break;

          case 'REQUIRE_APPROVAL':
            // In production, this would create an approval request
            console.log('Approval required for compliance violation:', violation.id);
            break;

          case 'GENERATE_REPORT':
            // In production, this would generate a compliance report
            console.log('Compliance report generated for violation:', violation.id);
            break;

          case 'NOTIFY_ADMIN':
            // In production, this would send admin notifications
            console.log('Admin notified of compliance violation:', violation.id);
            break;

          case 'FREEZE_ACCOUNT':
            if (violation.entityType === 'USER') {
              this.suspendedUsers.add(violation.entityId);
            }
            break;

          default:
            console.log('Unknown compliance action:', action.actionType);
            break;
        }
      } catch (error) {
        console.error(`Failed to execute compliance action ${action.actionType}:`, error);
      }
    }
  }

  /**
   * Store security event in database
   */
  private async storeSecurityEvent(event: SecurityEvent): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        INSERT INTO security_events (
          id, event_type, severity, user_id, ip_address, user_agent,
          details, resolved, actions, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await client.query(query, [
        event.id,
        event.eventType,
        event.severity,
        event.userId,
        event.ipAddress,
        event.userAgent,
        JSON.stringify(event.details),
        event.resolved,
        JSON.stringify(event.actions),
        event.timestamp
      ]);

    } catch (error) {
      console.error('Error storing security event:', error);
      // Don't throw - security events should not fail the main operation
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Store compliance violation in database
   */
  private async storeComplianceViolation(violation: ComplianceViolation): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        INSERT INTO compliance_violations (
          id, rule_id, rule_name, violation_type, severity, entity_type,
          entity_id, details, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await client.query(query, [
        violation.id,
        violation.ruleId,
        violation.ruleName,
        violation.violationType,
        violation.severity,
        violation.entityType,
        violation.entityId,
        JSON.stringify(violation.details),
        violation.status,
        violation.createdAt
      ]);

    } catch (error) {
      console.error('Error storing compliance violation:', error);
      // Don't throw - compliance violations should not fail the main operation
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Store audit trail in database
   */
  private async storeAuditTrail(audit: AuditTrail): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        INSERT INTO comprehensive_audit_trail (
          id, entity_type, entity_id, action, performed_by, ip_address,
          user_agent, details, data_changes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await client.query(query, [
        audit.id,
        audit.entityType,
        audit.entityId,
        audit.action,
        audit.performedBy,
        audit.ipAddress,
        audit.userAgent,
        JSON.stringify(audit.details),
        audit.dataChanges ? JSON.stringify(audit.dataChanges) : null,
        audit.timestamp
      ]);

    } catch (error) {
      console.error('Error storing audit trail:', error);
      // Don't throw - audit trails should not fail the main operation
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `SEC_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(): string {
    return `VIO_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `AUD_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Check if IP is blocked
   */
  public isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Check if user is suspended
   */
  public isUserSuspended(userId: string): boolean {
    return this.suspendedUsers.has(userId);
  }

  /**
   * Get all compliance rules
   */
  public getComplianceRules(): ComplianceRule[] {
    return Array.from(this.securityRules.values());
  }

  /**
   * Update compliance rule
   */
  public updateComplianceRule(ruleId: string, updates: Partial<ComplianceRule>): boolean {
    const rule = this.securityRules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates, lastUpdated: new Date() };
    this.securityRules.set(ruleId, updatedRule);
    return true;
  }
}
