# TAIC Merchant Tools API Documentation
## Advanced Merchant Empowerment & AI-Powered Tools

### 🔐 **Authentication**
All merchant tool APIs require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <merchant_jwt_token>
```

---

## 📦 **1. Bulk Upload API Endpoints**

### **POST /api/merchant/bulk-upload/session**
Create a new bulk upload session for tracking progress.

**Request Body:**
```json
{
  "filename": "products_2025.csv",
  "fileSize": 2048576,
  "expectedRows": 1000,
  "options": {
    "validateOnly": false,
    "autoApprove": false,
    "defaultCategory": "electronics"
  }
}
```

**Response:**
```json
{
  "sessionId": "uuid-session-id",
  "status": "created",
  "createdAt": "2025-01-15T10:30:00Z",
  "expiresAt": "2025-01-15T22:30:00Z"
}
```

### **POST /api/merchant/bulk-upload/process**
Process uploaded CSV file with real-time progress tracking.

**Request:** Multipart form data
- `file`: CSV file (max 50MB)
- `sessionId`: Session UUID from previous step
- `options`: JSON string with processing options

**Response:**
```json
{
  "success": true,
  "uploadId": "uuid-upload-id",
  "summary": {
    "totalRows": 1000,
    "processed": 1000,
    "successful": 950,
    "failed": 50,
    "skipped": 0
  },
  "errors": [
    {
      "row": 15,
      "type": "INVALID_PRICE",
      "message": "Price must be a positive number",
      "field": "product_base_price",
      "value": "-10.50"
    }
  ],
  "processedAt": "2025-01-15T10:35:00Z"
}
```

### **GET /api/merchant/bulk-upload/status/{sessionId}**
Get real-time status of bulk upload processing.

**Response:**
```json
{
  "sessionId": "uuid-session-id",
  "status": "processing",
  "progress": {
    "percentage": 75,
    "processedRows": 750,
    "totalRows": 1000,
    "estimatedTimeRemaining": 30
  },
  "currentPhase": "creating_products",
  "lastUpdate": "2025-01-15T10:34:30Z"
}
```

### **POST /api/merchant/bulk-upload/template**
Generate customized CSV template for merchant.

**Request Body:**
```json
{
  "templateType": "basic",
  "includeVariants": true,
  "categories": ["electronics", "clothing"],
  "includeOptionalFields": ["cashback_percentage", "seo_keywords"]
}
```

**Response:** CSV file download with appropriate headers and example data.

### **GET /api/merchant/bulk-upload/history**
Get merchant's bulk upload history with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status (optional)

**Response:**
```json
{
  "uploads": [
    {
      "sessionId": "uuid-session-id",
      "filename": "products_2025.csv",
      "status": "completed",
      "summary": {
        "totalRows": 1000,
        "successful": 950,
        "failed": 50
      },
      "createdAt": "2025-01-15T10:30:00Z",
      "completedAt": "2025-01-15T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## 🤖 **2. AI Optimization API Endpoints**

### **POST /api/merchant/ai/optimize-product**
Request AI optimization for a specific product.

**Request Body:**
```json
{
  "productId": "product-123",
  "optimizationType": "title_optimization",
  "options": {
    "targetKeywords": ["wireless", "bluetooth", "headphones"],
    "targetAudience": "young professionals",
    "includeEmojis": false
  }
}
```

**Response:**
```json
{
  "requestId": "uuid-request-id",
  "status": "processing",
  "estimatedCompletionTime": "2025-01-15T10:32:00Z",
  "queuePosition": 3
}
```

### **GET /api/merchant/ai/optimization-result/{requestId}**
Get AI optimization results.

**Response:**
```json
{
  "requestId": "uuid-request-id",
  "status": "completed",
  "optimizationType": "title_optimization",
  "results": {
    "suggestions": [
      {
        "content": "Premium Wireless Bluetooth Headphones - Noise Cancelling",
        "score": 95,
        "reasoning": "Includes primary keywords and benefit-focused language",
        "improvements": ["Added 'Premium' for positioning", "Highlighted key benefit"]
      }
    ],
    "originalContent": "Bluetooth Headphones",
    "confidenceScore": 92,
    "keywordDensity": {
      "wireless": 1,
      "bluetooth": 1,
      "headphones": 1
    }
  },
  "completedAt": "2025-01-15T10:32:15Z"
}
```

### **POST /api/merchant/ai/batch-optimize**
Request batch optimization for multiple products.

**Request Body:**
```json
{
  "productIds": ["product-123", "product-456", "product-789"],
  "optimizationType": "description_enhancement",
  "priority": "high",
  "options": {
    "targetAudience": "tech enthusiasts",
    "tone": "professional",
    "maxLength": 500
  }
}
```

**Response:**
```json
{
  "batchId": "uuid-batch-id",
  "status": "queued",
  "totalProducts": 3,
  "estimatedCompletionTime": "2025-01-15T10:45:00Z",
  "trackingUrl": "/api/merchant/ai/batch-status/uuid-batch-id"
}
```

### **POST /api/merchant/ai/pricing-analysis**
Get AI-powered pricing recommendations.

**Request Body:**
```json
{
  "productId": "product-123",
  "includeCompetitorAnalysis": true,
  "targetMargin": 25,
  "marketSegment": "premium"
}
```

**Response:**
```json
{
  "productId": "product-123",
  "currentPrice": 99.99,
  "recommendations": [
    {
      "strategy": "competitive",
      "suggestedPrice": 89.99,
      "expectedImpact": "+15% conversion rate",
      "confidence": 85,
      "reasoning": "Price 10% below market average while maintaining healthy margin"
    }
  ],
  "marketAnalysis": {
    "averagePrice": 95.50,
    "priceRange": [79.99, 129.99],
    "competitorCount": 12,
    "marketPosition": "above_average"
  },
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

### **POST /api/merchant/ai/content-generation**
Generate marketing content using AI.

**Request Body:**
```json
{
  "contentType": "social_media_post",
  "productId": "product-123",
  "platform": "instagram",
  "tone": "casual",
  "includeHashtags": true,
  "maxLength": 280
}
```

**Response:**
```json
{
  "contentId": "uuid-content-id",
  "contentType": "social_media_post",
  "generatedContent": {
    "text": "🎧 Upgrade your audio experience with our premium wireless headphones! Crystal clear sound meets all-day comfort. Perfect for work, workouts, or just vibing to your favorite tunes. #WirelessHeadphones #AudioLovers #TechUpgrade",
    "hashtags": ["#WirelessHeadphones", "#AudioLovers", "#TechUpgrade"],
    "characterCount": 245
  },
  "qualityScore": 88,
  "suggestions": [
    "Consider adding a call-to-action",
    "Include product-specific features"
  ],
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

---

## 📊 **3. Market Intelligence API Endpoints**

### **GET /api/merchant/market-intelligence/trends**
Get market trends and insights for specific categories.

**Query Parameters:**
- `category`: Product category
- `timeframe`: 7d, 30d, 90d, 1y
- `region`: Geographic region (optional)

**Response:**
```json
{
  "category": "electronics",
  "timeframe": "30d",
  "trends": [
    {
      "keyword": "wireless earbuds",
      "trendScore": 85,
      "searchVolume": 125000,
      "growthRate": 15.5,
      "seasonality": "stable",
      "competitionLevel": "high"
    }
  ],
  "insights": [
    "Wireless audio products showing strong growth",
    "Holiday season driving increased demand"
  ],
  "lastUpdated": "2025-01-15T09:00:00Z"
}
```

### **GET /api/merchant/market-intelligence/competitors**
Get competitor analysis for specific products.

**Query Parameters:**
- `productName`: Product name to analyze
- `category`: Product category
- `includeFeatures`: Include feature comparison

**Response:**
```json
{
  "productName": "Wireless Bluetooth Headphones",
  "category": "electronics",
  "competitors": [
    {
      "name": "Sony WH-1000XM4",
      "price": 349.99,
      "rating": 4.5,
      "reviewCount": 15420,
      "keyFeatures": ["Noise Cancelling", "30hr Battery"],
      "marketShare": 15.2
    }
  ],
  "marketPosition": {
    "pricePercentile": 75,
    "ratingPercentile": 60,
    "recommendedActions": [
      "Consider highlighting unique features",
      "Price competitively in mid-range segment"
    ]
  },
  "analyzedAt": "2025-01-15T10:30:00Z"
}
```

### **GET /api/merchant/market-intelligence/demand-forecast**
Get demand forecasting for products and categories.

**Query Parameters:**
- `category`: Product category
- `timeframe`: Forecast period (30d, 90d, 1y)
- `includeSeasonality`: Include seasonal patterns

**Response:**
```json
{
  "category": "electronics",
  "forecastPeriod": "90d",
  "demandForecast": [
    {
      "date": "2025-02-01",
      "demandIndex": 110,
      "confidence": 85,
      "factors": ["Valentine's Day", "New Product Launches"]
    }
  ],
  "seasonalPatterns": {
    "peakMonths": [11, 12, 1],
    "lowMonths": [2, 3, 4],
    "averageVariation": 25
  },
  "recommendations": [
    "Increase inventory for Q4",
    "Plan promotions for low-demand periods"
  ],
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

---

## 📢 **4. Advertising Platform API Endpoints**

### **POST /api/merchant/advertising/campaigns**
Create a new advertising campaign.

**Request Body:**
```json
{
  "campaignName": "Holiday Electronics Sale",
  "campaignType": "sponsored_product",
  "budgetType": "daily",
  "dailyBudget": 100.00,
  "bidStrategy": "manual_cpc",
  "defaultBid": 0.50,
  "targetingCriteria": {
    "categories": ["electronics"],
    "keywords": ["wireless", "bluetooth"],
    "demographics": {
      "ageRange": [25, 45],
      "interests": ["technology", "music"]
    }
  },
  "productIds": ["product-123", "product-456"],
  "startDate": "2025-01-20",
  "endDate": "2025-02-20"
}
```

**Response:**
```json
{
  "campaignId": "uuid-campaign-id",
  "status": "draft",
  "estimatedReach": 50000,
  "estimatedCost": {
    "daily": 85.50,
    "total": 2565.00
  },
  "createdAt": "2025-01-15T10:30:00Z",
  "nextSteps": [
    "Review campaign settings",
    "Add payment method",
    "Activate campaign"
  ]
}
```

### **GET /api/merchant/advertising/campaigns/{campaignId}/performance**
Get detailed campaign performance metrics.

**Query Parameters:**
- `startDate`: Start date for metrics
- `endDate`: End date for metrics
- `granularity`: daily, weekly, monthly

**Response:**
```json
{
  "campaignId": "uuid-campaign-id",
  "period": {
    "startDate": "2025-01-20",
    "endDate": "2025-01-27"
  },
  "metrics": {
    "impressions": 125000,
    "clicks": 2500,
    "conversions": 75,
    "conversionValue": 7500.00,
    "cost": 595.50,
    "ctr": 2.0,
    "conversionRate": 3.0,
    "cpc": 0.24,
    "roas": 12.6
  },
  "dailyBreakdown": [
    {
      "date": "2025-01-20",
      "impressions": 18000,
      "clicks": 360,
      "conversions": 12,
      "cost": 86.40
    }
  ],
  "topPerformingProducts": [
    {
      "productId": "product-123",
      "impressions": 75000,
      "clicks": 1500,
      "conversions": 45,
      "roas": 15.2
    }
  ]
}
```

### **PUT /api/merchant/advertising/campaigns/{campaignId}/bid**
Update bid amounts for campaign or specific products.

**Request Body:**
```json
{
  "bidType": "campaign_default",
  "bidAmount": 0.75,
  "productBids": [
    {
      "productId": "product-123",
      "bidAmount": 1.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "updatedAt": "2025-01-15T10:30:00Z",
  "estimatedImpact": {
    "impressionChange": "+25%",
    "costChange": "+50%",
    "expectedRoasChange": "+15%"
  }
}
```

---

## 🏆 **5. Merchant Recognition API Endpoints**

### **GET /api/merchant/recognition/programs**
Get available merchant recognition programs.

**Response:**
```json
{
  "programs": [
    {
      "programId": "uuid-program-id",
      "programName": "Merchant of the Month",
      "programType": "merchant_of_month",
      "description": "Recognition for top-performing merchants",
      "eligibilityCriteria": {
        "minimumSales": 10000,
        "minimumRating": 4.5,
        "minimumOrders": 100
      },
      "benefits": [
        "Homepage feature",
        "Social media promotion",
        "Badge display"
      ],
      "applicationDeadline": "2025-01-31T23:59:59Z",
      "isEligible": true
    }
  ]
}
```

### **POST /api/merchant/recognition/apply**
Apply for merchant recognition program.

**Request Body:**
```json
{
  "programId": "uuid-program-id",
  "applicationData": {
    "achievements": [
      "Achieved 4.8 star rating",
      "Processed 500+ orders in Q4"
    ],
    "businessStory": "Our commitment to quality and customer service...",
    "supportingDocuments": ["url-to-document-1", "url-to-document-2"]
  }
}
```

**Response:**
```json
{
  "applicationId": "uuid-application-id",
  "status": "submitted",
  "reviewTimeline": "5-7 business days",
  "submittedAt": "2025-01-15T10:30:00Z",
  "nextSteps": [
    "Application under review",
    "You will be notified of the decision"
  ]
}
```

### **GET /api/merchant/recognition/badges**
Get merchant's earned badges and achievements.

**Response:**
```json
{
  "badges": [
    {
      "badgeId": "uuid-badge-id",
      "badgeName": "Quality Merchant",
      "badgeType": "quality",
      "description": "Maintains 4.5+ star rating",
      "iconUrl": "/badges/quality-merchant.svg",
      "awardedAt": "2025-01-10T10:30:00Z",
      "rarity": "rare",
      "isVisible": true
    }
  ],
  "totalBadges": 5,
  "badgeScore": 850,
  "nextBadgeProgress": {
    "badgeName": "Sales Champion",
    "progress": 75,
    "requirement": "Achieve $50,000 in monthly sales"
  }
}
```

---

## 📈 **6. Analytics and Reporting API Endpoints**

### **GET /api/merchant/analytics/ai-usage**
Get AI tool usage analytics and ROI metrics.

**Query Parameters:**
- `period`: 7d, 30d, 90d, 1y
- `toolType`: Filter by specific AI tool

**Response:**
```json
{
  "period": "30d",
  "summary": {
    "totalRequests": 150,
    "successfulOptimizations": 142,
    "averageImprovementScore": 25.5,
    "estimatedRevenueImpact": 2500.00
  },
  "toolUsage": [
    {
      "toolType": "title_optimization",
      "usageCount": 45,
      "successRate": 95,
      "averageImprovement": 30,
      "topProducts": ["product-123", "product-456"]
    }
  ],
  "performanceImpact": {
    "clickThroughRateImprovement": 15.5,
    "conversionRateImprovement": 8.2,
    "averageOrderValueIncrease": 12.3
  }
}
```

This API documentation provides comprehensive coverage of all the advanced merchant tools, enabling developers to integrate and utilize the full power of the TAIC merchant empowerment platform.
