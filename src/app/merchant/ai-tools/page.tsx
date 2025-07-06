'use client';

import React, { useState, useEffect } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Lightbulb,
  BarChart3,
  Zap,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Search,
  PenTool,
  Tag,
  Globe
} from 'lucide-react';

interface OptimizationResult {
  type: string;
  suggestions: any[];
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ProductSelection {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
}

export default function AIToolsPage() {
  const { isAuthenticated, loading } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);
  const [optimizationResults, setOptimizationResults] = useState<Record<string, OptimizationResult>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('product-optimization');

  // Form states
  const [titleOptimization, setTitleOptimization] = useState({
    productId: '',
    currentTitle: '',
    keywords: '',
    targetAudience: ''
  });

  const [descriptionOptimization, setDescriptionOptimization] = useState({
    productId: '',
    currentDescription: '',
    features: '',
    benefits: '',
    targetAudience: ''
  });

  const [pricingAnalysis, setPricingAnalysis] = useState({
    productId: '',
    includeCompetitors: true,
    targetMargin: 25
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load merchant products
  useEffect(() => {
    if (isAuthenticated) {
      loadMerchantProducts();
    }
  }, [isAuthenticated]);

  const loadMerchantProducts = async () => {
    try {
      // Mock product data - in production, fetch from API
      const mockProducts: ProductSelection[] = [
        { id: '1', name: 'Wireless Bluetooth Headphones', category: 'Electronics', currentPrice: 99.99 },
        { id: '2', name: 'Smart Fitness Tracker', category: 'Electronics', currentPrice: 149.99 },
        { id: '3', name: 'Eco-Friendly Water Bottle', category: 'Sports & Outdoors', currentPrice: 24.99 }
      ];
      setSelectedProducts(mockProducts);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    }
  };

  const handleTitleOptimization = async () => {
    if (!titleOptimization.currentTitle) {
      toast({
        title: "Missing Information",
        description: "Please enter the current product title",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    const requestId = `title-${Date.now()}`;
    
    setOptimizationResults(prev => ({
      ...prev,
      [requestId]: { type: 'title', suggestions: [], confidence: 0, status: 'processing' }
    }));

    try {
      const response = await fetch('/api/merchant/ai/optimize-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('merchantToken')}`
        },
        body: JSON.stringify({
          productId: titleOptimization.productId,
          optimizationType: 'title_optimization',
          options: {
            currentTitle: titleOptimization.currentTitle,
            targetKeywords: titleOptimization.keywords.split(',').map(k => k.trim()),
            targetAudience: titleOptimization.targetAudience
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Simulate processing delay
        setTimeout(() => {
          setOptimizationResults(prev => ({
            ...prev,
            [requestId]: {
              type: 'title',
              suggestions: [
                {
                  content: 'Premium Wireless Bluetooth Headphones - Noise Cancelling & 30Hr Battery',
                  score: 92,
                  reasoning: 'Added premium positioning, key features, and benefit-focused language',
                  improvements: ['Added "Premium" for positioning', 'Highlighted key benefits', 'Optimized for SEO']
                },
                {
                  content: 'Wireless Bluetooth Headphones with Active Noise Cancellation',
                  score: 88,
                  reasoning: 'Clear feature focus with technical specification',
                  improvements: ['Technical accuracy', 'Feature-focused', 'Search-friendly']
                }
              ],
              confidence: 92,
              status: 'completed'
            }
          }));
          
          toast({
            title: "Optimization Complete",
            description: "Title suggestions generated successfully"
          });
        }, 2000);
      }
    } catch (error) {
      setOptimizationResults(prev => ({
        ...prev,
        [requestId]: { type: 'title', suggestions: [], confidence: 0, status: 'failed' }
      }));
      
      toast({
        title: "Optimization Failed",
        description: "Unable to generate title suggestions",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDescriptionOptimization = async () => {
    if (!descriptionOptimization.currentDescription) {
      toast({
        title: "Missing Information",
        description: "Please enter the current product description",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    const requestId = `description-${Date.now()}`;
    
    setOptimizationResults(prev => ({
      ...prev,
      [requestId]: { type: 'description', suggestions: [], confidence: 0, status: 'processing' }
    }));

    try {
      // Simulate API call
      setTimeout(() => {
        setOptimizationResults(prev => ({
          ...prev,
          [requestId]: {
            type: 'description',
            suggestions: [{
              enhancedDescription: `Experience premium audio quality with our advanced wireless headphones. Featuring industry-leading noise cancellation technology, these headphones deliver crystal-clear sound while blocking out distractions.

Key Benefits:
• 30-hour battery life for all-day listening
• Active noise cancellation for immersive audio
• Quick charge: 10 minutes = 5 hours of playback
• Comfortable over-ear design for extended wear
• Premium materials with sleek, modern styling

Perfect for professionals, students, and music enthusiasts who demand superior audio quality. Whether you're working from home, commuting, or relaxing, these headphones adapt to your lifestyle.

Order now and transform your audio experience with premium wireless technology.`,
              improvements: [
                'Lead with key benefit (premium audio quality)',
                'Added bullet points for better readability',
                'Included emotional triggers and lifestyle benefits',
                'Strong call-to-action at the end'
              ],
              readabilityScore: 88,
              seoScore: 85
            }],
            confidence: 89,
            status: 'completed'
          }
        }));
        
        toast({
          title: "Description Enhanced",
          description: "Optimized description generated successfully"
        });
      }, 3000);
    } catch (error) {
      setOptimizationResults(prev => ({
        ...prev,
        [requestId]: { type: 'description', suggestions: [], confidence: 0, status: 'failed' }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePricingAnalysis = async () => {
    setIsProcessing(true);
    const requestId = `pricing-${Date.now()}`;
    
    setOptimizationResults(prev => ({
      ...prev,
      [requestId]: { type: 'pricing', suggestions: [], confidence: 0, status: 'processing' }
    }));

    try {
      // Simulate pricing analysis
      setTimeout(() => {
        setOptimizationResults(prev => ({
          ...prev,
          [requestId]: {
            type: 'pricing',
            suggestions: [
              {
                strategy: 'competitive',
                price: 89.99,
                reasoning: 'Price 10% below market average to gain market share',
                expectedImpact: '+15% conversion rate',
                confidence: 85
              },
              {
                strategy: 'premium',
                price: 119.99,
                reasoning: 'Premium pricing for quality positioning',
                expectedImpact: '+25% profit margin',
                confidence: 78
              },
              {
                strategy: 'dynamic',
                price: 94.99,
                reasoning: 'Demand-based pricing optimization',
                expectedImpact: '+20% revenue',
                confidence: 82
              }
            ],
            confidence: 85,
            status: 'completed'
          }
        }));
        
        toast({
          title: "Pricing Analysis Complete",
          description: "Pricing recommendations generated"
        });
      }, 2500);
    } catch (error) {
      setOptimizationResults(prev => ({
        ...prev,
        [requestId]: { type: 'pricing', suggestions: [], confidence: 0, status: 'failed' }
      }));
    } finally {
      setIsProcessing(false);
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
            <Brain className="mr-3 h-8 w-8 text-primary" />
            AI-Powered Merchant Tools
          </h1>
          <p className="text-muted-foreground mt-1">
            Optimize your products with artificial intelligence
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="flex items-center">
            <Sparkles className="mr-1 h-3 w-3" />
            AI Powered
          </Badge>
        </div>
      </div>

      {/* AI Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="product-optimization" className="flex items-center">
            <Target className="mr-2 h-4 w-4" />
            Product Optimization
          </TabsTrigger>
          <TabsTrigger value="pricing-analysis" className="flex items-center">
            <DollarSign className="mr-2 h-4 w-4" />
            Pricing Analysis
          </TabsTrigger>
          <TabsTrigger value="market-intelligence" className="flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            Market Intelligence
          </TabsTrigger>
          <TabsTrigger value="content-generation" className="flex items-center">
            <PenTool className="mr-2 h-4 w-4" />
            Content Generation
          </TabsTrigger>
        </TabsList>

        {/* Product Optimization Tab */}
        <TabsContent value="product-optimization" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Title Optimization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="mr-2 h-5 w-5" />
                  Title Optimization
                </CardTitle>
                <CardDescription>
                  Optimize product titles for better SEO and conversion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="current-title">Current Title</Label>
                  <Input
                    id="current-title"
                    value={titleOptimization.currentTitle}
                    onChange={(e) => setTitleOptimization(prev => ({ ...prev, currentTitle: e.target.value }))}
                    placeholder="Enter current product title"
                  />
                </div>
                <div>
                  <Label htmlFor="keywords">Target Keywords (comma-separated)</Label>
                  <Input
                    id="keywords"
                    value={titleOptimization.keywords}
                    onChange={(e) => setTitleOptimization(prev => ({ ...prev, keywords: e.target.value }))}
                    placeholder="wireless, bluetooth, headphones"
                  />
                </div>
                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Select value={titleOptimization.targetAudience} onValueChange={(value) => setTitleOptimization(prev => ({ ...prev, targetAudience: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Consumers</SelectItem>
                      <SelectItem value="professionals">Professionals</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="gamers">Gamers</SelectItem>
                      <SelectItem value="fitness">Fitness Enthusiasts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleTitleOptimization} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Optimize Title
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Description Enhancement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PenTool className="mr-2 h-5 w-5" />
                  Description Enhancement
                </CardTitle>
                <CardDescription>
                  Enhance product descriptions for better conversion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="current-description">Current Description</Label>
                  <Textarea
                    id="current-description"
                    value={descriptionOptimization.currentDescription}
                    onChange={(e) => setDescriptionOptimization(prev => ({ ...prev, currentDescription: e.target.value }))}
                    placeholder="Enter current product description"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="features">Key Features (comma-separated)</Label>
                  <Input
                    id="features"
                    value={descriptionOptimization.features}
                    onChange={(e) => setDescriptionOptimization(prev => ({ ...prev, features: e.target.value }))}
                    placeholder="noise cancelling, 30hr battery, quick charge"
                  />
                </div>
                <div>
                  <Label htmlFor="benefits">Key Benefits (comma-separated)</Label>
                  <Input
                    id="benefits"
                    value={descriptionOptimization.benefits}
                    onChange={(e) => setDescriptionOptimization(prev => ({ ...prev, benefits: e.target.value }))}
                    placeholder="crystal clear audio, all-day comfort, premium quality"
                  />
                </div>
                <Button 
                  onClick={handleDescriptionOptimization} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Enhance Description
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Display */}
          {Object.entries(optimizationResults).map(([requestId, result]) => (
            <Card key={requestId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{result.type} Optimization Results</span>
                  {result.status === 'completed' && (
                    <Badge variant="default" className="flex items-center">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {result.confidence}% Confidence
                    </Badge>
                  )}
                  {result.status === 'processing' && (
                    <Badge variant="secondary" className="flex items-center">
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      Processing...
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.status === 'processing' && (
                  <div className="space-y-2">
                    <Progress value={66} className="w-full" />
                    <p className="text-sm text-muted-foreground">AI is analyzing your product...</p>
                  </div>
                )}
                
                {result.status === 'completed' && result.suggestions.length > 0 && (
                  <div className="space-y-4">
                    {result.type === 'title' && result.suggestions.map((suggestion, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Score: {suggestion.score}/100</Badge>
                        </div>
                        <p className="font-medium mb-2">{suggestion.content}</p>
                        <p className="text-sm text-muted-foreground mb-2">{suggestion.reasoning}</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.improvements.map((improvement: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {improvement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {result.type === 'description' && result.suggestions.map((suggestion, index) => (
                      <div key={index} className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">Enhanced Description:</h4>
                          <div className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                            {suggestion.enhancedDescription}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium">Readability Score</div>
                            <div className="text-2xl font-bold text-blue-600">{suggestion.readabilityScore}/100</div>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-sm font-medium">SEO Score</div>
                            <div className="text-2xl font-bold text-green-600">{suggestion.seoScore}/100</div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Improvements Made:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {suggestion.improvements.map((improvement: string, i: number) => (
                              <li key={i}>{improvement}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Pricing Analysis Tab */}
        <TabsContent value="pricing-analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                AI Pricing Analysis
              </CardTitle>
              <CardDescription>
                Get intelligent pricing recommendations based on market data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="product-select">Select Product</Label>
                <Select value={pricingAnalysis.productId} onValueChange={(value) => setPricingAnalysis(prev => ({ ...prev, productId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${product.currentPrice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Label htmlFor="target-margin">Target Margin (%)</Label>
                  <Input
                    id="target-margin"
                    type="number"
                    value={pricingAnalysis.targetMargin}
                    onChange={(e) => setPricingAnalysis(prev => ({ ...prev, targetMargin: parseInt(e.target.value) }))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <Button 
                onClick={handlePricingAnalysis} 
                disabled={isProcessing || !pricingAnalysis.productId}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analyze Pricing
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Pricing Results */}
          {Object.entries(optimizationResults)
            .filter(([_, result]) => result.type === 'pricing' && result.status === 'completed')
            .map(([requestId, result]) => (
              <Card key={requestId}>
                <CardHeader>
                  <CardTitle>Pricing Recommendations</CardTitle>
                  <CardDescription>
                    AI-generated pricing strategies based on market analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {result.suggestions.map((suggestion: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="capitalize">
                            {suggestion.strategy} Strategy
                          </Badge>
                          <div className="text-2xl font-bold text-green-600">
                            ${suggestion.price}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {suggestion.reasoning}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-600">
                            {suggestion.expectedImpact}
                          </span>
                          <Badge variant="secondary">
                            {suggestion.confidence}% Confidence
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* Market Intelligence Tab */}
        <TabsContent value="market-intelligence" className="space-y-6">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              Market Intelligence features are coming soon! Get insights on trending products, competitor analysis, and demand forecasting.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Content Generation Tab */}
        <TabsContent value="content-generation" className="space-y-6">
          <Alert>
            <PenTool className="h-4 w-4" />
            <AlertDescription>
              Content Generation tools are coming soon! Generate marketing copy, social media posts, and SEO content automatically.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
