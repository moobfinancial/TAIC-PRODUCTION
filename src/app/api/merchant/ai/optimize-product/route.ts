import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { ProductOptimizationEngine } from '@/lib/ai/productOptimizationEngine';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface OptimizationRequest {
  productId?: string;
  optimizationType: 'title_optimization' | 'description_enhancement' | 'pricing_suggestion' | 'category_optimization';
  options: {
    currentTitle?: string;
    currentDescription?: string;
    targetKeywords?: string[];
    targetAudience?: string;
    features?: string[];
    benefits?: string[];
    includeCompetitors?: boolean;
    targetMargin?: number;
  };
}

async function optimizeProduct(req: NextRequest, merchantUser: any) {
  try {
    const body: OptimizationRequest = await req.json();
    const { productId, optimizationType, options } = body;

    if (!optimizationType) {
      return NextResponse.json(
        { error: 'Optimization type is required' },
        { status: 400 }
      );
    }

    const requestId = uuidv4();
    const optimizationEngine = new ProductOptimizationEngine();
    
    const client = await pool.connect();
    
    try {
      // Store optimization request in database
      await client.query(`
        INSERT INTO ai_optimization_requests (
          id, merchant_id, product_id, optimization_type, input_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        requestId,
        merchantUser.id,
        productId || null,
        optimizationType,
        JSON.stringify(options),
        'processing'
      ]);

      let result;
      const startTime = Date.now();

      try {
        switch (optimizationType) {
          case 'title_optimization':
            if (!options.currentTitle) {
              throw new Error('Current title is required for title optimization');
            }
            result = await optimizationEngine.optimizeProductTitle(
              options.currentTitle,
              'Electronics', // Default category, should be fetched from product data
              options.targetKeywords || [],
              options.targetAudience
            );
            break;

          case 'description_enhancement':
            if (!options.currentDescription) {
              throw new Error('Current description is required for description enhancement');
            }
            result = await optimizationEngine.enhanceProductDescription(
              options.currentDescription,
              options.features || [],
              options.benefits || [],
              options.targetAudience || 'General consumers',
              options.targetKeywords || []
            );
            break;

          case 'pricing_suggestion':
            // Mock product data for pricing analysis
            const productData = {
              id: productId || 'mock-product',
              name: 'Sample Product',
              description: 'Sample description',
              category: 'Electronics',
              currentPrice: 99.99,
              images: [],
              attributes: {}
            };
            
            const competitorPrices = [89.99, 109.99, 119.99, 94.99, 104.99];
            const marketData = {
              demandScore: 75,
              competitorCount: 5,
              averagePrice: 103.99,
              seasonalTrends: []
            };
            
            result = await optimizationEngine.suggestOptimalPricing(
              productData,
              competitorPrices,
              marketData
            );
            break;

          case 'category_optimization':
            // Mock implementation for category optimization
            result = {
              currentCategory: 'Electronics',
              recommendations: [
                {
                  category: 'Audio & Electronics',
                  reasoning: 'Better alignment with product features',
                  confidence: 85,
                  expectedImprovement: 15
                }
              ]
            };
            break;

          default:
            throw new Error(`Unsupported optimization type: ${optimizationType}`);
        }

        const processingTime = Date.now() - startTime;
        const confidence = this.calculateConfidenceScore(result);

        // Update request with results
        await client.query(`
          UPDATE ai_optimization_requests 
          SET 
            status = 'completed',
            results = $1,
            confidence_score = $2,
            processing_time_ms = $3
          WHERE id = $4
        `, [
          JSON.stringify(result),
          confidence,
          processingTime,
          requestId
        ]);

        // Store suggestions in separate table for detailed tracking
        if (result.suggestions) {
          for (const suggestion of result.suggestions) {
            await client.query(`
              INSERT INTO ai_content_suggestions (
                optimization_request_id,
                suggestion_type,
                original_content,
                suggested_content,
                improvement_score,
                reasoning
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              requestId,
              optimizationType,
              options.currentTitle || options.currentDescription || '',
              suggestion.content || JSON.stringify(suggestion),
              suggestion.score || confidence,
              suggestion.reasoning || ''
            ]);
          }
        }

        return NextResponse.json({
          requestId,
          status: 'completed',
          optimizationType,
          results: result,
          confidence,
          processingTime,
          completedAt: new Date().toISOString()
        });

      } catch (optimizationError) {
        // Update request status to failed
        await client.query(`
          UPDATE ai_optimization_requests 
          SET status = 'failed'
          WHERE id = $1
        `, [requestId]);

        throw optimizationError;
      }

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('AI optimization error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Optimization failed'
    }, { status: 500 });
  }
}

// Helper function to calculate confidence score
function calculateConfidenceScore(result: any): number {
  if (result.confidenceScore) return result.confidenceScore;
  if (result.confidence) return result.confidence;
  if (result.suggestions && result.suggestions.length > 0) {
    const avgScore = result.suggestions.reduce((sum: number, s: any) => sum + (s.score || 80), 0) / result.suggestions.length;
    return Math.round(avgScore);
  }
  return 80; // Default confidence
}

export const POST = withMerchantAuth(optimizeProduct);
