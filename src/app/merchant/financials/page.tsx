'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [merchantWallets, setMerchantWallets] = useState<any[]>([]);
  const [payoutFormData, setPayoutFormData] = useState({
    requestedAmount: '',
    destinationWallet: '',
    destinationNetwork: 'FANTOM',
    notes: '',
    useRegisteredWallet: false,
    registeredWalletId: ''
  });

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
      loadMerchantWallets();
    }
  }, [isAuthenticated, token]);

  const loadMerchantWallets = async () => {
    try {
      const response = await fetch('/api/merchant/wallets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMerchantWallets(data.wallets || []);
      }
    } catch (error) {
      console.error('Error loading merchant wallets:', error);
    }
  };

  const loadFinancialData = async () => {
    setIsLoadingData(true);
    try {
      // Load payout settings and financial summary
      const settingsResponse = await fetch('/api/merchant/payouts/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch payout settings');
      }

      const settings = await settingsResponse.json();

      // Set financial summary from real data
      setFinancialSummary({
        totalEarnings: settings.totalEarnings,
        availableForPayout: settings.availableBalance,
        pendingPayouts: settings.pendingPayouts,
        totalSales: settings.totalEarnings + settings.totalPayouts, // Approximate total sales
        platformCommission: settings.totalEarnings * 0.05, // Approximate commission
        cashbackCosts: 0, // TODO: Add cashback tracking
        currency: 'TAIC'
      });

      // Load recent transactions from order analytics
      const analyticsResponse = await fetch('/api/merchant/orders/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (analyticsResponse.ok) {
        const analytics = await analyticsResponse.json();
        // Convert analytics data to transaction format
        const mockTransactions: Transaction[] = [
          {
            id: 'summary_sales',
            type: 'SALE',
            amount: analytics.totalRevenue,
            currency: 'TAIC',
            status: 'COMPLETED',
            date: new Date().toISOString(),
            description: `Total sales revenue (${analytics.totalOrders} orders)`
          },
          {
            id: 'summary_commission',
            type: 'COMMISSION',
            amount: -analytics.totalCommissions,
            currency: 'TAIC',
            status: 'COMPLETED',
            date: new Date().toISOString(),
            description: `Platform commissions`
          }
        ];
        setRecentTransactions(mockTransactions);
      } else {
        // Fallback to empty transactions
        setRecentTransactions([]);
      }

      // Load real payout requests
      const payoutsResponse = await fetch('/api/merchant/payouts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (payoutsResponse.ok) {
        const payoutsData = await payoutsResponse.json();
        setPayoutRequests(payoutsData.payoutRequests.map((payout: any) => ({
          id: payout.id,
          amount: payout.requested_amount,
          currency: payout.currency,
          status: payout.status,
          requestedAt: payout.created_at,
          destinationWallet: payout.destination_wallet,
          processedAt: payout.processed_at,
          rejectionReason: payout.rejection_reason,
          adminNotes: payout.admin_notes
        })));
      } else {
        setPayoutRequests([]);
      }

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

  const handleRequestPayout = () => {
    if (!financialSummary || financialSummary.availableForPayout <= 0) {
      toast({
        title: "No Funds Available",
        description: "You don't have any funds available for payout.",
        variant: "destructive"
      });
      return;
    }

    // Pre-fill the form with available amount
    setPayoutFormData({
      requestedAmount: financialSummary.availableForPayout.toString(),
      destinationWallet: '',
      destinationNetwork: 'FANTOM',
      notes: '',
      useRegisteredWallet: false,
      registeredWalletId: ''
    });
    setShowPayoutForm(true);
  };

  const handleSubmitPayout = async () => {
    if (!payoutFormData.requestedAmount || !payoutFormData.destinationWallet) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsRequestingPayout(true);
    try {
      const response = await fetch('/api/merchant/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestedAmount: parseFloat(payoutFormData.requestedAmount),
          currency: 'TAIC',
          destinationWallet: payoutFormData.destinationWallet,
          destinationNetwork: payoutFormData.destinationNetwork,
          notes: payoutFormData.notes,
          useRegisteredWallet: payoutFormData.useRegisteredWallet,
          registeredWalletId: payoutFormData.registeredWalletId ? parseInt(payoutFormData.registeredWalletId) : undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payout request');
      }

      toast({
        title: "Payout Requested",
        description: `Payout request for ${payoutFormData.requestedAmount} TAIC has been submitted successfully.`,
      });

      setShowPayoutForm(false);
      setPayoutFormData({
        requestedAmount: '',
        destinationWallet: '',
        destinationNetwork: 'FANTOM',
        notes: '',
        useRegisteredWallet: false,
        registeredWalletId: ''
      });

      // Refresh data
      await loadFinancialData();
    } catch (error: any) {
      toast({
        title: "Payout Request Failed",
        description: error.message || "Unable to process your payout request. Please try again.",
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

      {/* Payout Request Form Dialog */}
      <Dialog open={showPayoutForm} onOpenChange={setShowPayoutForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Wallet className="mr-2 h-5 w-5" />
              Request Payout
            </DialogTitle>
            <DialogDescription>
              Submit a payout request to withdraw your available earnings to your wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="requestedAmount">Requested Amount (TAIC)</Label>
              <Input
                id="requestedAmount"
                type="number"
                step="0.01"
                min="0"
                max={financialSummary?.availableForPayout || 0}
                value={payoutFormData.requestedAmount}
                onChange={(e) => setPayoutFormData(prev => ({ ...prev, requestedAmount: e.target.value }))}
                placeholder="Enter amount to withdraw"
              />
              {financialSummary && (
                <p className="text-xs text-muted-foreground">
                  Available: {financialSummary.availableForPayout.toFixed(2)} TAIC
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Wallet Selection</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="useNewWallet"
                    name="walletSelection"
                    checked={!payoutFormData.useRegisteredWallet}
                    onChange={() => setPayoutFormData(prev => ({
                      ...prev,
                      useRegisteredWallet: false,
                      registeredWalletId: ''
                    }))}
                  />
                  <Label htmlFor="useNewWallet">Enter new wallet address</Label>
                </div>

                {merchantWallets.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="useRegisteredWallet"
                      name="walletSelection"
                      checked={payoutFormData.useRegisteredWallet}
                      onChange={() => setPayoutFormData(prev => ({
                        ...prev,
                        useRegisteredWallet: true
                      }))}
                    />
                    <Label htmlFor="useRegisteredWallet">Use registered wallet</Label>
                  </div>
                )}
              </div>
            </div>

            {payoutFormData.useRegisteredWallet ? (
              <div className="space-y-2">
                <Label htmlFor="registeredWallet">Select Registered Wallet</Label>
                <Select
                  value={payoutFormData.registeredWalletId}
                  onValueChange={(value) => setPayoutFormData(prev => ({
                    ...prev,
                    registeredWalletId: value,
                    destinationWallet: merchantWallets.find(w => w.id.toString() === value)?.wallet_address || '',
                    destinationNetwork: merchantWallets.find(w => w.id.toString() === value)?.network || 'FANTOM'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchantWallets.filter(w => w.is_active).map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm">
                            {wallet.wallet_address.slice(0, 6)}...{wallet.wallet_address.slice(-4)}
                          </span>
                          <Badge variant="outline">{wallet.network}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="destinationWallet">Destination Wallet Address</Label>
                <Input
                  id="destinationWallet"
                  value={payoutFormData.destinationWallet}
                  onChange={(e) => setPayoutFormData(prev => ({ ...prev, destinationWallet: e.target.value }))}
                  placeholder="0x..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="destinationNetwork">Network</Label>
              <Select
                value={payoutFormData.destinationNetwork}
                onValueChange={(value) => setPayoutFormData(prev => ({ ...prev, destinationNetwork: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FANTOM">Fantom (FTM)</SelectItem>
                  <SelectItem value="ETHEREUM">Ethereum (ETH)</SelectItem>
                  <SelectItem value="BSC">Binance Smart Chain (BSC)</SelectItem>
                  <SelectItem value="POLYGON">Polygon (MATIC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={payoutFormData.notes}
                onChange={(e) => setPayoutFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about this payout request..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPayoutForm(false)}
              disabled={isRequestingPayout}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPayout}
              disabled={isRequestingPayout || !payoutFormData.requestedAmount || !payoutFormData.destinationWallet}
            >
              {isRequestingPayout ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
