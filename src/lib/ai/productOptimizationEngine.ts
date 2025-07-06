import { OpenAI } from 'openai';

interface OptimizationSuggestion {
  content: string;
  score: number;
  reasoning: string;
  improvements: string[];
  keywordDensity?: Record<string, number>;
  seoScore?: number;
  readabilityScore?: number;
}

interface TitleOptimization {
  suggestions: OptimizationSuggestion[];
  originalContent: string;
  confidenceScore: number;
}

interface DescriptionEnhancement {
  enhancedDescription: string;
  improvements: string[];
  readabilityScore: number;
  seoScore: number;
  keywordOptimization: Record<string, number>;
}

interface PricingSuggestion {
  strategy: 'competitive' | 'premium' | 'dynamic' | 'value';
  price: number;
  reasoning: string;
  expectedImpact: string;
  confidence: number;
}

interface PricingRecommendations {
  currentPrice: number;
  marketAverage: number;
  suggestions: PricingSuggestion[];
  confidence: number;
  lastUpdated: Date;
}

interface CategoryOptimization {
  currentCategory: string;
  currentPerformance?: any;
  recommendations: Array<{
    category: string;
    expectedImprovement: number;
    reasoning: string;
    confidence: number;
  }>;
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  category: string;
  currentPrice: number;
  images: string[];
  attributes: Record<string, any>;
}

interface MarketData {
  demandScore: number;
  competitorCount: number;
  averagePrice: number;
  seasonalTrends: any[];
}

export class ProductOptimizationEngine {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async optimizeProductTitle(
    currentTitle: string,
    category: string,
    keywords: string[],
    targetAudience?: string
  ): Promise<TitleOptimization> {
    try {
      const prompt = `
        As an e-commerce optimization expert, optimize this product title for maximum conversion and SEO:

        Current Title: "${currentTitle}"
        Category: ${category}
        Target Keywords: ${keywords.join(', ')}
        Target Audience: ${targetAudience || 'General consumers'}

        Requirements:
        1. Include primary keywords naturally
        2. Make it compelling and click-worthy
        3. Follow e-commerce best practices
        4. Keep under 60 characters for SEO
        5. Highlight key benefits or features

        Provide 3 optimized title variations with explanations.
        Return as JSON with this structure:
        {
          "suggestions": [
            {
              "content": "optimized title",
              "score": 85,
              "reasoning": "explanation of improvements",
              "improvements": ["specific improvement 1", "specific improvement 2"],
              "keywordDensity": {"keyword1": 1, "keyword2": 1}
            }
          ],
          "confidenceScore": 90
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        ...result,
        originalContent: currentTitle
      };

    } catch (error) {
      console.error('Title optimization error:', error);
      throw new Error('Failed to optimize product title');
    }
  }

  async enhanceProductDescription(
    currentDescription: string,
    productFeatures: string[],
    benefits: string[],
    targetAudience: string,
    keywords: string[] = []
  ): Promise<DescriptionEnhancement> {
    try {
      const prompt = `
        As an expert copywriter, enhance this product description for better conversion:

        Current Description: "${currentDescription}"
        Key Features: ${productFeatures.join(', ')}
        Key Benefits: ${benefits.join(', ')}
        Target Audience: ${targetAudience}
        SEO Keywords: ${keywords.join(', ')}

        Requirements:
        1. Lead with benefits, not just features
        2. Use persuasive copywriting techniques
        3. Include emotional triggers
        4. Structure with bullet points for readability
        5. Naturally incorporate SEO keywords
        6. End with a compelling call-to-action
        7. Keep between 150-300 words

        Return as JSON:
        {
          "enhancedDescription": "improved description",
          "improvements": ["improvement 1", "improvement 2"],
          "keywordOptimization": {"keyword1": 2, "keyword2": 1},
          "readabilityScore": 85,
          "seoScore": 90
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result;

    } catch (error) {
      console.error('Description enhancement error:', error);
      throw new Error('Failed to enhance product description');
    }
  }

  async suggestOptimalPricing(
    productData: ProductData,
    competitorPrices: number[],
    marketData: MarketData
  ): Promise<PricingRecommendations> {
    try {
      const avgCompetitorPrice = competitorPrices.length > 0 
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length 
        : productData.currentPrice;

      const demandMultiplier = marketData.demandScore / 100;
      
      const suggestions: PricingSuggestion[] = [
        {
          strategy: 'competitive',
          price: Math.round(avgCompetitorPrice * 0.95 * 100) / 100,
          reasoning: 'Price slightly below average competitor to gain market share',
          expectedImpact: '+15% conversion rate',
          confidence: 85
        },
        {
          strategy: 'premium',
          price: Math.round(avgCompetitorPrice * 1.15 * 100) / 100,
          reasoning: 'Premium pricing for quality positioning and higher margins',
          expectedImpact: '+25% profit margin',
          confidence: 70
        },
        {
          strategy: 'dynamic',
          price: Math.round(productData.currentPrice * demandMultiplier * 100) / 100,
          reasoning: 'Demand-based pricing optimization using market intelligence',
          expectedImpact: '+20% revenue',
          confidence: 80
        },
        {
          strategy: 'value',
          price: Math.round(avgCompetitorPrice * 0.85 * 100) / 100,
          reasoning: 'Value pricing to maximize volume and market penetration',
          expectedImpact: '+30% sales volume',
          confidence: 75
        }
      ];

      return {
        currentPrice: productData.currentPrice,
        marketAverage: avgCompetitorPrice,
        suggestions,
        confidence: this.calculatePricingConfidence(marketData),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Pricing optimization error:', error);
      throw new Error('Failed to generate pricing recommendations');
    }
  }

  async optimizeProductCategories(
    productData: ProductData,
    performanceData: any[]
  ): Promise<CategoryOptimization> {
    try {
      const prompt = `
        Analyze this product and suggest optimal category placement:

        Product: ${productData.name}
        Description: ${productData.description}
        Current Category: ${productData.category}
        Available Categories: Electronics, Clothing, Home & Garden, Sports & Outdoors, Health & Beauty, Books & Media, Toys & Games, Automotive, Food & Beverages, Office Supplies

        Consider:
        1. Product features and use cases
        2. Target audience alignment
        3. Search behavior patterns
        4. Competition levels in each category

        Return as JSON:
        {
          "recommendations": [
            {
              "category": "suggested category",
              "reasoning": "why this category is better",
              "confidence": 85,
              "expectedImprovement": 15
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        currentCategory: productData.category,
        recommendations: result.recommendations || []
      };

    } catch (error) {
      console.error('Category optimization error:', error);
      throw new Error('Failed to optimize product categories');
    }
  }

  async generateSEOKeywords(
    productName: string,
    description: string,
    category: string
  ): Promise<string[]> {
    try {
      const prompt = `
        Generate SEO keywords for this product:

        Product: ${productName}
        Description: ${description}
        Category: ${category}

        Generate 10-15 relevant keywords including:
        1. Primary keywords (product type)
        2. Long-tail keywords (specific features)
        3. Intent-based keywords (buying intent)
        4. Competitor keywords

        Return as JSON array: ["keyword1", "keyword2", ...]
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.keywords || [];

    } catch (error) {
      console.error('SEO keyword generation error:', error);
      throw new Error('Failed to generate SEO keywords');
    }
  }

  private calculatePricingConfidence(marketData: MarketData): number {
    // Calculate confidence based on market data quality
    let confidence = 50; // Base confidence
    
    if (marketData.competitorCount > 5) confidence += 20;
    if (marketData.demandScore > 70) confidence += 15;
    if (marketData.seasonalTrends.length > 0) confidence += 15;
    
    return Math.min(confidence, 95);
  }

  private calculateCategoryConfidence(productData: ProductData, categoryData: any): number {
    // Calculate confidence based on product-category alignment
    let confidence = 60; // Base confidence
    
    // Add logic for category confidence calculation
    if (productData.description.length > 100) confidence += 10;
    if (productData.attributes && Object.keys(productData.attributes).length > 3) confidence += 10;
    
    return Math.min(confidence, 90);
  }
}
