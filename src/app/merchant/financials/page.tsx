'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Download,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Mock data interfaces - will be replaced with real API calls
interface FinancialSummary {
  totalEarnings: number;
  availableForPayout: number;
  pendingPayouts: number;
  totalSales: number;
  platformCommission: number;
  cashbackCosts: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: 'SALE' | 'COMMISSION' | 'PAYOUT' | 'CASHBACK_COST';
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  date: string;
  description: string;
  orderId?: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requestedAt: string;
  processedAt?: string;
  destinationWallet: string;
}

export default function MerchantFinancialsPage() {
  const { merchant, isAuthenticated, loading, token } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load financial data
  useEffect(() => {
    if (isAuthenticated && token) {
      loadFinancialData();
    }
  }, [isAuthenticated, token]);

  const loadFinancialData = async () => {
    setIsLoadingData(true);
    try {
      // TODO: Replace with real API calls
      // For now, using mock data to establish UI patterns
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock financial summary
      setFinancialSummary({
        totalEarnings: 2847.50,
        availableForPayout: 1923.75,
        pendingPayouts: 500.00,
        totalSales: 3150.00,
        platformCommission: 157.50, // 5% of sales
        cashbackCosts: 145.00,
        currency: 'TAIC'
      });

      // Mock recent transactions
      setRecentTransactions([
        {
          id: 'txn_001',
          type: 'SALE',
          amount: 89.99,
          currency: 'TAIC',
          status: 'COMPLETED',
          date: '2025-01-04T10:30:00Z',
          description: 'Sale of Premium Wireless Headphones',
          orderId: 'ORD_12345'
        },
        {
          id: 'txn_002',
          type: 'COMMISSION',
          amount: -4.50,
          currency: 'TAIC',
          status: 'COMPLETED',
          date: '2025-01-04T10:30:00Z',
          description: 'Platform commission (5%)',
          orderId: 'ORD_12345'
        },
        {
          id: 'txn_003',
          type: 'CASHBACK_COST',
          amount: -2.70,
          currency: 'TAIC',
          status: 'COMPLETED',
          date: '2025-01-04T10:30:00Z',
          description: 'Customer cashback (3%)',
          orderId: 'ORD_12345'
        },
        {
          id: 'txn_004',
          type: 'PAYOUT',
          amount: -500.00,
          currency: 'TAIC',
          status: 'COMPLETED',
          date: '2025-01-03T14:15:00Z',
          description: 'Weekly payout to wallet'
        }
      ]);

      // Mock payout requests
      setPayoutRequests([
        {
          id: 'payout_001',
          amount: 500.00,
          currency: 'TAIC',
          status: 'PENDING',
          requestedAt: '2025-01-05T09:00:00Z',
          destinationWallet: '0x1234...5678'
        },
        {
          id: 'payout_002',
          amount: 750.00,
          currency: 'TAIC',
          status: 'COMPLETED',
          requestedAt: '2024-12-28T16:30:00Z',
          processedAt: '2024-12-29T10:15:00Z',
          destinationWallet: '0x1234...5678'
        }
      ]);

    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error Loading Financial Data",
        description: "Unable to load your financial information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!financialSummary || financialSummary.availableForPayout <= 0) {
      toast({
        title: "No Funds Available",
        description: "You don't have any funds available for payout.",
        variant: "destructive"
      });
      return;
    }

    setIsRequestingPayout(true);
    try {
      // TODO: Implement real payout request API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Payout Requested",
        description: `Payout request for ${financialSummary.availableForPayout} ${financialSummary.currency} has been submitted.`,
      });
      
      // Refresh data
      await loadFinancialData();
    } catch (error) {
      toast({
        title: "Payout Request Failed",
        description: "Unable to process your payout request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRequestingPayout(false);
    }
  };

  // Show loading state while checking authentication
  if (loading || !merchant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading financials...</p>
        </div>
      </div>
    );
  }

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'SALE':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'PAYOUT':
        return <ArrowDownRight className="h-4 w-4 text-blue-600" />;
      case 'COMMISSION':
      case 'CASHBACK_COST':
        return <ArrowDownRight className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <DollarSign className="mr-3 h-8 w-8 text-primary" />
            Financials & Payouts
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track your earnings, manage payouts, and view transaction history.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button variant="outline" onClick={loadFinancialData} disabled={isLoadingData}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button 
            onClick={handleRequestPayout} 
            disabled={isRequestingPayout || !financialSummary || financialSummary.availableForPayout <= 0}
          >
            <Wallet className="mr-2 h-4 w-4" />
            {isRequestingPayout ? 'Processing...' : 'Request Payout'}
          </Button>
        </div>
      </header>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading financial data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Financial Summary Cards */}
          {financialSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {financialSummary.totalEarnings.toFixed(2)} {financialSummary.currency}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From {financialSummary.totalSales.toFixed(2)} {financialSummary.currency} in sales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {financialSummary.availableForPayout.toFixed(2)} {financialSummary.currency}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ready to withdraw
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {financialSummary.pendingPayouts.toFixed(2)} {financialSummary.currency}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Being processed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    -{(financialSummary.platformCommission + financialSummary.cashbackCosts).toFixed(2)} {financialSummary.currency}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commission + cashback costs
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Your latest financial activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString()} at {new Date(transaction.date).toLocaleTimeString()}
                            {transaction.orderId && (
                              <span className="ml-2">
                                Order: <Link href={`/merchant/orders`} className="text-primary hover:underline">{transaction.orderId}</Link>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)} {transaction.currency}
                        </p>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No transactions yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payout Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                Payout History
              </CardTitle>
              <CardDescription>
                Track your payout requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payoutRequests.length > 0 ? (
                  payoutRequests.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Wallet className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium">
                            Payout Request - {payout.amount.toFixed(2)} {payout.currency}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Requested: {new Date(payout.requestedAt).toLocaleDateString()}
                            {payout.processedAt && (
                              <span className="ml-2">
                                • Processed: {new Date(payout.processedAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            To: {payout.destinationWallet}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(payout.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No payout requests yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Breakdown */}
          {financialSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Financial Breakdown
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of your earnings and costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Gross Sales</span>
                    <span className="font-semibold text-green-600">
                      +{financialSummary.totalSales.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Platform Commission (5%)</span>
                    <span className="text-red-600">
                      -{financialSummary.platformCommission.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Customer Cashback Costs</span>
                    <span className="text-red-600">
                      -{financialSummary.cashbackCosts.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center font-semibold">
                    <span>Net Earnings</span>
                    <span className="text-green-600">
                      {financialSummary.totalEarnings.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Already Paid Out</span>
                    <span className="text-blue-600">
                      -{(financialSummary.totalEarnings - financialSummary.availableForPayout - financialSummary.pendingPayouts).toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending Payouts</span>
                    <span className="text-orange-600">
                      -{financialSummary.pendingPayouts.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Available for Payout</span>
                    <span className="text-green-600">
                      {financialSummary.availableForPayout.toFixed(2)} {financialSummary.currency}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Back to Dashboard */}
      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
