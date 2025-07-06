'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Filter,
  Search,
  DollarSign,
  Users,
  TrendingUp,
  Shield,
  Wallet,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Pending Payout Interfaces
interface PendingPayoutRequest {
  id: number;
  merchant_id: string;
  merchant_name: string;
  merchant_email: string;
  requested_amount: number;
  currency: string;
  destination_wallet: string;
  destination_network: string;
  status: string;
  created_at: string;
  merchant_available_balance: number;
  merchant_total_sales: number;
  merchant_account_age_days: number;
  risk_score: 'LOW' | 'MEDIUM' | 'HIGH';
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
}

interface PendingPayoutsResponse {
  pending_requests: PendingPayoutRequest[];
  summary: {
    total_pending_amount: number;
    total_pending_count: number;
    high_risk_count: number;
    unverified_merchants_count: number;
    oldest_request_days: number;
  };
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminPendingPayoutsPage() {
  const { isAuthenticated, loading, adminApiKey } = useAdminAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [payoutsData, setPayoutsData] = useState<PendingPayoutsResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [riskFilter, setRiskFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Approval dialog state
  const [selectedPayout, setSelectedPayout] = useState<PendingPayoutRequest | null>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load pending payouts data
  useEffect(() => {
    if (isAuthenticated && adminApiKey) {
      loadPayoutsData();
    }
  }, [isAuthenticated, adminApiKey, currentPage, riskFilter, verificationFilter, sortBy, sortOrder]);

  const loadPayoutsData = async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        risk: riskFilter,
        verification: verificationFilter,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const response = await fetch(`/api/admin/payouts/pending?${params}`, {
        headers: {
          'X-Admin-API-Key': adminApiKey!
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending payouts');
      }

      const data: PendingPayoutsResponse = await response.json();
      setPayoutsData(data);

    } catch (error) {
      console.error('Error loading pending payouts:', error);
      toast({
        title: "Error Loading Data",
        description: "Unable to load pending payout requests. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedPayout) return;

    if (approvalAction === 'reject' && !rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this payout request.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingApproval(true);
    try {
      const response = await fetch(`/api/admin/payouts/approve/${selectedPayout.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': adminApiKey!
        },
        body: JSON.stringify({
          action: approvalAction,
          admin_notes: adminNotes.trim() || undefined,
          rejection_reason: approvalAction === 'reject' ? rejectionReason.trim() : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process payout approval');
      }

      const result = await response.json();
      
      toast({
        title: "Payout Processed",
        description: result.message,
      });

      // Refresh the data and close dialog
      await loadPayoutsData();
      setIsApprovalDialogOpen(false);
      setSelectedPayout(null);
      setAdminNotes('');
      setRejectionReason('');

    } catch (error) {
      console.error('Error processing payout approval:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unable to process payout approval. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const openApprovalDialog = (payout: PendingPayoutRequest, action: 'approve' | 'reject') => {
    setSelectedPayout(payout);
    setApprovalAction(action);
    setIsApprovalDialogOpen(true);
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

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return <Badge variant="default" className="bg-green-100 text-green-800">Low Risk</Badge>;
      case 'MEDIUM':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
      case 'HIGH':
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'UNVERIFIED':
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />Unverified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TAIC') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatWalletAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <Clock className="mr-3 h-8 w-8 text-primary" />
            Pending Payouts
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Review and approve merchant payout requests.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button variant="outline" asChild>
            <Link href="/admin/treasury/overview">
              <Wallet className="mr-2 h-4 w-4" />
              Treasury Overview
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/merchants/financials">
              <DollarSign className="mr-2 h-4 w-4" />
              Merchant Financials
            </Link>
          </Button>
        </div>
      </header>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading pending payout requests...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {payoutsData?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{payoutsData.summary.total_pending_count}</div>
                  <p className="text-xs text-muted-foreground">
                    Payout requests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(payoutsData.summary.total_pending_amount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting approval
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">High Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{payoutsData.summary.high_risk_count}</div>
                  <p className="text-xs text-muted-foreground">
                    Require extra review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unverified</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{payoutsData.summary.unverified_merchants_count}</div>
                  <p className="text-xs text-muted-foreground">
                    Unverified merchants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Oldest Request</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{payoutsData.summary.oldest_request_days}</div>
                  <p className="text-xs text-muted-foreground">
                    Days old
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Filter & Sort
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Risk Level</label>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Status</label>
                  <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Merchants</SelectItem>
                      <SelectItem value="verified">Verified Only</SelectItem>
                      <SelectItem value="unverified">Unverified Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Request Date</SelectItem>
                      <SelectItem value="requested_amount">Amount</SelectItem>
                      <SelectItem value="merchant_name">Merchant Name</SelectItem>
                      <SelectItem value="risk_score">Risk Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort Order</label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Oldest First</SelectItem>
                      <SelectItem value="desc">Newest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Payout Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Payout Requests
              </CardTitle>
              <CardDescription>
                Review and approve merchant payout requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payoutsData?.pending_requests && payoutsData.pending_requests.length > 0 ? (
                  payoutsData.pending_requests.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-6 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {payout.merchant_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium">{payout.merchant_name}</h4>
                            {getRiskBadge(payout.risk_score)}
                            {getVerificationBadge(payout.verification_status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{payout.merchant_email}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                            <span>Requested: {formatDate(payout.created_at)}</span>
                            <span>•</span>
                            <span>Account Age: {Math.floor(payout.merchant_account_age_days)} days</span>
                            <span>•</span>
                            <span>Total Sales: {formatCurrency(payout.merchant_total_sales)}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                            <span>Destination: {formatWalletAddress(payout.destination_wallet)}</span>
                            <span>({payout.destination_network})</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Requested Amount</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(payout.requested_amount, payout.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Available Balance</p>
                          <p className={`text-sm font-medium ${
                            payout.merchant_available_balance >= payout.requested_amount
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {formatCurrency(payout.merchant_available_balance)}
                          </p>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openApprovalDialog(payout, 'approve')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openApprovalDialog(payout, 'reject')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="mx-auto h-16 w-16 mb-4 opacity-50" />
                    <p className="text-xl font-medium">No pending payout requests</p>
                    <p className="text-sm">All payout requests have been processed</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {payoutsData && payoutsData.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {payoutsData.page} of {payoutsData.totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={payoutsData.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(payoutsData.totalPages, prev + 1))}
                      disabled={payoutsData.page >= payoutsData.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Payout Request
            </DialogTitle>
            <DialogDescription>
              {selectedPayout && (
                <>
                  {approvalAction === 'approve'
                    ? `Approve payout of ${formatCurrency(selectedPayout.requested_amount, selectedPayout.currency)} to ${selectedPayout.merchant_name}?`
                    : `Reject payout request from ${selectedPayout.merchant_name}?`
                  }
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              {/* Payout Details */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Merchant:</span>
                  <span className="text-sm">{selectedPayout.merchant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="text-sm font-semibold">{formatCurrency(selectedPayout.requested_amount, selectedPayout.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Available Balance:</span>
                  <span className={`text-sm ${
                    selectedPayout.merchant_available_balance >= selectedPayout.requested_amount
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(selectedPayout.merchant_available_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Risk Level:</span>
                  <span className="text-sm">{getRiskBadge(selectedPayout.risk_score)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Verification:</span>
                  <span className="text-sm">{getVerificationBadge(selectedPayout.verification_status)}</span>
                </div>
              </div>

              {/* Insufficient Balance Warning */}
              {approvalAction === 'approve' && selectedPayout.merchant_available_balance < selectedPayout.requested_amount && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> Merchant has insufficient balance for this payout request.
                    Available: {formatCurrency(selectedPayout.merchant_available_balance)} |
                    Requested: {formatCurrency(selectedPayout.requested_amount)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this approval/rejection..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Rejection Reason */}
              {approvalAction === 'reject' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rejection Reason *</label>
                  <Textarea
                    placeholder="Please provide a clear reason for rejecting this payout request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={isProcessingApproval || (approvalAction === 'reject' && !rejectionReason.trim())}
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isProcessingApproval ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  {approvalAction === 'approve' ? (
                    <><CheckCircle className="h-4 w-4 mr-2" />Approve Payout</>
                  ) : (
                    <><XCircle className="h-4 w-4 mr-2" />Reject Payout</>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back to Admin Dashboard */}
      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">Back to Admin Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
