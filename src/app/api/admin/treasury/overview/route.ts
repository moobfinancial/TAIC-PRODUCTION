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

// Treasury Overview Interfaces
interface TreasuryWallet {
  wallet_type: string;
  network: string;
  wallet_address: string;
  balance: number;
  currency: string;
  last_updated: string;
  status: 'active' | 'inactive' | 'maintenance';
}

interface TreasuryMetrics {
  total_treasury_balance: number;
  total_merchant_liabilities: number;
  available_for_payouts: number;
  pending_payout_obligations: number;
  platform_revenue: number;
  cashback_reserves: number;
  staking_rewards_pool: number;
}

interface RecentTreasuryActivity {
  id: string;
  activity_type: 'INBOUND' | 'OUTBOUND' | 'INTERNAL_TRANSFER';
  amount: number;
  currency: string;
  description: string;
  transaction_hash: string | null;
  timestamp: string;
  status: string;
}

interface TreasuryOverviewResponse {
  wallets: TreasuryWallet[];
  metrics: TreasuryMetrics;
  recent_activity: RecentTreasuryActivity[];
  alerts: {
    low_balance_warnings: string[];
    pending_approvals_count: number;
    failed_transactions_count: number;
  };
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (!validateAdminApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // For now, we'll use mock data since treasury wallets aren't fully implemented yet
    // In production, this would connect to actual wallet APIs and blockchain networks
    
    // Mock treasury wallets data
    const mockWallets: TreasuryWallet[] = [
      {
        wallet_type: 'TREASURY_MAIN',
        network: 'FANTOM',
        wallet_address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d4d4',
        balance: 2500000.00,
        currency: 'TAIC',
        last_updated: new Date().toISOString(),
        status: 'active'
      },
      {
        wallet_type: 'PAYOUT_HOT',
        network: 'FANTOM',
        wallet_address: '0x8ba1f109551bD432803012645Hac136c22C85d',
        balance: 150000.00,
        currency: 'TAIC',
        last_updated: new Date().toISOString(),
        status: 'active'
      },
      {
        wallet_type: 'CASHBACK_RESERVE',
        network: 'FANTOM',
        wallet_address: '0x9cd2f109551bD432803012645Hac136c22C85e',
        balance: 75000.00,
        currency: 'TAIC',
        last_updated: new Date().toISOString(),
        status: 'active'
      },
      {
        wallet_type: 'STAKING_REWARDS',
        network: 'FANTOM',
        wallet_address: '0xaef3f109551bD432803012645Hac136c22C85f',
        balance: 500000.00,
        currency: 'TAIC',
        last_updated: new Date().toISOString(),
        status: 'active'
      }
    ];

    // Calculate treasury metrics from database
    const metricsQuery = `
      WITH merchant_liabilities AS (
        SELECT 
          COALESCE(SUM(CASE WHEN mt.status = 'COMPLETED' THEN mt.amount ELSE 0 END), 0) as total_merchant_balances
        FROM merchant_transactions mt
      ),
      pending_payouts AS (
        SELECT 
          COALESCE(SUM(mpr.requested_amount), 0) as pending_obligations
        FROM merchant_payout_requests mpr
        WHERE mpr.status IN ('PENDING', 'APPROVED', 'PROCESSING')
      ),
      platform_revenue AS (
        SELECT 
          COALESCE(SUM(ABS(mt.amount)), 0) as total_commissions
        FROM merchant_transactions mt
        WHERE mt.transaction_type = 'COMMISSION' AND mt.status = 'COMPLETED'
      ),
      cashback_costs AS (
        SELECT 
          COALESCE(SUM(ABS(mt.amount)), 0) as total_cashback
        FROM merchant_transactions mt
        WHERE mt.transaction_type = 'CASHBACK_COST' AND mt.status = 'COMPLETED'
      )
      SELECT 
        ml.total_merchant_balances,
        pp.pending_obligations,
        pr.total_commissions,
        cc.total_cashback
      FROM merchant_liabilities ml, pending_payouts pp, platform_revenue pr, cashback_costs cc
    `;

    const metricsResult = await pool.query(metricsQuery);
    const dbMetrics = metricsResult.rows[0];

    // Calculate treasury metrics
    const totalTreasuryBalance = mockWallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const merchantLiabilities = parseFloat(dbMetrics.total_merchant_balances) || 0;
    const pendingPayouts = parseFloat(dbMetrics.pending_obligations) || 0;
    const platformRevenue = parseFloat(dbMetrics.total_commissions) || 0;
    const cashbackReserves = parseFloat(dbMetrics.total_cashback) || 0;

    const metrics: TreasuryMetrics = {
      total_treasury_balance: totalTreasuryBalance,
      total_merchant_liabilities: merchantLiabilities,
      available_for_payouts: Math.max(0, totalTreasuryBalance - merchantLiabilities - pendingPayouts),
      pending_payout_obligations: pendingPayouts,
      platform_revenue: platformRevenue,
      cashback_reserves: cashbackReserves,
      staking_rewards_pool: mockWallets.find(w => w.wallet_type === 'STAKING_REWARDS')?.balance || 0
    };

    // Get recent treasury activity (mock data for now)
    const recentActivity: RecentTreasuryActivity[] = [
      {
        id: 'activity_001',
        activity_type: 'OUTBOUND',
        amount: -1250.00,
        currency: 'TAIC',
        description: 'Merchant payout to TechStore Electronics',
        transaction_hash: '0x1234567890abcdef1234567890abcdef12345678',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: 'COMPLETED'
      },
      {
        id: 'activity_002',
        activity_type: 'INBOUND',
        amount: 5000.00,
        currency: 'TAIC',
        description: 'Platform commission collection',
        transaction_hash: '0x2345678901bcdef12345678901cdef123456789',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        status: 'COMPLETED'
      },
      {
        id: 'activity_003',
        activity_type: 'INTERNAL_TRANSFER',
        amount: 10000.00,
        currency: 'TAIC',
        description: 'Transfer from treasury to hot wallet',
        transaction_hash: '0x3456789012cdef123456789012def1234567890',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        status: 'COMPLETED'
      },
      {
        id: 'activity_004',
        activity_type: 'OUTBOUND',
        amount: -750.00,
        currency: 'TAIC',
        description: 'Merchant payout to Fashion Hub',
        transaction_hash: null,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        status: 'PROCESSING'
      }
    ];

    // Generate alerts
    const lowBalanceThreshold = 50000; // TAIC
    const lowBalanceWallets = mockWallets.filter(w => w.balance < lowBalanceThreshold);
    
    // Get pending approvals count
    const pendingApprovalsQuery = `
      SELECT COUNT(*) as count
      FROM merchant_payout_requests
      WHERE status = 'PENDING'
    `;
    const pendingApprovalsResult = await pool.query(pendingApprovalsQuery);
    const pendingApprovalsCount = parseInt(pendingApprovalsResult.rows[0].count);

    // Get failed transactions count (last 24 hours)
    const failedTransactionsQuery = `
      SELECT COUNT(*) as count
      FROM merchant_transactions
      WHERE status = 'FAILED' AND created_at >= NOW() - INTERVAL '24 hours'
    `;
    const failedTransactionsResult = await pool.query(failedTransactionsQuery);
    const failedTransactionsCount = parseInt(failedTransactionsResult.rows[0].count);

    const response: TreasuryOverviewResponse = {
      wallets: mockWallets,
      metrics,
      recent_activity: recentActivity,
      alerts: {
        low_balance_warnings: lowBalanceWallets.map(w => 
          `${w.wallet_type} wallet balance (${w.balance.toLocaleString()} ${w.currency}) is below threshold`
        ),
        pending_approvals_count: pendingApprovalsCount,
        failed_transactions_count: failedTransactionsCount
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching treasury overview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
