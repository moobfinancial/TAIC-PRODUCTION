import { NextRequest, NextResponse } from 'next/server';
import { SecurityComplianceEngine } from '@/lib/security/securityComplianceEngine';
import jwt from 'jsonwebtoken';

const securityEngine = new SecurityComplianceEngine();

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const failedLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const blockedIPs = new Set<string>();

interface SecurityContext {
  ipAddress: string;
  userAgent: string;
  userId?: string;
  userRole?: string;
  path: string;
  method: string;
  timestamp: Date;
}

/**
 * Comprehensive Security Middleware
 * Monitors all requests for security threats and compliance violations
 */
export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  
  public static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Main security middleware function
   */
  public async processRequest(request: NextRequest): Promise<NextResponse | null> {
    const context = this.extractSecurityContext(request);
    
    try {
      // 1. Check if IP is blocked
      if (await this.isIPBlocked(context.ipAddress)) {
        await this.logSecurityEvent(context, 'UNAUTHORIZED_ACCESS', 'HIGH', {
          reason: 'Blocked IP address',
          ipAddress: context.ipAddress
        });
        return new NextResponse('Access Denied', { status: 403 });
      }

      // 2. Rate limiting check
      if (await this.checkRateLimit(context)) {
        await this.logSecurityEvent(context, 'SUSPICIOUS_ACTIVITY', 'MEDIUM', {
          reason: 'Rate limit exceeded',
          path: context.path
        });
        return new NextResponse('Too Many Requests', { status: 429 });
      }

      // 3. Authentication monitoring
      if (this.isAuthenticationEndpoint(context.path)) {
        await this.monitorAuthentication(context, request);
      }

      // 4. Sensitive data access monitoring
      if (this.isSensitiveEndpoint(context.path)) {
        await this.monitorSensitiveAccess(context, request);
      }

      // 5. Admin access monitoring
      if (this.isAdminEndpoint(context.path)) {
        await this.monitorAdminAccess(context, request);
      }

      // 6. Suspicious pattern detection
      await this.detectSuspiciousPatterns(context, request);

      // 7. Log normal access for audit trail
      await this.logAuditTrail(context, request);

      return null; // Continue with normal processing

    } catch (error) {
      console.error('Security middleware error:', error);
      await this.logSecurityEvent(context, 'SYSTEM_BREACH', 'CRITICAL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null; // Continue despite error
    }
  }

  /**
   * Extract security context from request
   */
  private extractSecurityContext(request: NextRequest): SecurityContext {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const path = request.nextUrl.pathname;
    const method = request.method;
    
    // Extract user info from JWT if present
    let userId: string | undefined;
    let userRole: string | undefined;
    
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        userId = decoded.id;
        userRole = decoded.role;
      } catch (error) {
        // Invalid token - will be handled by auth middleware
      }
    }

    return {
      ipAddress,
      userAgent,
      userId,
      userRole,
      path,
      method,
      timestamp: new Date()
    };
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIP) {
      return realIP;
    }
    return '127.0.0.1';
  }

  /**
   * Check if IP is blocked
   */
  private async isIPBlocked(ipAddress: string): Promise<boolean> {
    // Check local blocked IPs
    if (blockedIPs.has(ipAddress)) {
      return true;
    }

    // Check security engine
    return securityEngine.isIPBlocked(ipAddress);
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(context: SecurityContext): Promise<boolean> {
    const key = `${context.ipAddress}:${context.path}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = this.getRateLimitForPath(context.path);

    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }

    current.count++;
    
    if (current.count > maxRequests) {
      return true; // Rate limit exceeded
    }

    return false;
  }

  /**
   * Get rate limit for specific path
   */
  private getRateLimitForPath(path: string): number {
    if (path.includes('/api/auth/')) return 5; // Auth endpoints
    if (path.includes('/api/admin/')) return 20; // Admin endpoints
    if (path.includes('/api/merchant/')) return 50; // Merchant endpoints
    return 100; // Default
  }

  /**
   * Check if path is authentication endpoint
   */
  private isAuthenticationEndpoint(path: string): boolean {
    return path.includes('/api/auth/') || 
           path.includes('/login') || 
           path.includes('/register');
  }

  /**
   * Check if path is sensitive endpoint
   */
  private isSensitiveEndpoint(path: string): boolean {
    return path.includes('/api/merchant/transactions') ||
           path.includes('/api/merchant/payouts') ||
           path.includes('/api/treasury/') ||
           path.includes('/api/admin/');
  }

  /**
   * Check if path is admin endpoint
   */
  private isAdminEndpoint(path: string): boolean {
    return path.includes('/api/admin/') || path.includes('/admin/');
  }

  /**
   * Monitor authentication attempts
   */
  private async monitorAuthentication(context: SecurityContext, request: NextRequest): Promise<void> {
    const key = context.ipAddress;
    
    if (context.method === 'POST') {
      // This is likely a login attempt
      await this.logSecurityEvent(context, 'LOGIN_ATTEMPT', 'LOW', {
        path: context.path,
        userAgent: context.userAgent
      });

      // Check for failed login patterns
      const attempts = failedLoginAttempts.get(key);
      if (attempts && attempts.count >= 5) {
        await this.logSecurityEvent(context, 'SUSPICIOUS_ACTIVITY', 'HIGH', {
          reason: 'Multiple failed login attempts',
          attemptCount: attempts.count,
          timeWindow: '5 minutes'
        });

        // Block IP temporarily
        blockedIPs.add(context.ipAddress);
        setTimeout(() => blockedIPs.delete(context.ipAddress), 24 * 60 * 60 * 1000); // 24 hours
      }
    }
  }

  /**
   * Monitor sensitive data access
   */
  private async monitorSensitiveAccess(context: SecurityContext, request: NextRequest): Promise<void> {
    await this.logSecurityEvent(context, 'DATA_ACCESS', 'MEDIUM', {
      path: context.path,
      method: context.method,
      userId: context.userId,
      userRole: context.userRole,
      dataType: this.classifyDataType(context.path)
    });

    // Evaluate compliance for sensitive data access
    await securityEngine.evaluateCompliance('USER', context.userId || 'anonymous', {
      dataType: 'PERSONAL',
      accessPath: context.path,
      userRole: context.userRole,
      ipAddress: context.ipAddress
    });
  }

  /**
   * Monitor admin access
   */
  private async monitorAdminAccess(context: SecurityContext, request: NextRequest): Promise<void> {
    if (!context.userId || context.userRole !== 'ADMIN') {
      await this.logSecurityEvent(context, 'UNAUTHORIZED_ACCESS', 'CRITICAL', {
        reason: 'Unauthorized admin access attempt',
        path: context.path,
        userId: context.userId,
        userRole: context.userRole
      });
      return;
    }

    await this.logSecurityEvent(context, 'DATA_ACCESS', 'HIGH', {
      reason: 'Admin access',
      path: context.path,
      adminId: context.userId,
      action: `${context.method} ${context.path}`
    });
  }

  /**
   * Detect suspicious patterns
   */
  private async detectSuspiciousPatterns(context: SecurityContext, request: NextRequest): Promise<void> {
    // Check for SQL injection patterns
    const url = request.url;
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(url)) {
        await this.logSecurityEvent(context, 'SUSPICIOUS_ACTIVITY', 'HIGH', {
          reason: 'Potential SQL injection attempt',
          pattern: pattern.toString(),
          url: url
        });
        break;
      }
    }

    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(url)) {
        await this.logSecurityEvent(context, 'SUSPICIOUS_ACTIVITY', 'HIGH', {
          reason: 'Potential XSS attempt',
          pattern: pattern.toString(),
          url: url
        });
        break;
      }
    }

    // Check for unusual user agent
    if (this.isSuspiciousUserAgent(context.userAgent)) {
      await this.logSecurityEvent(context, 'SUSPICIOUS_ACTIVITY', 'MEDIUM', {
        reason: 'Suspicious user agent',
        userAgent: context.userAgent
      });
    }
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ];

    // Allow legitimate bots
    const legitimateBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
      /duckduckbot/i
    ];

    for (const legitimate of legitimateBots) {
      if (legitimate.test(userAgent)) {
        return false;
      }
    }

    for (const suspicious of suspiciousPatterns) {
      if (suspicious.test(userAgent)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Classify data type based on path
   */
  private classifyDataType(path: string): string {
    if (path.includes('/transactions')) return 'FINANCIAL';
    if (path.includes('/users') || path.includes('/profile')) return 'PERSONAL';
    if (path.includes('/auth')) return 'AUTHENTICATION';
    if (path.includes('/admin')) return 'ADMINISTRATIVE';
    return 'OPERATIONAL';
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    context: SecurityContext,
    eventType: string,
    severity: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await securityEngine.processSecurityEvent({
        eventType: eventType as any,
        severity: severity as any,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          ...details,
          path: context.path,
          method: context.method,
          timestamp: context.timestamp.toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log audit trail
   */
  private async logAuditTrail(context: SecurityContext, request: NextRequest): Promise<void> {
    try {
      // Only log significant actions, not every request
      if (this.shouldLogAuditTrail(context)) {
        await securityEngine.createAuditTrail({
          entityType: this.getEntityTypeFromPath(context.path),
          entityId: context.userId || 'anonymous',
          action: `${context.method} ${context.path}`,
          performedBy: context.userId || 'anonymous',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: {
            path: context.path,
            method: context.method,
            userRole: context.userRole
          }
        });
      }
    } catch (error) {
      console.error('Failed to log audit trail:', error);
    }
  }

  /**
   * Determine if request should be logged in audit trail
   */
  private shouldLogAuditTrail(context: SecurityContext): boolean {
    // Log all POST, PUT, DELETE requests
    if (['POST', 'PUT', 'DELETE'].includes(context.method)) {
      return true;
    }

    // Log sensitive GET requests
    if (context.method === 'GET' && this.isSensitiveEndpoint(context.path)) {
      return true;
    }

    return false;
  }

  /**
   * Get entity type from path
   */
  private getEntityTypeFromPath(path: string): 'USER' | 'TRANSACTION' | 'SYSTEM' | 'ADMIN' | 'MERCHANT' {
    if (path.includes('/admin/')) return 'ADMIN';
    if (path.includes('/merchant/')) return 'MERCHANT';
    if (path.includes('/transaction')) return 'TRANSACTION';
    if (path.includes('/user')) return 'USER';
    return 'SYSTEM';
  }

  /**
   * Record failed login attempt
   */
  public recordFailedLogin(ipAddress: string): void {
    const key = ipAddress;
    const now = Date.now();
    const current = failedLoginAttempts.get(key);

    if (!current || now - current.lastAttempt > 5 * 60 * 1000) { // 5 minute window
      failedLoginAttempts.set(key, { count: 1, lastAttempt: now });
    } else {
      current.count++;
      current.lastAttempt = now;
    }
  }

  /**
   * Clear failed login attempts for IP
   */
  public clearFailedLogins(ipAddress: string): void {
    failedLoginAttempts.delete(ipAddress);
  }
}

// Export singleton instance
export const securityMiddleware = SecurityMiddleware.getInstance();
