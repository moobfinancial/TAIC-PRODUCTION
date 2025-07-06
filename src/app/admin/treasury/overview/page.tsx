'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Coins,
  Activity,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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

export default function AdminTreasuryOverviewPage() {
  const { isAuthenticated, loading, adminApiKey } = useAdminAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [treasuryData, setTreasuryData] = useState<TreasuryOverviewResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load treasury data
  useEffect(() => {
    if (isAuthenticated && adminApiKey) {
      loadTreasuryData();
    }
  }, [isAuthenticated, adminApiKey]);

  const loadTreasuryData = async () => {
    setIsLoadingData(true);
    try {
      const response = await fetch('/api/admin/treasury/overview', {
        headers: {
          'X-Admin-API-Key': adminApiKey!
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch treasury data');
      }

      const data: TreasuryOverviewResponse = await response.json();
      setTreasuryData(data);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast({
        title: "Error Loading Treasury Data",
        description: "Unable to load treasury information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefreshData = () => {
    loadTreasuryData();
    toast({
      title: "Data Refreshed",
      description: "Treasury data has been updated with the latest information.",
    });
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const getWalletStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'maintenance':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Maintenance</Badge>;
      case 'inactive':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'INBOUND':
        return <ArrowDownRight className="h-4 w-4 text-green-600" />;
      case 'OUTBOUND':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'INTERNAL_TRANSFER':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TAIC') => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatWalletAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <Wallet className="mr-3 h-8 w-8 text-primary" />
            Treasury Overview
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Monitor treasury wallets, balances, and financial health.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button variant="outline" onClick={handleRefreshData} disabled={isLoadingData}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button asChild>
            <Link href="/admin/payouts/pending">
              <Eye className="mr-2 h-4 w-4" />
              Review Payouts
            </Link>
          </Button>
        </div>
      </header>

      {/* Last Updated Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Last updated: {lastRefresh.toLocaleString()}</span>
        <span>Auto-refresh: Every 5 minutes</span>
      </div>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading treasury data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Alerts Section */}
          {treasuryData?.alerts && (
            <div className="space-y-4">
              {treasuryData.alerts.low_balance_warnings.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Low Balance Warnings:</strong>
                    <ul className="mt-2 space-y-1">
                      {treasuryData.alerts.low_balance_warnings.map((warning, index) => (
                        <li key={index} className="text-sm">• {warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {treasuryData.alerts.pending_approvals_count > 0 && (
                <Alert className="border-orange-200 bg-orange-50">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>{treasuryData.alerts.pending_approvals_count} payout requests</strong> are waiting for admin approval.
                    <Button variant="link" className="p-0 h-auto ml-2 text-orange-800" asChild>
                      <Link href="/admin/payouts/pending">Review now →</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {treasuryData.alerts.failed_transactions_count > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>{treasuryData.alerts.failed_transactions_count} transactions failed</strong> in the last 24 hours. Please investigate.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Treasury Metrics */}
          {treasuryData?.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Treasury</CardTitle>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(treasuryData.metrics.total_treasury_balance)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across all wallets
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available for Payouts</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(treasuryData.metrics.available_for_payouts)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ready for merchant payouts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Merchant Liabilities</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(treasuryData.metrics.total_merchant_liabilities)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Owed to merchants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(treasuryData.metrics.platform_revenue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commission earnings
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Treasury Wallets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                Treasury Wallets
              </CardTitle>
              <CardDescription>
                Monitor all treasury wallet balances and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treasuryData?.wallets && treasuryData.wallets.length > 0 ? (
                  treasuryData.wallets.map((wallet) => (
                    <div key={`${wallet.wallet_type}-${wallet.network}`} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{wallet.wallet_type.replace('_', ' ')}</h4>
                            {getWalletStatusBadge(wallet.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {wallet.network} • {formatWalletAddress(wallet.wallet_address)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last updated: {formatTimestamp(wallet.last_updated)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatCurrency(wallet.balance, wallet.currency)}
                        </div>
                        <div className="flex space-x-2 mt-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No treasury wallets configured</p>
                    <p className="text-sm">Configure treasury wallets to monitor balances</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Treasury Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Recent Treasury Activity
              </CardTitle>
              <CardDescription>
                Latest treasury transactions and transfers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treasuryData?.recent_activity && treasuryData.recent_activity.length > 0 ? (
                  treasuryData.recent_activity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{activity.description}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatTimestamp(activity.timestamp)}
                          </p>
                          {activity.transaction_hash && (
                            <p className="text-xs text-muted-foreground">
                              Hash: {formatWalletAddress(activity.transaction_hash)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${
                          activity.activity_type === 'INBOUND' ? 'text-green-600' :
                          activity.activity_type === 'OUTBOUND' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {activity.activity_type === 'INBOUND' ? '+' :
                           activity.activity_type === 'OUTBOUND' ? '-' : ''}
                          {formatCurrency(Math.abs(activity.amount), activity.currency)}
                        </div>
                        <Badge variant={activity.status === 'COMPLETED' ? 'default' : 'secondary'}>
                          {activity.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No recent activity</p>
                    <p className="text-sm">Treasury activity will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Treasury Metrics */}
          {treasuryData?.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Obligations</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(treasuryData.metrics.pending_payout_obligations)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting payout processing
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cashback Reserves</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(treasuryData.metrics.cashback_reserves)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer reward reserves
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Staking Rewards</CardTitle>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(treasuryData.metrics.staking_rewards_pool)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Staking reward pool
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Back to Admin Dashboard */}
      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">Back to Admin Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
