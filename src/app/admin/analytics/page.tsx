'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Download,
  Calendar,
  Target,
  Trophy,
  AlertTriangle,
  CheckCircle,
  Bot,
  Building
} from 'lucide-react';

interface PlatformAnalyticsData {
  overview: {
    totalMerchants: number;
    activeMerchants: number;
    newMerchants30d: number;
    totalRevenue: number;
    totalCommissions: number;
    totalOrders: number;
    averagePerformanceScore: number;
    merchantGrowthRate: number;
    automationAdoptionRate: number;
  };
  merchantDistribution: {
    byTier: Record<string, { count: number; averageRevenue: number; averageOrders: number }>;
    byAutomationLevel: Record<string, number>;
  };
  topPerformers: Array<{
    merchantId: string;
    email: string;
    businessName: string;
    performanceScore: number;
    totalRevenue: number;
    totalOrders: number;
    fulfillmentRate: number;
    automationLevel: string;
    accountAgeDays: number;
  }>;
  trends: {
    merchantGrowth: Array<{
      month: string;
      newMerchants: number;
      cumulativeMerchants: number;
    }>;
  } | null;
  lastUpdated: string;
}

export default function AdminAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        topPerformers: 'true',
        trends: 'true',
        limit: '10'
      });

      const response = await fetch(`/api/admin/analytics/platform?${params}`, {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();
      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load analytics data');
      }
    } catch (error: any) {
      console.error('Error loading analytics data:', error);
      toast({
        title: "Failed to Load Analytics",
        description: error.message || "Unable to load platform analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData(true);
  };

  const handleRecalculateMetrics = async () => {
    try {
      const response = await fetch('/api/admin/analytics/platform', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'recalculate_daily_metrics'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate metrics');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Metrics Recalculated",
          description: result.message,
        });
        await loadAnalyticsData(true);
      } else {
        throw new Error(result.error || 'Failed to recalculate metrics');
      }
    } catch (error: any) {
      console.error('Error recalculating metrics:', error);
      toast({
        title: "Failed to Recalculate Metrics",
        description: error.message || "Unable to recalculate platform metrics",
        variant: "destructive",
      });
    }
  };

  const formatValue = (value: number, format?: string): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      default:
        return value.toString();
    }
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'DIAMOND': return 'bg-blue-100 text-blue-800';
      case 'PLATINUM': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      case 'SILVER': return 'bg-gray-100 text-gray-600';
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAutomationColor = (level: string): string => {
    switch (level) {
      case 'FULL': return 'bg-green-100 text-green-800';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
      case 'MANUAL_REVIEW': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading platform analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to Load Analytics</AlertTitle>
          <AlertDescription>
            There was an error loading platform analytics. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { overview, merchantDistribution, topPerformers } = analyticsData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights into platform performance and merchant activity
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleRecalculateMetrics}
            className="flex items-center space-x-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Recalculate Metrics</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Platform Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Merchants</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatValue(overview.totalMerchants, 'number')}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-600">
                    {overview.activeMerchants} active
                  </span>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Platform Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatValue(overview.totalRevenue, 'currency')}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">
                    +{overview.merchantGrowthRate.toFixed(1)}% growth
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatValue(overview.totalOrders, 'number')}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-600">
                    Across all merchants
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <ShoppingCart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {overview.averagePerformanceScore.toFixed(1)}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-600">
                    Platform average
                  </span>
                </div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Trophy className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Merchant Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Merchant Tier Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(merchantDistribution.byTier).map(([tier, data]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge className={getTierColor(tier)}>
                        {tier}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {data.count} merchants
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatValue(data.averageRevenue, 'currency')}
                      </div>
                      <div className="text-xs text-gray-500">avg revenue</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Automation Adoption */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="h-5 w-5" />
                  <span>Automation Adoption</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-green-600">
                    {overview.automationAdoptionRate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600">Overall adoption rate</p>
                </div>
                {Object.entries(merchantDistribution.byAutomationLevel).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge className={getAutomationColor(level)}>
                        {level.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{count}</div>
                      <div className="text-xs text-gray-500">merchants</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Top Performing Merchants</span>
              </CardTitle>
              <CardDescription>
                Highest performing merchants by overall score and revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.map((merchant, index) => (
                  <div key={merchant.merchantId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium">{merchant.businessName || merchant.email}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{merchant.email}</span>
                          <span>•</span>
                          <span>{merchant.accountAgeDays} days old</span>
                          <span>•</span>
                          <Badge className={getAutomationColor(merchant.automationLevel)} variant="outline">
                            {merchant.automationLevel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        Score: {merchant.performanceScore.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatValue(merchant.totalRevenue, 'currency')} • {merchant.totalOrders} orders
                      </div>
                      <div className="text-sm text-gray-600">
                        {merchant.fulfillmentRate.toFixed(1)}% fulfillment
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add other tab contents as needed */}
      </Tabs>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(analyticsData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
