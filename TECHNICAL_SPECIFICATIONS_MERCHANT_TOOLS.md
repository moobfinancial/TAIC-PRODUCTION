# Technical Specifications: Advanced Merchant Tools Implementation

## 🏗️ **System Architecture Overview**

### **Enhanced Merchant Ecosystem Architecture**
```
┌─────────────────────────────────────────────────────────────────┐
│                    TAIC Merchant Empowerment Platform           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Layer (Next.js 14 + TypeScript)                      │
│  ├── Bulk Upload Interface                                     │
│  ├── AI Optimization Dashboard                                 │
│  ├── Advertising Campaign Manager                              │
│  └── Market Intelligence Portal                                │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway Layer (Next.js API Routes)                        │
│  ├── Merchant Tools APIs                                       │
│  ├── AI Service Integration                                    │
│  ├── Advertising Management APIs                               │
│  └── Analytics & Reporting APIs                                │
├─────────────────────────────────────────────────────────────────┤
│  AI Services Layer                                             │
│  ├── OpenAI GPT-4 Integration                                  │
│  ├── Google Gemini Pro Integration                             │
│  ├── Custom ML Models                                          │
│  └── External API Integrations                                 │
├─────────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                          │
│  ├── Product Optimization Engine                               │
│  ├── Market Intelligence Service                               │
│  ├── Advertising Placement Algorithm                           │
│  └── Inventory Management System                               │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (PostgreSQL + Redis)                               │
│  ├── Enhanced Product Schema                                   │
│  ├── Advertising Campaign Data                                 │
│  ├── Market Intelligence Cache                                 │
│  └── AI Training Data Storage                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 **1. Bulk Upload System - Technical Specifications**

### **Frontend Implementation**

#### **A. Main Upload Interface Component**
```typescript
// src/app/merchant/products/bulk-upload/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useBulkUpload } from '@/hooks/useBulkUpload';
import { CSVValidator } from '@/lib/csvValidator';

interface BulkUploadPageProps {}

export default function BulkUploadPage() {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { uploadCSV, generateTemplate } = useBulkUpload();
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setUploadState('validating');
    
    // Client-side validation
    const validator = new CSVValidator();
    const validation = await validator.validateFile(file);
    
    if (validation.isValid) {
      setUploadState('uploading');
      await uploadCSV(file, {
        onProgress: setUploadProgress,
        onComplete: handleUploadComplete,
        onError: handleUploadError
      });
    } else {
      setValidationResults(validation.errors);
      setUploadState('validation-failed');
    }
  }, [uploadCSV]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024 // 50MB limit
  });
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Upload Interface */}
      <UploadDropzone 
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        uploadState={uploadState}
      />
      
      {/* Progress Tracking */}
      {uploadState === 'uploading' && (
        <ProgressTracker progress={uploadProgress} />
      )}
      
      {/* Validation Results */}
      {validationResults.length > 0 && (
        <ValidationResults 
          results={validationResults}
          onFixErrors={handleFixErrors}
        />
      )}
      
      {/* Template Generator */}
      <TemplateGenerator onGenerate={generateTemplate} />
      
      {/* Upload History */}
      <UploadHistory />
    </div>
  );
}
```

#### **B. CSV Validation Service**
```typescript
// src/lib/csvValidator.ts
export class CSVValidator {
  private requiredHeaders = [
    'product_handle',
    'product_name', 
    'variant_sku',
    'variant_stock_quantity'
  ];
  
  private optionalHeaders = [
    'product_description',
    'product_category',
    'product_base_price',
    'product_image_url',
    'variant_specific_price',
    'variant_image_url',
    'variant_attribute_1_name',
    'variant_attribute_1_value',
    'variant_attribute_2_name',
    'variant_attribute_2_value',
    'cashback_percentage',
    'is_active'
  ];
  
  async validateFile(file: File): Promise<ValidationResult> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const errors: ValidationError[] = [];
    
    // Header validation
    const missingHeaders = this.requiredHeaders.filter(
      header => !headers.includes(header)
    );
    
    if (missingHeaders.length > 0) {
      errors.push({
        type: 'MISSING_HEADERS',
        message: `Missing required headers: ${missingHeaders.join(', ')}`,
        row: 0,
        severity: 'error'
      });
    }
    
    // Row validation
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const rowErrors = this.validateRow(row, headers, i + 1);
      errors.push(...rowErrors);
    }
    
    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings: errors.filter(e => e.severity === 'warning'),
      rowCount: lines.length - 1
    };
  }
  
  private validateRow(row: string[], headers: string[], rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Product handle validation
    const handleIndex = headers.indexOf('product_handle');
    if (handleIndex >= 0 && !row[handleIndex]?.trim()) {
      errors.push({
        type: 'MISSING_PRODUCT_HANDLE',
        message: 'Product handle is required',
        row: rowNumber,
        column: 'product_handle',
        severity: 'error'
      });
    }
    
    // Price validation
    const priceIndex = headers.indexOf('product_base_price');
    if (priceIndex >= 0 && row[priceIndex]) {
      const price = parseFloat(row[priceIndex]);
      if (isNaN(price) || price < 0) {
        errors.push({
          type: 'INVALID_PRICE',
          message: 'Price must be a valid positive number',
          row: rowNumber,
          column: 'product_base_price',
          severity: 'error'
        });
      }
    }
    
    // Stock quantity validation
    const stockIndex = headers.indexOf('variant_stock_quantity');
    if (stockIndex >= 0 && row[stockIndex]) {
      const stock = parseInt(row[stockIndex]);
      if (isNaN(stock) || stock < 0) {
        errors.push({
          type: 'INVALID_STOCK',
          message: 'Stock quantity must be a valid non-negative integer',
          row: rowNumber,
          column: 'variant_stock_quantity',
          severity: 'error'
        });
      }
    }
    
    return errors;
  }
}
```

#### **C. Upload Hook Implementation**
```typescript
// src/hooks/useBulkUpload.ts
import { useState, useCallback } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (result: BulkUploadResult) => void;
  onError?: (error: Error) => void;
}

export function useBulkUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadSession[]>([]);
  const { authenticatedRequest } = useMerchantAuth();
  
  const uploadCSV = useCallback(async (
    file: File, 
    options: UploadOptions = {}
  ) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        validateOnly: false,
        autoApprove: false
      }));
      
      // Create upload session
      const sessionResponse = await authenticatedRequest('/api/merchant/bulk-upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          expectedRows: await estimateRowCount(file)
        })
      });
      
      const session = await sessionResponse.json();
      
      // Upload file with progress tracking
      const uploadResponse = await authenticatedRequest('/api/merchant/bulk-upload/process', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progress) => {
          options.onProgress?.(progress);
        }
      });
      
      const result = await uploadResponse.json();
      
      if (result.success) {
        options.onComplete?.(result);
        setUploadHistory(prev => [session, ...prev]);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
    } catch (error) {
      options.onError?.(error as Error);
    } finally {
      setIsUploading(false);
    }
  }, [authenticatedRequest]);
  
  const generateTemplate = useCallback(async (options: TemplateOptions) => {
    const response = await authenticatedRequest('/api/merchant/bulk-upload/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `taic-product-template-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [authenticatedRequest]);
  
  return {
    uploadCSV,
    generateTemplate,
    isUploading,
    uploadHistory
  };
}
```

### **Backend API Enhancements**

#### **A. Upload Session Management**
```typescript
// src/app/api/merchant/bulk-upload/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { v4 as uuidv4 } from 'uuid';

async function createUploadSession(req: NextRequest, merchantUser: any) {
  const body = await req.json();
  const { filename, fileSize, expectedRows } = body;
  
  const sessionId = uuidv4();
  
  // Store session in database
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO bulk_upload_sessions (
        id, merchant_id, filename, file_size, expected_rows, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [sessionId, merchantUser.id, filename, fileSize, expectedRows, 'created']);
    
    return NextResponse.json({
      sessionId,
      status: 'created',
      createdAt: new Date().toISOString()
    });
    
  } finally {
    client.release();
  }
}

export const POST = withMerchantAuth(createUploadSession);
```

#### **B. Enhanced Processing Endpoint**
```typescript
// src/app/api/merchant/bulk-upload/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { BulkUploadProcessor } from '@/lib/bulkUploadProcessor';

async function processUpload(req: NextRequest, merchantUser: any) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const options = JSON.parse(formData.get('options') as string);
  
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  
  const processor = new BulkUploadProcessor(merchantUser.id);
  
  try {
    const result = await processor.processFile(file, {
      ...options,
      onProgress: (progress) => {
        // Emit progress via WebSocket or Server-Sent Events
        emitProgress(merchantUser.id, progress);
      }
    });
    
    return NextResponse.json({
      success: true,
      uploadId: result.uploadId,
      summary: result.summary,
      errors: result.errors,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export const POST = withMerchantAuth(processUpload);
```

### **Database Schema Enhancements**

```sql
-- Enhanced bulk upload tracking
CREATE TABLE bulk_upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    expected_rows INTEGER,
    actual_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    error_summary JSONB,
    processing_options JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Detailed error tracking
CREATE TABLE bulk_upload_errors (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES bulk_upload_sessions(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    field_name VARCHAR(100),
    field_value TEXT,
    severity VARCHAR(10) NOT NULL DEFAULT 'error',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Upload performance metrics
CREATE TABLE bulk_upload_metrics (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES bulk_upload_sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_unit VARCHAR(20),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bulk_upload_sessions_merchant ON bulk_upload_sessions(merchant_id);
CREATE INDEX idx_bulk_upload_sessions_status ON bulk_upload_sessions(status);
CREATE INDEX idx_bulk_upload_errors_session ON bulk_upload_errors(session_id);
CREATE INDEX idx_bulk_upload_errors_type ON bulk_upload_errors(error_type);
```

---

## 🤖 **2. AI-Powered Product Optimization - Technical Specifications**

### **A. Product Optimization Engine**
```typescript
// src/lib/ai/productOptimizationEngine.ts
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class ProductOptimizationEngine {
  private openai: OpenAI;
  private gemini: GoogleGenerativeAI;
  
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  }
  
  async optimizeProductTitle(
    currentTitle: string,
    category: string,
    keywords: string[],
    targetAudience?: string
  ): Promise<TitleOptimization> {
    const prompt = `
      Optimize this product title for SEO and conversion:
      Current Title: "${currentTitle}"
      Category: ${category}
      Target Keywords: ${keywords.join(', ')}
      Target Audience: ${targetAudience || 'General'}
      
      Provide 3 optimized title variations that:
      1. Include primary keywords naturally
      2. Are compelling and click-worthy
      3. Follow e-commerce best practices
      4. Are under 60 characters for SEO
      
      Return as JSON with explanations for each suggestion.
    `;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  async enhanceProductDescription(
    currentDescription: string,
    productFeatures: string[],
    benefits: string[],
    targetAudience: string
  ): Promise<DescriptionEnhancement> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
      Enhance this product description for better conversion:
      Current Description: "${currentDescription}"
      Key Features: ${productFeatures.join(', ')}
      Key Benefits: ${benefits.join(', ')}
      Target Audience: ${targetAudience}
      
      Create an enhanced description that:
      1. Leads with benefits, not just features
      2. Uses persuasive copywriting techniques
      3. Includes emotional triggers
      4. Has clear structure with bullet points
      5. Ends with a compelling call-to-action
      
      Provide the enhanced description and explain the improvements made.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return {
      enhancedDescription: response.text(),
      improvements: this.extractImprovements(response.text()),
      readabilityScore: await this.calculateReadabilityScore(response.text()),
      seoScore: await this.calculateSEOScore(response.text())
    };
  }
  
  async suggestOptimalPricing(
    productData: ProductData,
    competitorPrices: number[],
    marketData: MarketData
  ): Promise<PricingSuggestion> {
    // Implement pricing optimization algorithm
    const basePrice = productData.currentPrice;
    const avgCompetitorPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
    const demandMultiplier = marketData.demandScore / 100;
    
    const suggestions = [
      {
        strategy: 'competitive',
        price: avgCompetitorPrice * 0.95,
        reasoning: 'Price slightly below average competitor to gain market share',
        expectedImpact: '+15% conversion rate'
      },
      {
        strategy: 'premium',
        price: avgCompetitorPrice * 1.15,
        reasoning: 'Premium pricing for quality positioning',
        expectedImpact: '+25% profit margin'
      },
      {
        strategy: 'dynamic',
        price: basePrice * demandMultiplier,
        reasoning: 'Demand-based pricing optimization',
        expectedImpact: '+20% revenue'
      }
    ];
    
    return {
      currentPrice: basePrice,
      marketAverage: avgCompetitorPrice,
      suggestions,
      confidence: this.calculatePricingConfidence(marketData),
      lastUpdated: new Date()
    };
  }
  
  async optimizeProductCategories(
    productData: ProductData,
    performanceData: CategoryPerformance[]
  ): Promise<CategoryOptimization> {
    // Analyze category performance and suggest optimal categorization
    const currentCategory = productData.category;
    const categoryPerformance = performanceData.find(p => p.category === currentCategory);
    
    const betterCategories = performanceData
      .filter(p => p.conversionRate > categoryPerformance?.conversionRate)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 3);
    
    return {
      currentCategory,
      currentPerformance: categoryPerformance,
      recommendations: betterCategories.map(cat => ({
        category: cat.category,
        expectedImprovement: cat.conversionRate - categoryPerformance?.conversionRate,
        reasoning: `Higher conversion rate (${cat.conversionRate}% vs ${categoryPerformance?.conversionRate}%)`,
        confidence: this.calculateCategoryConfidence(productData, cat)
      }))
    };
  }
}
```

### **B. Market Intelligence Service**
```typescript
// src/lib/ai/marketIntelligenceService.ts
export class MarketIntelligenceService {
  async getTrendingProducts(category: string, timeframe: string = '30d'): Promise<TrendingProduct[]> {
    // Integration with Google Trends API
    const trendsData = await this.fetchGoogleTrends(category, timeframe);
    
    // Integration with social media APIs
    const socialTrends = await this.fetchSocialMediaTrends(category);
    
    // Combine and analyze data
    return this.analyzeTrends(trendsData, socialTrends);
  }
  
  async getCompetitorAnalysis(productName: string): Promise<CompetitorAnalysis> {
    // Web scraping for competitor pricing (with proper rate limiting)
    const competitorData = await this.scrapeCompetitorData(productName);
    
    // Analyze pricing patterns
    const pricingAnalysis = this.analyzePricingPatterns(competitorData);
    
    return {
      competitors: competitorData,
      pricingAnalysis,
      marketPosition: this.calculateMarketPosition(competitorData),
      recommendations: this.generateCompetitorRecommendations(pricingAnalysis)
    };
  }
  
  async getSeasonalDemandForecast(category: string): Promise<SeasonalForecast> {
    // Historical sales data analysis
    const historicalData = await this.getHistoricalSalesData(category);
    
    // External seasonal data
    const seasonalPatterns = await this.getSeasonalPatterns(category);
    
    // Machine learning prediction
    return this.predictSeasonalDemand(historicalData, seasonalPatterns);
  }
}
```

This technical specification provides the detailed implementation roadmap for the advanced merchant tools. The architecture is designed to be scalable, maintainable, and integrated with the existing TAIC platform infrastructure.
