// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Shield,
  ArrowUpRight,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  // User stats
  total_users: number;
  total_merchants: number;
  total_shoppers: number;
  new_users_last_30_days: number;

  // Financial stats
  total_platform_sales: number;
  total_platform_commissions: number;
  total_pending_payouts: number;
  merchants_with_pending_payouts: number;

  // Treasury stats
  total_treasury_balance: number;
  available_for_payouts: number;

  // Alerts
  pending_payout_requests: number;
  high_risk_payouts: number;
  failed_transactions_24h: number;
}

export default function AdminDashboardPage() {
  const { apiKey } = useAdminAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (apiKey) {
      loadDashboardStats();
    }
  }, [apiKey]);

  const loadDashboardStats = async () => {
    try {
      // Load basic user stats
      const usersResponse = await fetch('/api/admin/users?limit=1', {
        headers: { 'X-Admin-API-Key': apiKey! }
      });
      const usersData = await usersResponse.json();

      // Load merchant financial stats
      const financialsResponse = await fetch('/api/admin/merchants/financials?limit=1', {
        headers: { 'X-Admin-API-Key': apiKey! }
      });
      const financialsData = await financialsResponse.json();

      // Load treasury stats
      const treasuryResponse = await fetch('/api/admin/treasury/overview', {
        headers: { 'X-Admin-API-Key': apiKey! }
      });
      const treasuryData = await treasuryResponse.json();

      // Load pending payouts stats
      const payoutsResponse = await fetch('/api/admin/payouts/pending?limit=1', {
        headers: { 'X-Admin-API-Key': apiKey! }
      });
      const payoutsData = await payoutsResponse.json();

      // Combine all stats
      const combinedStats: DashboardStats = {
        total_users: usersData.total || 0,
        total_merchants: financialsData.summary?.total_merchants || 0,
        total_shoppers: usersData.total - (financialsData.summary?.total_merchants || 0),
        new_users_last_30_days: 0, // Would need additional API endpoint

        total_platform_sales: financialsData.summary?.total_platform_sales || 0,
        total_platform_commissions: financialsData.summary?.total_platform_commissions || 0,
        total_pending_payouts: financialsData.summary?.total_pending_payouts || 0,
        merchants_with_pending_payouts: financialsData.summary?.merchants_with_pending_payouts || 0,

        total_treasury_balance: treasuryData.metrics?.total_treasury_balance || 0,
        available_for_payouts: treasuryData.metrics?.available_for_payouts || 0,

        pending_payout_requests: payoutsData.summary?.total_pending_count || 0,
        high_risk_payouts: payoutsData.summary?.high_risk_count || 0,
        failed_transactions_24h: treasuryData.alerts?.failed_transactions_count || 0
      };

      setStats(combinedStats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast({
        title: "Error Loading Dashboard",
        description: "Unable to load dashboard statistics. Some data may be unavailable.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TAIC`;
  };

  console.log('[AdminDashboardPage] Rendering for /admin path.');
  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <header className="border-b pb-6">
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <LayoutDashboard className="mr-3 h-8 w-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Monitor platform performance and manage TAIC operations.
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-lg">Loading dashboard statistics...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Key Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.total_merchants || 0} merchants, {stats?.total_shoppers || 0} shoppers
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
                    {formatCurrency(stats?.total_platform_sales || 0)}
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
                    {formatCurrency(stats?.total_platform_commissions || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commission earnings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Treasury Balance</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(stats?.total_treasury_balance || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available: {formatCurrency(stats?.available_for_payouts || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>
            {/* Alerts and Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pending Actions */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                    Pending Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats?.pending_payout_requests && stats.pending_payout_requests > 0 ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-200">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">
                            {stats.pending_payout_requests} Payout Requests Pending
                          </p>
                          <p className="text-sm text-orange-600">
                            {stats.high_risk_payouts > 0 && `${stats.high_risk_payouts} high-risk requests require review`}
                          </p>
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link href="/admin/payouts/pending">
                          Review Now
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">All Payouts Processed</p>
                          <p className="text-sm text-green-600">No pending payout requests</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {stats?.failed_transactions_24h && stats.failed_transactions_24h > 0 && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50 border-red-200">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800">
                            {stats.failed_transactions_24h} Failed Transactions
                          </p>
                          <p className="text-sm text-red-600">In the last 24 hours</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Investigate
                      </Button>
                    </div>
                  )}

                  {stats?.merchants_with_pending_payouts && stats.merchants_with_pending_payouts > 0 && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800">
                            {stats.merchants_with_pending_payouts} Merchants Awaiting Payouts
                          </p>
                          <p className="text-sm text-blue-600">
                            Total pending: {formatCurrency(stats.total_pending_payouts)}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/merchants/financials">
                          View Details
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="mr-2 h-5 w-5 text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/admin/payouts/pending">
                      <Clock className="mr-2 h-4 w-4" />
                      Review Pending Payouts
                      {stats?.pending_payout_requests && stats.pending_payout_requests > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {stats.pending_payout_requests}
                        </Badge>
                      )}
                    </Link>
                  </Button>

                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/admin/treasury/overview">
                      <Wallet className="mr-2 h-4 w-4" />
                      Treasury Overview
                    </Link>
                  </Button>

                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/admin/merchants/financials">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Merchant Financials
                    </Link>
                  </Button>

                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/admin/users">
                      <Users className="mr-2 h-4 w-4" />
                      User Management
                    </Link>
                  </Button>

                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/admin/audit-log">
                      <Shield className="mr-2 h-4 w-4" />
                      Audit Log
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Financial Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Platform Sales</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(stats?.total_platform_sales || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Commission Revenue</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(stats?.total_platform_commissions || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pending Payouts</span>
                    <span className="text-lg font-bold text-orange-600">
                      {formatCurrency(stats?.total_pending_payouts || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-medium">Commission Rate</span>
                    <span className="text-lg font-bold">
                      {stats?.total_platform_sales && stats.total_platform_sales > 0
                        ? ((stats.total_platform_commissions / stats.total_platform_sales) * 100).toFixed(1)
                        : '0.0'
                      }%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wallet className="mr-2 h-5 w-5 text-blue-500" />
                    Treasury Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Treasury</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(stats?.total_treasury_balance || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Available for Payouts</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(stats?.available_for_payouts || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Utilization Rate</span>
                    <span className="text-lg font-bold">
                      {stats?.total_treasury_balance && stats.total_treasury_balance > 0
                        ? (((stats.total_treasury_balance - stats.available_for_payouts) / stats.total_treasury_balance) * 100).toFixed(1)
                        : '0.0'
                      }%
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/admin/treasury/overview">
                        <Eye className="mr-2 h-4 w-4" />
                        View Treasury Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
