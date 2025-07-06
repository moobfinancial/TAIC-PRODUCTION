'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Merchant Financial Overview Interface
interface MerchantFinancialOverview {
  merchant_id: string;
  business_name: string;
  email: string;
  total_sales: number;
  total_commissions: number;
  total_payouts: number;
  available_balance: number;
  pending_payouts: number;
  total_transactions: number;
  last_payout_date: string | null;
  account_status: string;
  payout_wallet_address: string | null;
  payout_schedule: string;
  minimum_payout_amount: number;
}

interface MerchantFinancialsResponse {
  merchants: MerchantFinancialOverview[];
  summary: {
    total_merchants: number;
    total_platform_sales: number;
    total_platform_commissions: number;
    total_pending_payouts: number;
    merchants_with_pending_payouts: number;
  };
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminMerchantFinancialsPage() {
  const { isAuthenticated, loading, adminApiKey } = useAdminAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [financialsData, setFinancialsData] = useState<MerchantFinancialsResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('total_sales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load merchant financials data
  useEffect(() => {
    if (isAuthenticated && adminApiKey) {
      loadFinancialsData();
    }
  }, [isAuthenticated, adminApiKey, currentPage, searchTerm, statusFilter, sortBy, sortOrder]);

  const loadFinancialsData = async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        status: statusFilter,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const response = await fetch(`/api/admin/merchants/financials?${params}`, {
        headers: {
          'X-Admin-API-Key': adminApiKey!
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch merchant financials');
      }

      const data: MerchantFinancialsResponse = await response.json();
      setFinancialsData(data);

    } catch (error) {
      console.error('Error loading merchant financials:', error);
      toast({
        title: "Error Loading Data",
        description: "Unable to load merchant financial data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExportData = async () => {
    try {
      toast({
        title: "Export Started",
        description: "Merchant financial report is being generated and will be downloaded shortly.",
      });
      // TODO: Implement actual export functionality
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export merchant financial data. Please try again.",
        variant: "destructive"
      });
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TAIC') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <DollarSign className="mr-3 h-8 w-8 text-primary" />
            Merchant Financials
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Monitor merchant financial performance and manage platform revenue.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button variant="outline" onClick={handleExportData}>
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

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading merchant financial data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Platform Summary Cards */}
          {financialsData?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{financialsData.summary.total_merchants}</div>
                  <p className="text-xs text-muted-foreground">
                    Active merchant accounts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Sales</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(financialsData.summary.total_platform_sales)}
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    Total merchant sales
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(financialsData.summary.total_platform_commissions)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commission earnings
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
                    {formatCurrency(financialsData.summary.total_pending_payouts)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {financialsData.summary.merchants_with_pending_payouts} merchants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {financialsData.summary.total_platform_sales > 0 
                      ? ((financialsData.summary.total_platform_commissions / financialsData.summary.total_platform_sales) * 100).toFixed(1)
                      : '0.0'
                    }%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Platform commission rate
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Filter & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Merchants</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
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
                      <SelectItem value="total_sales">Total Sales</SelectItem>
                      <SelectItem value="total_commissions">Commissions</SelectItem>
                      <SelectItem value="available_balance">Available Balance</SelectItem>
                      <SelectItem value="business_name">Business Name</SelectItem>
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
                      <SelectItem value="desc">Highest First</SelectItem>
                      <SelectItem value="asc">Lowest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Merchant Financial List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Merchant Financial Overview
              </CardTitle>
              <CardDescription>
                Detailed financial information for all merchants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialsData?.merchants && financialsData.merchants.length > 0 ? (
                  financialsData.merchants.map((merchant) => (
                    <div key={merchant.merchant_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {merchant.business_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{merchant.business_name}</h4>
                            {getStatusBadge(merchant.account_status)}
                            {merchant.pending_payouts > 0 && (
                              <Badge variant="outline" className="text-orange-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Pending Payout
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{merchant.email}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                            <span>Transactions: {merchant.total_transactions}</span>
                            <span>•</span>
                            <span>Schedule: {merchant.payout_schedule}</span>
                            <span>•</span>
                            <span>Last Payout: {formatDate(merchant.last_payout_date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Sales</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(merchant.total_sales)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Commissions</p>
                            <p className="font-semibold text-blue-600">
                              {formatCurrency(merchant.total_commissions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(merchant.available_balance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pending</p>
                            <p className="font-semibold text-orange-600">
                              {formatCurrency(merchant.pending_payouts)}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/merchants/${merchant.merchant_id}/details`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {merchant.pending_payouts > 0 && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/payouts/pending?merchant=${merchant.merchant_id}`}>
                                Review Payout
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No merchants found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {financialsData && financialsData.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {financialsData.page} of {financialsData.totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={financialsData.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(financialsData.totalPages, prev + 1))}
                      disabled={financialsData.page >= financialsData.totalPages}
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

      {/* Back to Admin Dashboard */}
      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">Back to Admin Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
