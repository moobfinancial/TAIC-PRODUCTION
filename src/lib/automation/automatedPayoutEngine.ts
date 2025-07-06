import { Pool, PoolClient } from 'pg';
import { TreasuryWalletSystem } from '../treasury/treasuryWalletSystem';
import { CryptoWalletService } from '../crypto/walletService';
import { NetworkType } from '../crypto/walletUtils';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export interface PayoutScheduleConfig {
  merchantId: string;
  scheduleType: 'FIXED' | 'THRESHOLD' | 'HYBRID' | 'REAL_TIME';
  frequency: PayoutFrequency;
  minimumThreshold: number;
  maximumThreshold: number;
  businessDaysOnly: boolean;
  timeZone: string;
  preferredTime: string; // HH:MM format
  blackoutDates: Date[];
  emergencyOverride: boolean;
  automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL_REVIEW';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutFrequency {
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'THRESHOLD_BASED' | 'REAL_TIME';
  interval: number; // e.g., every 2 weeks
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  thresholdAmount?: number; // for threshold-based
  maxDailyPayouts?: number; // limit for real-time
}

export interface MerchantRiskScore {
  merchantId: string;
  overallScore: number; // 0-100 (lower is better)
  factors: {
    transactionHistory: number; // 0-25
    chargebackRate: number; // 0-25
    accountAge: number; // 0-15
    verificationLevel: number; // 0-15
    recentActivity: number; // 0-20
  };
  automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL_REVIEW';
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
  requiresApprovalAbove: number;
  lastUpdated: Date;
}

export interface AutomatedPayoutRequest {
  id: string;
  merchantId: string;
  originalPayoutRequestId?: number;
  amount: number;
  currency: string;
  destinationWallet: string;
  destinationNetwork: NetworkType;
  scheduleType: 'SCHEDULED' | 'THRESHOLD_TRIGGERED' | 'REAL_TIME' | 'MANUAL_OVERRIDE';
  scheduledFor: Date;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  riskScore: number;
  automationDecision: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'AUTO_REJECT';
  processingAttempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  executedAt?: Date;
  transactionHash?: string;
  failureReason?: string;
  treasuryTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

export interface BatchProcessingConfig {
  maxBatchSize: number;
  optimalBatchSize: number;
  gasOptimization: boolean;
  networkSelection: 'OPTIMAL' | 'CHEAPEST' | 'FASTEST' | 'SPECIFIED';
  preferredNetwork?: NetworkType;
  maxProcessingTime: number; // seconds
  retryConfig: RetryConfig;
  emergencyHalt: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ProcessingQueue {
  id: string;
  queueType: 'SCHEDULED' | 'THRESHOLD' | 'REAL_TIME' | 'MANUAL' | 'EMERGENCY';
  priority: number; // 1-100 (higher is more urgent)
  payoutRequests: AutomatedPayoutRequest[];
  estimatedProcessingTime: number;
  scheduledFor: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationMetrics {
  totalProcessed: number;
  successfulPayouts: number;
  failedPayouts: number;
  averageProcessingTime: number;
  totalVolume: number;
  automationRate: number; // percentage of payouts processed automatically
  errorRate: number;
  costSavings: number;
  lastUpdated: Date;
}

/**
 * Advanced Automated Payout Processing Engine
 * Integrates with Treasury System and Crypto Wallet Service for intelligent payout automation
 */
export class AutomatedPayoutEngine {
  private treasurySystem: TreasuryWalletSystem;
  private cryptoWalletService: CryptoWalletService;
  private processingQueues: Map<string, ProcessingQueue> = new Map();
  private merchantRiskScores: Map<string, MerchantRiskScore> = new Map();
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private emergencyHalt: boolean = false;

  constructor(treasurySystem: TreasuryWalletSystem, cryptoWalletService: CryptoWalletService) {
    this.treasurySystem = treasurySystem;
    this.cryptoWalletService = cryptoWalletService;
    this.initializeEngine();
  }

  /**
   * Initialize the automation engine
   */
  private async initializeEngine(): Promise<void> {
    console.log('Initializing Automated Payout Engine...');

    // Load merchant risk scores
    await this.loadMerchantRiskScores();

    // Start processing scheduler
    this.startProcessingScheduler();

    console.log('Automated Payout Engine initialized successfully');
  }

  /**
   * Start the processing scheduler (runs every minute)
   */
  private startProcessingScheduler(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && !this.emergencyHalt) {
        await this.processScheduledPayouts();
      }
    }, 60000); // Run every minute

    console.log('Payout processing scheduler started');
  }

  /**
   * Stop the processing scheduler
   */
  public stopProcessingScheduler(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('Payout processing scheduler stopped');
  }

  /**
   * Emergency halt all automated processing
   */
  public emergencyHaltProcessing(reason: string): void {
    this.emergencyHalt = true;
    this.isProcessing = false;
    console.log(`Emergency halt activated: ${reason}`);

    // Log emergency halt
    this.logAutomationEvent('EMERGENCY_HALT', 'SYSTEM', {
      reason,
      timestamp: new Date(),
      activeQueues: this.processingQueues.size
    });
  }

  /**
   * Resume automated processing after emergency halt
   */
  public resumeProcessing(authorizedBy: string): void {
    this.emergencyHalt = false;
    console.log(`Automated processing resumed by: ${authorizedBy}`);

    // Log resumption
    this.logAutomationEvent('PROCESSING_RESUMED', authorizedBy, {
      timestamp: new Date()
    });
  }

  /**
   * Load merchant risk scores from database
   */
  private async loadMerchantRiskScores(): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        SELECT
          merchant_id,
          overall_score,
          transaction_history_score,
          chargeback_rate_score,
          account_age_score,
          verification_level_score,
          recent_activity_score,
          automation_level,
          daily_limit,
          weekly_limit,
          monthly_limit,
          single_transaction_limit,
          requires_approval_above,
          last_updated
        FROM merchant_risk_scores
        WHERE is_active = true
      `;

      const result = await client.query(query);

      for (const row of result.rows) {
        const riskScore: MerchantRiskScore = {
          merchantId: row.merchant_id,
          overallScore: row.overall_score,
          factors: {
            transactionHistory: row.transaction_history_score,
            chargebackRate: row.chargeback_rate_score,
            accountAge: row.account_age_score,
            verificationLevel: row.verification_level_score,
            recentActivity: row.recent_activity_score
          },
          automationLevel: row.automation_level,
          dailyLimit: parseFloat(row.daily_limit),
          weeklyLimit: parseFloat(row.weekly_limit),
          monthlyLimit: parseFloat(row.monthly_limit),
          singleTransactionLimit: parseFloat(row.single_transaction_limit),
          requiresApprovalAbove: parseFloat(row.requires_approval_above),
          lastUpdated: new Date(row.last_updated)
        };

        this.merchantRiskScores.set(row.merchant_id, riskScore);
      }

      console.log(`Loaded risk scores for ${result.rows.length} merchants`);

    } catch (error) {
      console.error('Error loading merchant risk scores:', error);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Calculate merchant risk score
   */
  public async calculateMerchantRiskScore(merchantId: string): Promise<MerchantRiskScore> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      // Get merchant data for risk calculation
      const merchantQuery = `
        SELECT
          u.id,
          u.created_at,
          u.email_verified,
          u.phone_verified,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
          COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders,
          COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled_orders,
          COUNT(DISTINCT mpr.id) as total_payouts,
          COALESCE(SUM(mpr.requested_amount), 0) as total_payout_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.merchant_id
        LEFT JOIN merchant_payout_requests mpr ON u.id = mpr.merchant_id
        WHERE u.id = $1 AND u.role = 'MERCHANT'
        GROUP BY u.id, u.created_at, u.email_verified, u.phone_verified
      `;

      const merchantResult = await client.query(merchantQuery, [merchantId]);

      if (merchantResult.rows.length === 0) {
        throw new Error('Merchant not found');
      }

      const merchant = merchantResult.rows[0];

      // Calculate risk factors
      const factors = {
        transactionHistory: this.calculateTransactionHistoryScore(merchant),
        chargebackRate: this.calculateChargebackScore(merchant),
        accountAge: this.calculateAccountAgeScore(merchant.created_at),
        verificationLevel: this.calculateVerificationScore(merchant),
        recentActivity: this.calculateRecentActivityScore(merchant)
      };

      const overallScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

      // Determine automation level based on overall score
      let automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL_REVIEW';
      if (overallScore <= 30) {
        automationLevel = 'FULL';
      } else if (overallScore <= 60) {
        automationLevel = 'PARTIAL';
      } else {
        automationLevel = 'MANUAL_REVIEW';
      }

      // Set limits based on automation level and risk score
      const limits = this.calculateAutomationLimits(automationLevel, overallScore);

      const riskScore: MerchantRiskScore = {
        merchantId,
        overallScore,
        factors,
        automationLevel,
        dailyLimit: limits.daily,
        weeklyLimit: limits.weekly,
        monthlyLimit: limits.monthly,
        singleTransactionLimit: limits.single,
        requiresApprovalAbove: limits.approval,
        lastUpdated: new Date()
      };

      // Store in database
      await this.storeMerchantRiskScore(riskScore);

      // Cache in memory
      this.merchantRiskScores.set(merchantId, riskScore);

      return riskScore;

    } catch (error) {
      console.error('Error calculating merchant risk score:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Calculate transaction history score (0-25, lower is better)
   */
  private calculateTransactionHistoryScore(merchant: any): number {
    const totalOrders = parseInt(merchant.total_orders) || 0;
    const totalRevenue = parseFloat(merchant.total_revenue) || 0;
    const cancelledOrders = parseInt(merchant.cancelled_orders) || 0;

    let score = 25; // Start with highest risk

    // Reduce risk based on order volume
    if (totalOrders >= 100) score -= 10;
    else if (totalOrders >= 50) score -= 7;
    else if (totalOrders >= 20) score -= 5;
    else if (totalOrders >= 10) score -= 3;

    // Reduce risk based on revenue
    if (totalRevenue >= 50000) score -= 8;
    else if (totalRevenue >= 20000) score -= 6;
    else if (totalRevenue >= 10000) score -= 4;
    else if (totalRevenue >= 5000) score -= 2;

    // Increase risk based on cancellation rate
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;
    if (cancellationRate > 0.2) score += 5;
    else if (cancellationRate > 0.1) score += 3;
    else if (cancellationRate > 0.05) score += 1;

    return Math.max(0, Math.min(25, score));
  }

  /**
   * Calculate chargeback score (0-25, lower is better)
   */
  private calculateChargebackScore(merchant: any): number {
    // For now, return a base score - in production would check actual chargeback data
    const totalOrders = parseInt(merchant.total_orders) || 0;

    if (totalOrders >= 100) return 2; // Established merchants with low assumed chargeback rate
    if (totalOrders >= 50) return 5;
    if (totalOrders >= 20) return 8;
    if (totalOrders >= 10) return 12;
    return 15; // New merchants have higher assumed risk
  }

  /**
   * Calculate account age score (0-15, lower is better)
   */
  private calculateAccountAgeScore(createdAt: Date): number {
    const accountAge = Date.now() - new Date(createdAt).getTime();
    const ageInDays = accountAge / (1000 * 60 * 60 * 24);

    if (ageInDays >= 365) return 0; // 1+ years
    if (ageInDays >= 180) return 2; // 6+ months
    if (ageInDays >= 90) return 5;  // 3+ months
    if (ageInDays >= 30) return 8;  // 1+ month
    if (ageInDays >= 7) return 12;  // 1+ week
    return 15; // Less than a week
  }

  /**
   * Calculate verification score (0-15, lower is better)
   */
  private calculateVerificationScore(merchant: any): number {
    let score = 15; // Start with highest risk

    if (merchant.email_verified) score -= 7;
    if (merchant.phone_verified) score -= 8;

    return Math.max(0, score);
  }

  /**
   * Calculate recent activity score (0-20, lower is better)
   */
  private calculateRecentActivityScore(merchant: any): number {
    const recentOrders = parseInt(merchant.recent_orders) || 0;

    if (recentOrders >= 20) return 0;
    if (recentOrders >= 10) return 3;
    if (recentOrders >= 5) return 7;
    if (recentOrders >= 2) return 12;
    if (recentOrders >= 1) return 16;
    return 20; // No recent activity
  }

  /**
   * Calculate automation limits based on risk level
   */
  private calculateAutomationLimits(automationLevel: string, riskScore: number): any {
    const baseLimits = {
      FULL: { daily: 10000, weekly: 50000, monthly: 200000, single: 5000, approval: 10000 },
      PARTIAL: { daily: 5000, weekly: 25000, monthly: 100000, single: 2500, approval: 5000 },
      MANUAL_REVIEW: { daily: 1000, weekly: 5000, monthly: 20000, single: 500, approval: 1000 }
    };

    const limits = baseLimits[automationLevel as keyof typeof baseLimits];

    // Adjust limits based on risk score
    const riskMultiplier = Math.max(0.1, 1 - (riskScore / 100));

    return {
      daily: Math.floor(limits.daily * riskMultiplier),
      weekly: Math.floor(limits.weekly * riskMultiplier),
      monthly: Math.floor(limits.monthly * riskMultiplier),
      single: Math.floor(limits.single * riskMultiplier),
      approval: Math.floor(limits.approval * riskMultiplier)
    };
  }

  /**
   * Store merchant risk score in database
   */
  private async storeMerchantRiskScore(riskScore: MerchantRiskScore): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        INSERT INTO merchant_risk_scores (
          merchant_id, overall_score, transaction_history_score, chargeback_rate_score,
          account_age_score, verification_level_score, recent_activity_score,
          automation_level, daily_limit, weekly_limit, monthly_limit,
          single_transaction_limit, requires_approval_above, last_updated, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), true)
        ON CONFLICT (merchant_id) DO UPDATE SET
          overall_score = EXCLUDED.overall_score,
          transaction_history_score = EXCLUDED.transaction_history_score,
          chargeback_rate_score = EXCLUDED.chargeback_rate_score,
          account_age_score = EXCLUDED.account_age_score,
          verification_level_score = EXCLUDED.verification_level_score,
          recent_activity_score = EXCLUDED.recent_activity_score,
          automation_level = EXCLUDED.automation_level,
          daily_limit = EXCLUDED.daily_limit,
          weekly_limit = EXCLUDED.weekly_limit,
          monthly_limit = EXCLUDED.monthly_limit,
          single_transaction_limit = EXCLUDED.single_transaction_limit,
          requires_approval_above = EXCLUDED.requires_approval_above,
          last_updated = NOW()
      `;

      await client.query(query, [
        riskScore.merchantId,
        riskScore.overallScore,
        riskScore.factors.transactionHistory,
        riskScore.factors.chargebackRate,
        riskScore.factors.accountAge,
        riskScore.factors.verificationLevel,
        riskScore.factors.recentActivity,
        riskScore.automationLevel,
        riskScore.dailyLimit,
        riskScore.weeklyLimit,
        riskScore.monthlyLimit,
        riskScore.singleTransactionLimit,
        riskScore.requiresApprovalAbove
      ]);

    } catch (error) {
      console.error('Error storing merchant risk score:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Create automated payout request
   */
  public async createAutomatedPayoutRequest(
    merchantId: string,
    amount: number,
    currency: string,
    destinationWallet: string,
    destinationNetwork: NetworkType,
    scheduleType: 'SCHEDULED' | 'THRESHOLD_TRIGGERED' | 'REAL_TIME' | 'MANUAL_OVERRIDE',
    scheduledFor?: Date,
    originalPayoutRequestId?: number,
    metadata?: any
  ): Promise<AutomatedPayoutRequest> {

    // Get or calculate merchant risk score
    let riskScore = this.merchantRiskScores.get(merchantId);
    if (!riskScore) {
      riskScore = await this.calculateMerchantRiskScore(merchantId);
    }

    // Calculate request risk score
    const requestRiskScore = await this.calculateRequestRiskScore(merchantId, amount, destinationWallet);

    // Determine automation decision
    const automationDecision = this.determineAutomationDecision(riskScore, amount, requestRiskScore);

    // Calculate priority
    const priority = this.calculatePriority(scheduleType, amount, riskScore.automationLevel);

    const payoutRequest: AutomatedPayoutRequest = {
      id: `auto_payout_${merchantId}_${Date.now()}`,
      merchantId,
      originalPayoutRequestId,
      amount,
      currency,
      destinationWallet,
      destinationNetwork,
      scheduleType,
      scheduledFor: scheduledFor || new Date(),
      priority,
      status: 'PENDING',
      riskScore: requestRiskScore,
      automationDecision,
      processingAttempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata
    };

    // Store in database
    await this.storeAutomatedPayoutRequest(payoutRequest);

    // Add to appropriate processing queue
    await this.addToProcessingQueue(payoutRequest);

    return payoutRequest;
  }

  /**
   * Calculate request-specific risk score
   */
  private async calculateRequestRiskScore(
    merchantId: string,
    amount: number,
    destinationWallet: string
  ): Promise<number> {
    let riskScore = 0;

    // Amount-based risk
    if (amount > 50000) riskScore += 30;
    else if (amount > 20000) riskScore += 20;
    else if (amount > 10000) riskScore += 15;
    else if (amount > 5000) riskScore += 10;
    else if (amount > 1000) riskScore += 5;

    // Check if destination wallet is new/suspicious
    const walletRisk = await this.checkWalletRisk(destinationWallet);
    riskScore += walletRisk;

    // Check recent payout frequency
    const frequencyRisk = await this.checkPayoutFrequency(merchantId);
    riskScore += frequencyRisk;

    return Math.min(100, riskScore);
  }

  /**
   * Check wallet risk factors
   */
  private async checkWalletRisk(walletAddress: string): Promise<number> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      // Check if wallet has been used before
      const walletQuery = `
        SELECT COUNT(*) as usage_count,
               MIN(created_at) as first_used
        FROM merchant_payout_requests
        WHERE destination_wallet = $1 AND status = 'COMPLETED'
      `;

      const result = await client.query(walletQuery, [walletAddress]);
      const usageCount = parseInt(result.rows[0].usage_count);

      if (usageCount === 0) return 20; // New wallet
      if (usageCount < 3) return 10; // Rarely used
      if (usageCount < 10) return 5; // Occasionally used
      return 0; // Frequently used, low risk

    } catch (error) {
      console.error('Error checking wallet risk:', error);
      return 15; // Default to moderate risk on error
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Check payout frequency risk
   */
  private async checkPayoutFrequency(merchantId: string): Promise<number> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      // Check recent payout frequency
      const frequencyQuery = `
        SELECT COUNT(*) as recent_payouts
        FROM merchant_payout_requests
        WHERE merchant_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED')
      `;

      const result = await client.query(frequencyQuery, [merchantId]);
      const recentPayouts = parseInt(result.rows[0].recent_payouts);

      if (recentPayouts > 5) return 25; // Very frequent
      if (recentPayouts > 3) return 15; // Frequent
      if (recentPayouts > 1) return 5; // Moderate
      return 0; // Normal frequency

    } catch (error) {
      console.error('Error checking payout frequency:', error);
      return 10; // Default to moderate risk on error
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Determine automation decision based on risk factors
   */
  private determineAutomationDecision(
    merchantRisk: MerchantRiskScore,
    amount: number,
    requestRisk: number
  ): 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'AUTO_REJECT' {

    // Auto-reject if amount exceeds limits
    if (amount > merchantRisk.singleTransactionLimit) {
      return 'AUTO_REJECT';
    }

    // Auto-reject if request risk is too high
    if (requestRisk > 80) {
      return 'AUTO_REJECT';
    }

    // Manual review if amount requires approval
    if (amount > merchantRisk.requiresApprovalAbove) {
      return 'MANUAL_REVIEW';
    }

    // Manual review if merchant automation level requires it
    if (merchantRisk.automationLevel === 'MANUAL_REVIEW') {
      return 'MANUAL_REVIEW';
    }

    // Manual review if combined risk is high
    const combinedRisk = (merchantRisk.overallScore + requestRisk) / 2;
    if (combinedRisk > 70) {
      return 'MANUAL_REVIEW';
    }

    // Partial automation - manual review for higher amounts
    if (merchantRisk.automationLevel === 'PARTIAL' && amount > 2500) {
      return 'MANUAL_REVIEW';
    }

    return 'AUTO_APPROVE';
  }

  /**
   * Calculate priority based on various factors
   */
  private calculatePriority(
    scheduleType: string,
    amount: number,
    automationLevel: string
  ): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {

    if (scheduleType === 'REAL_TIME') return 'URGENT';
    if (scheduleType === 'MANUAL_OVERRIDE') return 'HIGH';

    if (amount > 20000) return 'HIGH';
    if (amount > 10000) return 'NORMAL';

    if (automationLevel === 'FULL') return 'NORMAL';

    return 'LOW';
  }

  /**
   * Store automated payout request in database
   */
  private async storeAutomatedPayoutRequest(request: AutomatedPayoutRequest): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        INSERT INTO automated_payout_requests (
          id, merchant_id, original_payout_request_id, amount, currency,
          destination_wallet, destination_network, schedule_type, scheduled_for,
          priority, status, risk_score, automation_decision, processing_attempts,
          max_attempts, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      `;

      await client.query(query, [
        request.id,
        request.merchantId,
        request.originalPayoutRequestId,
        request.amount,
        request.currency,
        request.destinationWallet,
        request.destinationNetwork,
        request.scheduleType,
        request.scheduledFor,
        request.priority,
        request.status,
        request.riskScore,
        request.automationDecision,
        request.processingAttempts,
        request.maxAttempts,
        JSON.stringify(request.metadata || {})
      ]);

    } catch (error) {
      console.error('Error storing automated payout request:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Add payout request to appropriate processing queue
   */
  private async addToProcessingQueue(request: AutomatedPayoutRequest): Promise<void> {
    const queueType = this.determineQueueType(request);
    const queueId = `${queueType}_${new Date().toISOString().split('T')[0]}`;

    let queue = this.processingQueues.get(queueId);

    if (!queue) {
      queue = {
        id: queueId,
        queueType,
        priority: this.getQueuePriority(queueType),
        payoutRequests: [],
        estimatedProcessingTime: 0,
        scheduledFor: request.scheduledFor,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.processingQueues.set(queueId, queue);
    }

    queue.payoutRequests.push(request);
    queue.estimatedProcessingTime = this.calculateEstimatedProcessingTime(queue.payoutRequests);
    queue.updatedAt = new Date();

    // Sort requests by priority within the queue
    queue.payoutRequests.sort((a, b) => {
      const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'NORMAL': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Determine queue type for payout request
   */
  private determineQueueType(request: AutomatedPayoutRequest): ProcessingQueue['queueType'] {
    if (request.scheduleType === 'REAL_TIME') return 'REAL_TIME';
    if (request.scheduleType === 'THRESHOLD_TRIGGERED') return 'THRESHOLD';
    if (request.scheduleType === 'MANUAL_OVERRIDE') return 'MANUAL';
    return 'SCHEDULED';
  }

  /**
   * Get queue priority (higher number = higher priority)
   */
  private getQueuePriority(queueType: ProcessingQueue['queueType']): number {
    const priorities = {
      'EMERGENCY': 100,
      'REAL_TIME': 80,
      'MANUAL': 60,
      'THRESHOLD': 40,
      'SCHEDULED': 20
    };
    return priorities[queueType] || 10;
  }

  /**
   * Calculate estimated processing time for queue
   */
  private calculateEstimatedProcessingTime(requests: AutomatedPayoutRequest[]): number {
    // Base time per request (in seconds)
    const baseTimePerRequest = 30;

    // Additional time for manual review requests
    const manualReviewTime = requests.filter(r => r.automationDecision === 'MANUAL_REVIEW').length * 300;

    // Additional time for high-risk requests
    const highRiskTime = requests.filter(r => r.riskScore > 70).length * 60;

    return (requests.length * baseTimePerRequest) + manualReviewTime + highRiskTime;
  }

  /**
   * Process scheduled payouts (main processing loop)
   */
  private async processScheduledPayouts(): Promise<void> {
    if (this.isProcessing || this.emergencyHalt) {
      return;
    }

    this.isProcessing = true;

    try {
      console.log('Starting scheduled payout processing...');

      // Get all pending queues sorted by priority
      const sortedQueues = Array.from(this.processingQueues.values())
        .filter(queue => queue.status === 'PENDING' && queue.scheduledFor <= new Date())
        .sort((a, b) => b.priority - a.priority);

      for (const queue of sortedQueues) {
        if (this.emergencyHalt) break;

        await this.processQueue(queue);
      }

      // Clean up completed queues
      this.cleanupCompletedQueues();

      console.log('Scheduled payout processing completed');

    } catch (error) {
      console.error('Error in scheduled payout processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a specific queue
   */
  private async processQueue(queue: ProcessingQueue): Promise<void> {
    console.log(`Processing queue: ${queue.id} with ${queue.payoutRequests.length} requests`);

    queue.status = 'PROCESSING';
    queue.updatedAt = new Date();

    const batchConfig: BatchProcessingConfig = {
      maxBatchSize: 50,
      optimalBatchSize: 20,
      gasOptimization: true,
      networkSelection: 'OPTIMAL',
      maxProcessingTime: 300, // 5 minutes
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['NETWORK_ERROR', 'INSUFFICIENT_BALANCE', 'GAS_ESTIMATION_FAILED']
      },
      emergencyHalt: false
    };

    try {
      // Group requests by automation decision
      const autoApproveRequests = queue.payoutRequests.filter(r => r.automationDecision === 'AUTO_APPROVE');
      const manualReviewRequests = queue.payoutRequests.filter(r => r.automationDecision === 'MANUAL_REVIEW');
      const autoRejectRequests = queue.payoutRequests.filter(r => r.automationDecision === 'AUTO_REJECT');

      // Process auto-reject requests first (quick)
      for (const request of autoRejectRequests) {
        await this.rejectPayoutRequest(request, 'Automatically rejected due to risk assessment');
      }

      // Process auto-approve requests in batches
      if (autoApproveRequests.length > 0) {
        await this.processBatchPayouts(autoApproveRequests, batchConfig);
      }

      // Flag manual review requests for admin attention
      for (const request of manualReviewRequests) {
        await this.flagForManualReview(request);
      }

      queue.status = 'COMPLETED';

    } catch (error) {
      console.error(`Error processing queue ${queue.id}:`, error);
      queue.status = 'FAILED';

      // Mark all requests in queue as failed
      for (const request of queue.payoutRequests) {
        if (request.status === 'PROCESSING') {
          request.status = 'FAILED';
          request.failureReason = error instanceof Error ? error.message : 'Unknown error';
          await this.updatePayoutRequestStatus(request);
        }
      }
    }

    queue.updatedAt = new Date();
  }

  /**
   * Process batch payouts with optimization
   */
  private async processBatchPayouts(
    requests: AutomatedPayoutRequest[],
    config: BatchProcessingConfig
  ): Promise<void> {

    // Group by network for optimal batch processing
    const networkGroups = this.groupRequestsByNetwork(requests);

    for (const [network, networkRequests] of networkGroups) {
      if (this.emergencyHalt) break;

      // Process in optimal batch sizes
      const batches = this.createOptimalBatches(networkRequests, config.optimalBatchSize);

      for (const batch of batches) {
        if (this.emergencyHalt) break;

        await this.processSingleBatch(batch, network, config);
      }
    }
  }

  /**
   * Group requests by network for efficient processing
   */
  private groupRequestsByNetwork(requests: AutomatedPayoutRequest[]): Map<NetworkType, AutomatedPayoutRequest[]> {
    const groups = new Map<NetworkType, AutomatedPayoutRequest[]>();

    for (const request of requests) {
      const existing = groups.get(request.destinationNetwork) || [];
      existing.push(request);
      groups.set(request.destinationNetwork, existing);
    }

    return groups;
  }

  /**
   * Create optimal batches for processing
   */
  private createOptimalBatches(requests: AutomatedPayoutRequest[], batchSize: number): AutomatedPayoutRequest[][] {
    const batches: AutomatedPayoutRequest[][] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a single batch of payout requests
   */
  private async processSingleBatch(
    batch: AutomatedPayoutRequest[],
    network: NetworkType,
    config: BatchProcessingConfig
  ): Promise<void> {

    console.log(`Processing batch of ${batch.length} payouts on ${network}`);

    // Mark all requests as processing
    for (const request of batch) {
      request.status = 'PROCESSING';
      request.processingAttempts++;
      request.lastAttemptAt = new Date();
      await this.updatePayoutRequestStatus(request);
    }

    try {
      // Get appropriate treasury wallet for this network
      const treasuryWallet = await this.getTreasuryWalletForNetwork(network);

      if (!treasuryWallet) {
        throw new Error(`No treasury wallet available for network: ${network}`);
      }

      // Create multi-signature transactions for each payout
      const treasuryTransactions = [];

      for (const request of batch) {
        try {
          const treasuryTx = await this.treasurySystem.createMultiSigTransaction(
            treasuryWallet.id,
            'PAYOUT',
            request.destinationWallet,
            request.amount.toString(),
            request.currency,
            `Automated payout for merchant ${request.merchantId} - Request ${request.id}`,
            'AUTOMATION_ENGINE',
            {
              automatedPayoutRequestId: request.id,
              merchantId: request.merchantId,
              batchId: `batch_${Date.now()}`,
              automationLevel: 'FULL'
            }
          );

          request.treasuryTransactionId = treasuryTx.id;
          treasuryTransactions.push(treasuryTx);

        } catch (error) {
          console.error(`Failed to create treasury transaction for request ${request.id}:`, error);
          request.status = 'FAILED';
          request.failureReason = error instanceof Error ? error.message : 'Treasury transaction creation failed';
          await this.updatePayoutRequestStatus(request);
        }
      }

      // Auto-sign treasury transactions if configured for automation
      for (const treasuryTx of treasuryTransactions) {
        await this.autoSignTreasuryTransaction(treasuryTx);
      }

      // Execute fully signed transactions
      for (const treasuryTx of treasuryTransactions) {
        if (treasuryTx.status === 'FULLY_SIGNED') {
          try {
            const executedTx = await this.treasurySystem.executeMultiSigTransaction(
              treasuryTx.id,
              'AUTOMATION_ENGINE'
            );

            // Update corresponding payout request
            const request = batch.find(r => r.treasuryTransactionId === treasuryTx.id);
            if (request) {
              request.status = 'EXECUTED';
              request.executedAt = new Date();
              request.transactionHash = executedTx.transactionHash;
              await this.updatePayoutRequestStatus(request);

              // Update original payout request if exists
              if (request.originalPayoutRequestId) {
                await this.updateOriginalPayoutRequest(request);
              }
            }

          } catch (error) {
            console.error(`Failed to execute treasury transaction ${treasuryTx.id}:`, error);
            const request = batch.find(r => r.treasuryTransactionId === treasuryTx.id);
            if (request) {
              request.status = 'FAILED';
              request.failureReason = error instanceof Error ? error.message : 'Treasury execution failed';
              await this.updatePayoutRequestStatus(request);
            }
          }
        }
      }

    } catch (error) {
      console.error(`Batch processing failed for ${network}:`, error);

      // Mark all requests in batch as failed
      for (const request of batch) {
        if (request.status === 'PROCESSING') {
          request.status = 'FAILED';
          request.failureReason = error instanceof Error ? error.message : 'Batch processing failed';
          await this.updatePayoutRequestStatus(request);
        }
      }
    }
  }

  /**
   * Get treasury wallet for specific network
   */
  private async getTreasuryWalletForNetwork(network: NetworkType): Promise<any> {
    // In production, this would query the treasury system for appropriate wallet
    // For now, return a mock treasury wallet
    return {
      id: `treasury_payout_reserve_${network.toLowerCase()}`,
      walletType: 'PAYOUT_RESERVE',
      network,
      status: 'ACTIVE'
    };
  }

  /**
   * Auto-sign treasury transaction for automation
   */
  private async autoSignTreasuryTransaction(treasuryTx: any): Promise<void> {
    // In production, this would use automated signing with HSM or secure key management
    // For now, we'll simulate the signing process
    console.log(`Auto-signing treasury transaction: ${treasuryTx.id}`);

    // Simulate signing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mark as fully signed for automation
    treasuryTx.status = 'FULLY_SIGNED';
    treasuryTx.currentSignatures = treasuryTx.requiredSignatures;
  }

  /**
   * Update payout request status in database
   */
  private async updatePayoutRequestStatus(request: AutomatedPayoutRequest): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const query = `
        UPDATE automated_payout_requests
        SET
          status = $1,
          processing_attempts = $2,
          last_attempt_at = $3,
          executed_at = $4,
          transaction_hash = $5,
          failure_reason = $6,
          treasury_transaction_id = $7,
          updated_at = NOW()
        WHERE id = $8
      `;

      await client.query(query, [
        request.status,
        request.processingAttempts,
        request.lastAttemptAt,
        request.executedAt,
        request.transactionHash,
        request.failureReason,
        request.treasuryTransactionId,
        request.id
      ]);

    } catch (error) {
      console.error('Error updating payout request status:', error);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Update original payout request when automated request is completed
   */
  private async updateOriginalPayoutRequest(request: AutomatedPayoutRequest): Promise<void> {
    if (!request.originalPayoutRequestId) return;

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const status = request.status === 'EXECUTED' ? 'COMPLETED' : 'FAILED';

      const query = `
        UPDATE merchant_payout_requests
        SET
          status = $1,
          processed_at = $2,
          completed_at = $3,
          transaction_hash = $4,
          admin_notes = $5,
          updated_at = NOW()
        WHERE id = $6
      `;

      await client.query(query, [
        status,
        request.lastAttemptAt,
        request.executedAt,
        request.transactionHash,
        `Processed automatically by automation engine - ${request.id}`,
        request.originalPayoutRequestId
      ]);

      // Create transaction record
      if (request.status === 'EXECUTED') {
        await client.query(`
          INSERT INTO merchant_transactions (
            merchant_id, transaction_type, amount, currency, status, description,
            reference_id, created_at
          ) VALUES ($1, 'PAYOUT', $2, $3, 'COMPLETED', $4, $5, NOW())
        `, [
          request.merchantId,
          -request.amount, // Negative for outgoing payout
          request.currency,
          `Automated payout completed - ${request.transactionHash}`,
          `automated_payout_${request.id}`
        ]);
      }

    } catch (error) {
      console.error('Error updating original payout request:', error);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Reject payout request
   */
  private async rejectPayoutRequest(request: AutomatedPayoutRequest, reason: string): Promise<void> {
    request.status = 'CANCELLED';
    request.failureReason = reason;
    request.updatedAt = new Date();

    await this.updatePayoutRequestStatus(request);

    // Update original payout request if exists
    if (request.originalPayoutRequestId) {
      let client: PoolClient | undefined;
      try {
        client = await pool.connect();

        await client.query(`
          UPDATE merchant_payout_requests
          SET
            status = 'REJECTED',
            rejection_reason = $1,
            admin_notes = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [
          reason,
          `Automatically rejected by automation engine: ${reason}`,
          request.originalPayoutRequestId
        ]);

      } catch (error) {
        console.error('Error rejecting original payout request:', error);
      } finally {
        if (client) client.release();
      }
    }
  }

  /**
   * Flag request for manual review
   */
  private async flagForManualReview(request: AutomatedPayoutRequest): Promise<void> {
    request.status = 'PENDING';
    request.updatedAt = new Date();

    await this.updatePayoutRequestStatus(request);

    // Create admin notification for manual review
    await this.createAdminNotification(request);
  }

  /**
   * Create admin notification for manual review
   */
  private async createAdminNotification(request: AutomatedPayoutRequest): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      await client.query(`
        INSERT INTO admin_notifications (
          type, title, message, priority, data, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        'PAYOUT_MANUAL_REVIEW',
        'Automated Payout Requires Manual Review',
        `Payout request ${request.id} for merchant ${request.merchantId} requires manual review. Amount: ${request.amount} ${request.currency}. Risk Score: ${request.riskScore}`,
        request.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
        JSON.stringify({
          automatedPayoutRequestId: request.id,
          merchantId: request.merchantId,
          amount: request.amount,
          riskScore: request.riskScore,
          automationDecision: request.automationDecision
        })
      ]);

    } catch (error) {
      console.error('Error creating admin notification:', error);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Clean up completed queues
   */
  private cleanupCompletedQueues(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [queueId, queue] of this.processingQueues) {
      if (queue.status === 'COMPLETED' && queue.updatedAt < cutoffTime) {
        this.processingQueues.delete(queueId);
      }
    }
  }

  /**
   * Log automation events for audit trail
   */
  private async logAutomationEvent(
    eventType: string,
    performedBy: string,
    details: any
  ): Promise<void> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      await client.query(`
        INSERT INTO automation_audit_log (
          event_type, performed_by, details, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        eventType,
        performedBy,
        JSON.stringify(details)
      ]);

    } catch (error) {
      console.error('Error logging automation event:', error);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get automation metrics
   */
  public async getAutomationMetrics(timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'DAILY'): Promise<AutomationMetrics> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();

      const interval = timeframe === 'DAILY' ? '24 hours' :
                     timeframe === 'WEEKLY' ? '7 days' : '30 days';

      const query = `
        SELECT
          COUNT(*) as total_processed,
          COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as successful_payouts,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_payouts,
          AVG(EXTRACT(EPOCH FROM (executed_at - created_at))) as avg_processing_time,
          SUM(CASE WHEN status = 'EXECUTED' THEN amount ELSE 0 END) as total_volume,
          COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' AND status = 'EXECUTED' THEN 1 END)::float /
            NULLIF(COUNT(*), 0) * 100 as automation_rate
        FROM automated_payout_requests
        WHERE created_at > NOW() - INTERVAL '${interval}'
      `;

      const result = await client.query(query);
      const row = result.rows[0];

      const totalProcessed = parseInt(row.total_processed) || 0;
      const successfulPayouts = parseInt(row.successful_payouts) || 0;
      const failedPayouts = parseInt(row.failed_payouts) || 0;

      return {
        totalProcessed,
        successfulPayouts,
        failedPayouts,
        averageProcessingTime: parseFloat(row.avg_processing_time) || 0,
        totalVolume: parseFloat(row.total_volume) || 0,
        automationRate: parseFloat(row.automation_rate) || 0,
        errorRate: totalProcessed > 0 ? (failedPayouts / totalProcessed) * 100 : 0,
        costSavings: successfulPayouts * 5, // Estimated $5 saved per automated payout
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error getting automation metrics:', error);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Get processing queue status
   */
  public getQueueStatus(): { queueId: string; status: string; requestCount: number; priority: number }[] {
    return Array.from(this.processingQueues.values()).map(queue => ({
      queueId: queue.id,
      status: queue.status,
      requestCount: queue.payoutRequests.length,
      priority: queue.priority
    }));
  }

  /**
   * Get merchant risk score
   */
  public getMerchantRiskScore(merchantId: string): MerchantRiskScore | undefined {
    return this.merchantRiskScores.get(merchantId);
  }

  /**
   * Force refresh merchant risk score
   */
  public async refreshMerchantRiskScore(merchantId: string): Promise<MerchantRiskScore> {
    return await this.calculateMerchantRiskScore(merchantId);
  }
}