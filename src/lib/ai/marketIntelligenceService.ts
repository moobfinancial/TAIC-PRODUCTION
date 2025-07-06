interface TrendingProduct {
  name: string;
  category: string;
  trendScore: number;
  searchVolume: number;
  growthRate: number;
  seasonality: 'stable' | 'seasonal' | 'trending';
  competitionLevel: 'low' | 'medium' | 'high';
  keywords: string[];
}

interface CompetitorAnalysis {
  competitors: CompetitorData[];
  pricingAnalysis: PricingAnalysis;
  marketPosition: MarketPosition;
  recommendations: string[];
}

interface CompetitorData {
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  keyFeatures: string[];
  marketShare?: number;
  url?: string;
}

interface PricingAnalysis {
  averagePrice: number;
  priceRange: [number, number];
  pricingStrategy: string;
  competitivePosition: string;
}

interface MarketPosition {
  pricePercentile: number;
  ratingPercentile: number;
  recommendedActions: string[];
}

interface SeasonalForecast {
  category: string;
  forecastPeriod: string;
  demandForecast: Array<{
    date: string;
    demandIndex: number;
    confidence: number;
    factors: string[];
  }>;
  seasonalPatterns: {
    peakMonths: number[];
    lowMonths: number[];
    averageVariation: number;
  };
  recommendations: string[];
}

interface MarketTrend {
  keyword: string;
  trendScore: number;
  searchVolume: number;
  growthRate: number;
  seasonality: string;
  competitionLevel: string;
  relatedKeywords: string[];
}

export class MarketIntelligenceService {
  private readonly GOOGLE_TRENDS_API_KEY = process.env.GOOGLE_TRENDS_API_KEY;
  private readonly SERP_API_KEY = process.env.SERP_API_KEY;

  async getTrendingProducts(category: string, timeframe: string = '30d'): Promise<TrendingProduct[]> {
    try {
      // Simulate trending products data (in production, integrate with Google Trends API)
      const mockTrendingProducts: TrendingProduct[] = [
        {
          name: 'Wireless Earbuds',
          category: 'Electronics',
          trendScore: 85,
          searchVolume: 125000,
          growthRate: 15.5,
          seasonality: 'stable',
          competitionLevel: 'high',
          keywords: ['wireless earbuds', 'bluetooth earphones', 'noise cancelling']
        },
        {
          name: 'Smart Fitness Tracker',
          category: 'Electronics',
          trendScore: 78,
          searchVolume: 89000,
          growthRate: 22.3,
          seasonality: 'seasonal',
          competitionLevel: 'medium',
          keywords: ['fitness tracker', 'smart watch', 'health monitor']
        },
        {
          name: 'Sustainable Water Bottle',
          category: 'Sports & Outdoors',
          trendScore: 72,
          searchVolume: 45000,
          growthRate: 35.7,
          seasonality: 'trending',
          competitionLevel: 'low',
          keywords: ['eco water bottle', 'sustainable bottle', 'reusable bottle']
        }
      ];

      // Filter by category if specified
      if (category && category !== 'all') {
        return mockTrendingProducts.filter(product => 
          product.category.toLowerCase() === category.toLowerCase()
        );
      }

      return mockTrendingProducts;

    } catch (error) {
      console.error('Error fetching trending products:', error);
      throw new Error('Failed to fetch trending products');
    }
  }

  async getCompetitorAnalysis(productName: string, category: string): Promise<CompetitorAnalysis> {
    try {
      // Simulate competitor analysis (in production, integrate with web scraping APIs)
      const mockCompetitors: CompetitorData[] = [
        {
          name: 'Sony WH-1000XM4',
          price: 349.99,
          rating: 4.5,
          reviewCount: 15420,
          keyFeatures: ['Noise Cancelling', '30hr Battery', 'Quick Charge'],
          marketShare: 15.2
        },
        {
          name: 'Bose QuietComfort 45',
          price: 329.99,
          rating: 4.3,
          reviewCount: 8930,
          keyFeatures: ['Active Noise Cancelling', 'Comfortable Fit', '24hr Battery'],
          marketShare: 12.8
        },
        {
          name: 'Apple AirPods Max',
          price: 549.99,
          rating: 4.4,
          reviewCount: 12100,
          keyFeatures: ['Spatial Audio', 'Premium Build', 'Apple Ecosystem'],
          marketShare: 18.5
        }
      ];

      const prices = mockCompetitors.map(c => c.price);
      const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const priceRange: [number, number] = [Math.min(...prices), Math.max(...prices)];

      const pricingAnalysis: PricingAnalysis = {
        averagePrice,
        priceRange,
        pricingStrategy: 'Premium positioning with feature differentiation',
        competitivePosition: 'Mid-range pricing opportunity'
      };

      const marketPosition: MarketPosition = {
        pricePercentile: 65,
        ratingPercentile: 70,
        recommendedActions: [
          'Consider highlighting unique features',
          'Price competitively in mid-range segment',
          'Focus on customer service to improve ratings'
        ]
      };

      return {
        competitors: mockCompetitors,
        pricingAnalysis,
        marketPosition,
        recommendations: [
          'Differentiate through unique features or superior customer service',
          'Consider bundle offers to increase value proposition',
          'Monitor competitor pricing changes monthly'
        ]
      };

    } catch (error) {
      console.error('Error analyzing competitors:', error);
      throw new Error('Failed to analyze competitors');
    }
  }

  async getSeasonalDemandForecast(category: string, timeframe: string = '90d'): Promise<SeasonalForecast> {
    try {
      // Generate forecast data based on historical patterns
      const forecastData = this.generateForecastData(category, timeframe);
      
      return {
        category,
        forecastPeriod: timeframe,
        demandForecast: forecastData,
        seasonalPatterns: this.getSeasonalPatterns(category),
        recommendations: this.generateSeasonalRecommendations(category, forecastData)
      };

    } catch (error) {
      console.error('Error generating seasonal forecast:', error);
      throw new Error('Failed to generate seasonal demand forecast');
    }
  }

  async getMarketTrends(category: string, timeframe: string = '30d'): Promise<MarketTrend[]> {
    try {
      // Simulate market trends data
      const mockTrends: MarketTrend[] = [
        {
          keyword: 'wireless earbuds',
          trendScore: 85,
          searchVolume: 125000,
          growthRate: 15.5,
          seasonality: 'stable',
          competitionLevel: 'high',
          relatedKeywords: ['bluetooth earphones', 'true wireless', 'noise cancelling earbuds']
        },
        {
          keyword: 'smart home devices',
          trendScore: 78,
          searchVolume: 89000,
          growthRate: 22.3,
          seasonality: 'growing',
          competitionLevel: 'medium',
          relatedKeywords: ['home automation', 'IoT devices', 'smart speakers']
        },
        {
          keyword: 'sustainable products',
          trendScore: 72,
          searchVolume: 67000,
          growthRate: 35.7,
          seasonality: 'trending',
          competitionLevel: 'low',
          relatedKeywords: ['eco-friendly', 'green products', 'sustainable living']
        }
      ];

      return mockTrends;

    } catch (error) {
      console.error('Error fetching market trends:', error);
      throw new Error('Failed to fetch market trends');
    }
  }

  async searchCompetitorPrices(productName: string): Promise<number[]> {
    try {
      // Simulate price scraping (in production, use proper APIs)
      const basePrices = [99.99, 129.99, 149.99, 179.99, 199.99];
      const variation = 0.2; // 20% variation
      
      return basePrices.map(price => {
        const randomVariation = (Math.random() - 0.5) * 2 * variation;
        return Math.round((price * (1 + randomVariation)) * 100) / 100;
      });

    } catch (error) {
      console.error('Error searching competitor prices:', error);
      return [];
    }
  }

  private generateForecastData(category: string, timeframe: string) {
    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const forecastData = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Generate demand index based on category and seasonality
      let demandIndex = 100; // Base demand
      
      // Add seasonal variation
      const month = date.getMonth();
      if (category.toLowerCase().includes('electronics')) {
        // Electronics peak in November-December (holiday season)
        if (month >= 10 || month <= 1) {
          demandIndex += 20;
        }
      } else if (category.toLowerCase().includes('sports')) {
        // Sports equipment peaks in spring/summer
        if (month >= 3 && month <= 8) {
          demandIndex += 15;
        }
      }
      
      // Add some randomness
      demandIndex += (Math.random() - 0.5) * 20;
      
      forecastData.push({
        date: date.toISOString().split('T')[0],
        demandIndex: Math.round(demandIndex),
        confidence: Math.round(85 + Math.random() * 10),
        factors: this.getDemandFactors(month, category)
      });
    }
    
    return forecastData;
  }

  private getSeasonalPatterns(category: string) {
    const patterns = {
      'Electronics': { peakMonths: [11, 12, 1], lowMonths: [2, 3, 4], averageVariation: 25 },
      'Clothing': { peakMonths: [9, 10, 11], lowMonths: [1, 2, 3], averageVariation: 30 },
      'Sports & Outdoors': { peakMonths: [4, 5, 6], lowMonths: [11, 12, 1], averageVariation: 35 },
      'Home & Garden': { peakMonths: [3, 4, 5], lowMonths: [11, 12, 1], averageVariation: 20 }
    };
    
    return patterns[category as keyof typeof patterns] || 
           { peakMonths: [11, 12], lowMonths: [2, 3], averageVariation: 15 };
  }

  private generateSeasonalRecommendations(category: string, forecastData: any[]): string[] {
    const recommendations = [
      'Increase inventory 2-3 weeks before peak demand periods',
      'Plan promotional campaigns during low-demand months',
      'Adjust pricing strategy based on seasonal demand patterns'
    ];
    
    // Add category-specific recommendations
    if (category.toLowerCase().includes('electronics')) {
      recommendations.push('Prepare for holiday season surge in Q4');
    } else if (category.toLowerCase().includes('sports')) {
      recommendations.push('Stock up for spring/summer outdoor activities');
    }
    
    return recommendations;
  }

  private getDemandFactors(month: number, category: string): string[] {
    const factors = [];
    
    // Seasonal factors
    if (month >= 10 || month <= 1) {
      factors.push('Holiday Season');
    }
    if (month >= 3 && month <= 5) {
      factors.push('Spring Season');
    }
    if (month >= 6 && month <= 8) {
      factors.push('Summer Season');
    }
    
    // Category-specific factors
    if (category.toLowerCase().includes('electronics')) {
      factors.push('New Product Launches');
    }
    if (category.toLowerCase().includes('sports')) {
      factors.push('Outdoor Activity Season');
    }
    
    return factors;
  }
}
