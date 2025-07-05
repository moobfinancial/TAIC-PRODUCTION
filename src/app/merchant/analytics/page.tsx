'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart, 
  DollarSign,
  Eye,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Package
} from 'lucide-react';
import Link from 'next/link';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

// Analytics interfaces
interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  totalCustomers: number;
  returningCustomers: number;
  pageViews: number;
  productViews: number;
}

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

interface ProductPerformance {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  views: number;
  conversionRate: number;
  category: string;
}

interface CustomerDemographics {
  ageGroup: string;
  percentage: number;
  count: number;
}

interface ConversionFunnel {
  stage: string;
  visitors: number;
  conversionRate: number;
}

export default function MerchantAnalyticsPage() {
  const { merchant, isAuthenticated, loading, token } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [customerDemographics, setCustomerDemographics] = useState<CustomerDemographics[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load analytics data
  useEffect(() => {
    if (isAuthenticated && token) {
      loadAnalyticsData();
    }
  }, [isAuthenticated, token, timeRange]);

  const loadAnalyticsData = async () => {
    setIsLoadingData(true);
    try {
      // TODO: Replace with real API calls
      // For now, using mock data to establish UI patterns
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock analytics summary
      setAnalyticsSummary({
        totalRevenue: 15847.50,
        totalOrders: 127,
        conversionRate: 3.2,
        averageOrderValue: 124.78,
        totalCustomers: 89,
        returningCustomers: 23,
        pageViews: 4567,
        productViews: 2834
      });

      // Mock sales data for the last 30 days
      const mockSalesData: SalesData[] = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        mockSalesData.push({
          date: date.toISOString().split('T')[0],
          revenue: Math.random() * 800 + 200,
          orders: Math.floor(Math.random() * 8) + 2,
          customers: Math.floor(Math.random() * 6) + 1
        });
      }
      setSalesData(mockSalesData);

      // Mock product performance data
      setProductPerformance([
        {
          id: 'prod_001',
          name: 'Premium Wireless Headphones',
          revenue: 4567.80,
          orders: 38,
          views: 456,
          conversionRate: 8.3,
          category: 'Electronics'
        },
        {
          id: 'prod_002',
          name: 'Smart Fitness Watch',
          revenue: 3245.60,
          orders: 27,
          views: 389,
          conversionRate: 6.9,
          category: 'Wearables'
        },
        {
          id: 'prod_003',
          name: 'Bluetooth Speaker',
          revenue: 2890.40,
          orders: 34,
          views: 523,
          conversionRate: 6.5,
          category: 'Audio'
        },
        {
          id: 'prod_004',
          name: 'Wireless Charging Pad',
          revenue: 1876.20,
          orders: 28,
          views: 298,
          conversionRate: 9.4,
          category: 'Accessories'
        }
      ]);

      // Mock customer demographics
      setCustomerDemographics([
        { ageGroup: '18-24', percentage: 15, count: 13 },
        { ageGroup: '25-34', percentage: 35, count: 31 },
        { ageGroup: '35-44', percentage: 28, count: 25 },
        { ageGroup: '45-54', percentage: 15, count: 13 },
        { ageGroup: '55+', percentage: 7, count: 7 }
      ]);

      // Mock conversion funnel
      setConversionFunnel([
        { stage: 'Page Views', visitors: 4567, conversionRate: 100 },
        { stage: 'Product Views', visitors: 2834, conversionRate: 62.1 },
        { stage: 'Add to Cart', visitors: 456, conversionRate: 16.1 },
        { stage: 'Checkout Started', visitors: 189, conversionRate: 41.4 },
        { stage: 'Orders Completed', visitors: 127, conversionRate: 67.2 }
      ]);

    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast({
        title: "Error Loading Analytics",
        description: "Unable to load your analytics data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExportData = async () => {
    try {
      // TODO: Implement real export functionality
      toast({
        title: "Export Started",
        description: "Your analytics report is being generated and will be emailed to you shortly.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export analytics data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Show loading state while checking authentication
  if (loading || !merchant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
    orders: {
      label: "Orders",
      color: "hsl(var(--chart-2))",
    },
    customers: {
      label: "Customers",
      color: "hsl(var(--chart-3))",
    },
  };

  const demographicsColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <BarChart3 className="mr-3 h-8 w-8 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track your store performance, sales trends, and customer insights.
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading analytics data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Performance Indicators */}
          {analyticsSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsSummary.totalRevenue.toFixed(2)} TAIC
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +12.5% from last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsSummary.totalOrders}</div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +8.2% from last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsSummary.conversionRate}%</div>
                  <div className="flex items-center text-xs text-red-600 mt-1">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    -0.3% from last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsSummary.averageOrderValue.toFixed(2)} TAIC
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +5.1% from last period
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="conversion">Conversion</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Sales Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Sales Trends
                  </CardTitle>
                  <CardDescription>
                    Revenue, orders, and customer trends over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[400px]">
                    <LineChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-revenue)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-revenue)" }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="orders"
                        stroke="var(--color-orders)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-orders)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Additional Metrics */}
              {analyticsSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analyticsSummary.totalCustomers}</div>
                      <p className="text-xs text-muted-foreground">
                        {analyticsSummary.returningCustomers} returning customers
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analyticsSummary.pageViews.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        {analyticsSummary.productViews.toLocaleString()} product views
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {((analyticsSummary.returningCustomers / analyticsSummary.totalCustomers) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Customer retention rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">View-to-Purchase</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {((analyticsSummary.totalOrders / analyticsSummary.productViews) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Product view conversion
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    Top Performing Products
                  </CardTitle>
                  <CardDescription>
                    Your best-selling products by revenue and conversion rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {productPerformance.map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">#{index + 1}</span>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium">{product.name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Category: {product.category}</span>
                              <span>•</span>
                              <span>{product.views} views</span>
                              <span>•</span>
                              <span>{product.orders} orders</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-lg">
                            {product.revenue.toFixed(2)} TAIC
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={product.conversionRate > 7 ? "default" : "secondary"}>
                              {product.conversionRate}% conversion
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Product Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Product Revenue Comparison</CardTitle>
                  <CardDescription>
                    Revenue breakdown by product category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={productPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Customers Tab */}
            <TabsContent value="customers" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Customer Demographics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Customer Demographics
                    </CardTitle>
                    <CardDescription>
                      Age distribution of your customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <PieChart>
                        <Pie
                          data={customerDemographics}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ ageGroup, percentage }) => `${ageGroup}: ${percentage}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="percentage"
                        >
                          {customerDemographics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={demographicsColors[index % demographicsColors.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Customer Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Insights</CardTitle>
                    <CardDescription>
                      Key metrics about your customer base
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {customerDemographics.map((demo, index) => (
                      <div key={demo.ageGroup} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: demographicsColors[index] }}
                          ></div>
                          <span className="font-medium">{demo.ageGroup} years</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{demo.count} customers</div>
                          <div className="text-sm text-muted-foreground">{demo.percentage}%</div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {analyticsSummary?.totalCustomers || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Customers</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {analyticsSummary ?
                              ((analyticsSummary.returningCustomers / analyticsSummary.totalCustomers) * 100).toFixed(1)
                              : 0}%
                          </div>
                          <div className="text-sm text-muted-foreground">Return Rate</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Conversion Tab */}
            <TabsContent value="conversion" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="mr-2 h-5 w-5" />
                    Conversion Funnel
                  </CardTitle>
                  <CardDescription>
                    Track how visitors move through your sales funnel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {conversionFunnel.map((stage, index) => (
                      <div key={stage.stage} className="relative">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">{index + 1}</span>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium">{stage.stage}</h4>
                              <p className="text-sm text-muted-foreground">
                                {stage.visitors.toLocaleString()} visitors
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-lg">
                              {stage.conversionRate.toFixed(1)}%
                            </div>
                            {index > 0 && (
                              <div className="text-sm text-muted-foreground">
                                {((stage.visitors / conversionFunnel[index - 1].visitors) * 100).toFixed(1)}% from previous
                              </div>
                            )}
                          </div>
                        </div>
                        {index < conversionFunnel.length - 1 && (
                          <div className="flex justify-center py-2">
                            <div className="w-px h-4 bg-border"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Optimization Tips */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-800">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Conversion Optimization Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-blue-700">
                  <ul className="space-y-2 text-sm">
                    <li>• Optimize product images and descriptions to increase product view conversion</li>
                    <li>• Simplify the checkout process to reduce cart abandonment</li>
                    <li>• Use customer reviews and ratings to build trust</li>
                    <li>• Implement exit-intent popups with special offers</li>
                    <li>• A/B test different product page layouts and call-to-action buttons</li>
                    <li>• Offer multiple payment options including TAIC Coin for lower fees</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
