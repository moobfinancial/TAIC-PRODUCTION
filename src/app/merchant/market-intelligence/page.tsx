'use client';

import React, { useState, useEffect } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  Target, 
  DollarSign,
  Users,
  Search,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe,
  ShoppingCart,
  Star
} from 'lucide-react';

interface TrendData {
  keyword: string;
  trendScore: number;
  searchVolume: number;
  growthRate: number;
  seasonality: string;
  competitionLevel: string;
}

interface CompetitorData {
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  marketShare: number;
}

interface DemandForecast {
  date: string;
  demandIndex: number;
  confidence: number;
  factors: string[];
}

export default function MarketIntelligencePage() {
  const { isAuthenticated, loading } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedCategory, setSelectedCategory] = useState('Electronics');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [competitorData, setCompetitorData] = useState<CompetitorData[]>([]);
  const [demandForecast, setDemandForecast] = useState<DemandForecast[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      loadMarketData();
    }
  }, [isAuthenticated, selectedCategory, selectedTimeframe]);

  const loadMarketData = async () => {
    setIsLoading(true);
    try {
      // Simulate API calls - in production, these would be real API endpoints
      await Promise.all([
        loadTrendData(),
        loadCompetitorData(),
        loadDemandForecast()
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load market intelligence data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrendData = async () => {
    // Mock trend data
    const mockTrends: TrendData[] = [
      {
        keyword: 'wireless earbuds',
        trendScore: 85,
        searchVolume: 125000,
        growthRate: 15.5,
        seasonality: 'stable',
        competitionLevel: 'high'
      },
      {
        keyword: 'smart home devices',
        trendScore: 78,
        searchVolume: 89000,
        growthRate: 22.3,
        seasonality: 'growing',
        competitionLevel: 'medium'
      },
      {
        keyword: 'fitness trackers',
        trendScore: 72,
        searchVolume: 67000,
        growthRate: -5.2,
        seasonality: 'seasonal',
        competitionLevel: 'high'
      },
      {
        keyword: 'sustainable tech',
        trendScore: 68,
        searchVolume: 45000,
        growthRate: 35.7,
        seasonality: 'trending',
        competitionLevel: 'low'
      }
    ];
    setTrendData(mockTrends);
  };

  const loadCompetitorData = async () => {
    // Mock competitor data
    const mockCompetitors: CompetitorData[] = [
      { name: 'Sony WH-1000XM4', price: 349.99, rating: 4.5, reviewCount: 15420, marketShare: 15.2 },
      { name: 'Bose QuietComfort 45', price: 329.99, rating: 4.3, reviewCount: 8930, marketShare: 12.8 },
      { name: 'Apple AirPods Max', price: 549.99, rating: 4.4, reviewCount: 12100, marketShare: 18.5 },
      { name: 'Sennheiser Momentum 4', price: 299.99, rating: 4.2, reviewCount: 5670, marketShare: 8.3 },
      { name: 'Audio-Technica ATH-M50x', price: 149.99, rating: 4.6, reviewCount: 23450, marketShare: 11.7 }
    ];
    setCompetitorData(mockCompetitors);
  };

  const loadDemandForecast = async () => {
    // Generate mock forecast data
    const forecast: DemandForecast[] = [];
    const baseDate = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      
      let demandIndex = 100 + Math.sin(i * 0.2) * 20 + Math.random() * 10;
      if (i > 20) demandIndex += 15; // Holiday boost
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        demandIndex: Math.round(demandIndex),
        confidence: Math.round(85 + Math.random() * 10),
        factors: i > 20 ? ['Holiday Season', 'Increased Marketing'] : ['Normal Demand']
      });
    }
    setDemandForecast(forecast);
  };

  const getTrendIcon = (growthRate: number) => {
    if (growthRate > 10) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (growthRate < -5) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getCompetitionColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <BarChart3 className="mr-3 h-8 w-8 text-primary" />
            Market Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered market insights and competitive analysis
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Electronics">Electronics</SelectItem>
              <SelectItem value="Clothing">Clothing</SelectItem>
              <SelectItem value="Home & Garden">Home & Garden</SelectItem>
              <SelectItem value="Sports & Outdoors">Sports & Outdoors</SelectItem>
              <SelectItem value="Health & Beauty">Health & Beauty</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="1y">1 year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadMarketData} disabled={isLoading}>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Market Intelligence Tabs */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends" className="flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            Market Trends
          </TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center">
            <Target className="mr-2 h-4 w-4" />
            Competitor Analysis
          </TabsTrigger>
          <TabsTrigger value="demand" className="flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            Demand Forecast
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center">
            <Search className="mr-2 h-4 w-4" />
            Opportunities
          </TabsTrigger>
        </TabsList>

        {/* Market Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Search Volume</p>
                    <p className="text-2xl font-bold">326K</p>
                  </div>
                  <Search className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-green-600">+12.5%</span> from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Trending Keywords</p>
                    <p className="text-2xl font-bold">24</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-green-600">+8</span> new trending terms
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Competition</p>
                    <p className="text-2xl font-bold">Medium</p>
                  </div>
                  <Target className="h-8 w-8 text-yellow-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Good opportunity level
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Growth Rate</p>
                    <p className="text-2xl font-bold">+18.2%</p>
                  </div>
                  <ArrowUpRight className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Category average growth
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trending Keywords</CardTitle>
              <CardDescription>
                Top performing keywords in {selectedCategory} category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendData.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(trend.growthRate)}
                        <span className="font-medium">{trend.keyword}</span>
                      </div>
                      <Badge className={getCompetitionColor(trend.competitionLevel)}>
                        {trend.competitionLevel} competition
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{trend.searchVolume.toLocaleString()}</div>
                        <div className="text-muted-foreground">searches</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${trend.growthRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trend.growthRate > 0 ? '+' : ''}{trend.growthRate}%
                        </div>
                        <div className="text-muted-foreground">growth</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{trend.trendScore}</div>
                        <div className="text-muted-foreground">score</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitor Analysis Tab */}
        <TabsContent value="competitors" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Market Price</p>
                    <p className="text-2xl font-bold">$335.99</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on top 5 competitors
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                    <p className="text-2xl font-bold">4.4</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Market standard rating
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                    <p className="text-2xl font-bold">65.6K</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Combined review count
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Competitive Landscape</CardTitle>
              <CardDescription>
                Analysis of top competitors in your category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {competitorData.map((competitor, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{competitor.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {competitor.reviewCount.toLocaleString()} reviews
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="font-medium">${competitor.price}</div>
                        <div className="text-xs text-muted-foreground">Price</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium flex items-center">
                          <Star className="h-3 w-3 text-yellow-500 mr-1" />
                          {competitor.rating}
                        </div>
                        <div className="text-xs text-muted-foreground">Rating</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{competitor.marketShare}%</div>
                        <div className="text-xs text-muted-foreground">Market Share</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand Forecast Tab */}
        <TabsContent value="demand" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>30-Day Demand Forecast</CardTitle>
              <CardDescription>
                AI-powered demand prediction for {selectedCategory}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2 text-xs text-center font-medium text-muted-foreground">
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                  <div>Sun</div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {demandForecast.slice(0, 28).map((forecast, index) => {
                    const intensity = Math.min(forecast.demandIndex / 120, 1);
                    const bgColor = `rgba(59, 130, 246, ${intensity * 0.8 + 0.1})`;
                    
                    return (
                      <div
                        key={index}
                        className="aspect-square rounded p-1 text-xs text-center flex flex-col justify-center cursor-pointer hover:scale-105 transition-transform"
                        style={{ backgroundColor: bgColor }}
                        title={`${forecast.date}: ${forecast.demandIndex} demand index (${forecast.confidence}% confidence)`}
                      >
                        <div className="font-medium text-white">
                          {new Date(forecast.date).getDate()}
                        </div>
                        <div className="text-xs text-white/80">
                          {forecast.demandIndex}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-200 rounded"></div>
                    <span>Low Demand</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Medium Demand</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-800 rounded"></div>
                    <span>High Demand</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Peak Season</span>
                    <Badge variant="default">Nov - Jan</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Low Season</span>
                    <Badge variant="secondary">Feb - Apr</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Variation</span>
                    <span className="text-sm font-medium">±25%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="outline">Holiday Season</Badge>
                  <Badge variant="outline">New Product Launches</Badge>
                  <Badge variant="outline">Back to School</Badge>
                  <Badge variant="outline">Black Friday</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Market Opportunities</CardTitle>
                <CardDescription>
                  AI-identified opportunities in your category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Sustainable Tech Products</h4>
                      <Badge variant="default">High Potential</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Growing demand for eco-friendly electronics with 35% growth rate
                    </p>
                    <div className="flex items-center text-sm">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span>Low competition, high search volume</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Smart Home Integration</h4>
                      <Badge variant="secondary">Medium Potential</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Increasing interest in connected devices and automation
                    </p>
                    <div className="flex items-center text-sm">
                      <BarChart3 className="h-4 w-4 text-blue-500 mr-1" />
                      <span>Medium competition, growing market</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>
                  Strategic recommendations based on market analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Expand sustainable product line</p>
                      <p className="text-xs text-muted-foreground">Target eco-conscious consumers with green alternatives</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Optimize for holiday season</p>
                      <p className="text-xs text-muted-foreground">Increase inventory and marketing for Q4 demand surge</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Monitor competitor pricing</p>
                      <p className="text-xs text-muted-foreground">Stay competitive with dynamic pricing strategies</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
