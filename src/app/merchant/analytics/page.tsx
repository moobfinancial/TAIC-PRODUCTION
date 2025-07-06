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
  DollarSign,
  ShoppingCart,
  Package,
  Bot,
  CreditCard,
  Trophy,
  AlertTriangle,
  CheckCircle,
  Target,
  Lightbulb,
  RefreshCw,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';

interface MerchantPerformanceData {
  performance: any;
  insights: any[];
  comparison: any[];
  lastUpdated: string;
}

interface PerformanceMetric {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  format?: 'currency' | 'percentage' | 'number';
}

export default function MerchantAnalyticsPage() {
  const [performanceData, setPerformanceData] = useState<MerchantPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async (forceRefresh = false) => {
    try {
      setLoading(true);

      const token = localStorage.getItem('merchantToken');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view analytics",
          variant: "destructive",
        });
        return;
      }

      const params = new URLSearchParams({
        insights: 'true',
        comparison: 'true'
      });

      if (forceRefresh) {
        params.append('refresh', 'true');
      }

      const response = await fetch(`/api/merchant/analytics/performance?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const result = await response.json();
      if (result.success) {
        setPerformanceData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load performance data');
      }
    } catch (error: any) {
      console.error('Error loading performance data:', error);
      toast({
        title: "Failed to Load Analytics",
        description: error.message || "Unable to load performance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPerformanceData(true);
  };

  const formatValue = (value: number | string, format?: string): string => {
    if (typeof value === 'string') return value;

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

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'OPPORTUNITY': return <Target className="h-4 w-4 text-blue-600" />;
      case 'RECOMMENDATION': return <Lightbulb className="h-4 w-4 text-purple-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getInsightColor = (type: string): string => {
    switch (type) {
      case 'WARNING': return 'border-yellow-200 bg-yellow-50';
      case 'SUCCESS': return 'border-green-200 bg-green-50';
      case 'OPPORTUNITY': return 'border-blue-200 bg-blue-50';
      case 'RECOMMENDATION': return 'border-purple-200 bg-purple-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading performance analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!performanceData) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to Load Analytics</AlertTitle>
          <AlertDescription>
            There was an error loading your performance data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { performance, insights, comparison } = performanceData;

  const keyMetrics: PerformanceMetric[] = [
    {
      label: 'Total Revenue',
      value: performance.financial.totalRevenue,
      change: performance.financial.revenueGrowth,
      format: 'currency'
    },
    {
      label: 'Monthly Revenue',
      value: performance.financial.monthlyRevenue,
      change: performance.financial.revenueGrowth,
      format: 'currency'
    },
    {
      label: 'Total Orders',
      value: performance.orders.totalOrders,
      change: performance.orders.orderGrowth,
      format: 'number'
    },
    {
      label: 'Fulfillment Rate',
      value: performance.orders.fulfillmentRate,
      format: 'percentage'
    },
    {
      label: 'Performance Score',
      value: performance.platform.performanceScore,
      format: 'number'
    },
    {
      label: 'Platform Rank',
      value: `#${performance.platform.platformRank}`,
    }
  ];
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Analytics</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights into your merchant performance
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
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {keyMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatValue(metric.value, metric.format)}
                  </p>
                  {metric.change !== undefined && (
                    <div className="flex items-center mt-2">
                      {metric.change > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                      ) : metric.change < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                      ) : null}
                      <span className={`text-sm ${
                        metric.change > 0 ? 'text-green-600' :
                        metric.change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  {index === 0 && <DollarSign className="h-6 w-6 text-blue-600" />}
                  {index === 1 && <TrendingUp className="h-6 w-6 text-blue-600" />}
                  {index === 2 && <ShoppingCart className="h-6 w-6 text-blue-600" />}
                  {index === 3 && <Package className="h-6 w-6 text-blue-600" />}
                  {index === 4 && <BarChart3 className="h-6 w-6 text-blue-600" />}
                  {index === 5 && <Trophy className="h-6 w-6 text-blue-600" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Merchant Tier and Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Merchant Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <Badge className={`text-lg px-4 py-2 ${getTierColor(performance.platform.merchantTier)}`}>
                {performance.platform.merchantTier}
              </Badge>
              <p className="text-sm text-gray-600 mt-2">Merchant Tier</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {performance.platform.performanceScore.toFixed(1)}
              </div>
              <p className="text-sm text-gray-600">Performance Score</p>
              <Progress value={performance.platform.performanceScore} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                #{performance.platform.platformRank}
              </div>
              <p className="text-sm text-gray-600">Platform Rank</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                Top {performance.platform.percentile.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600">Percentile</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Financial Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Financial Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-semibold">{formatValue(performance.financial.totalRevenue, 'currency')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Net Earnings</span>
                  <span className="font-semibold">{formatValue(performance.financial.netEarnings, 'currency')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Commission Rate</span>
                  <span className="font-semibold">{formatValue(performance.financial.commissionRate, 'percentage')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Available Balance</span>
                  <span className="font-semibold">{formatValue(performance.financial.availableBalance, 'currency')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Order Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span>Order Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Orders</span>
                  <span className="font-semibold">{formatValue(performance.orders.totalOrders, 'number')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Fulfillment Rate</span>
                  <span className="font-semibold">{formatValue(performance.orders.fulfillmentRate, 'percentage')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg Processing Time</span>
                  <span className="font-semibold">{performance.orders.averageProcessingTime.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Recent Orders (30d)</span>
                  <span className="font-semibold">{formatValue(performance.orders.recentOrders, 'number')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
  
          {/* Automation Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>Automation Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {performance.automation.riskScore}
                  </div>
                  <p className="text-sm text-gray-600">Risk Score</p>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="text-sm">
                    {performance.automation.automationLevel}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-1">Automation Level</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatValue(performance.automation.automationRate, 'percentage')}
                  </div>
                  <p className="text-sm text-gray-600">Automation Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${performance.automation.automationSavings}
                  </div>
                  <p className="text-sm text-gray-600">Cost Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {insights && insights.length > 0 ? (
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <Alert key={index} className={getInsightColor(insight.type)}>
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <AlertTitle className="flex items-center justify-between">
                        <span>{insight.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.impact} IMPACT
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="mt-2">
                        {insight.description}
                        {insight.recommendation && (
                          <div className="mt-2 p-3 bg-white/50 rounded border-l-4 border-blue-500">
                            <p className="text-sm font-medium text-blue-800">Recommendation:</p>
                            <p className="text-sm text-blue-700">{insight.recommendation}</p>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
                <p className="text-gray-600">
                  No performance insights or recommendations at this time. Keep up the great work!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Add other tab contents as needed */}
      </Tabs>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(performanceData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
