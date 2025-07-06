# TAIC Merchant Tools Testing Guide
## Phase 1 & 2: Bulk Upload Enhancement + AI-Powered Tools

### 🎯 **Testing Overview**

This guide provides comprehensive testing procedures for the newly implemented merchant tools, including bulk product upload enhancement and AI-powered optimization features.

---

## 🔧 **Prerequisites**

### **Environment Setup**
1. **Development Server**: Ensure Next.js server is running on port 9002
   ```bash
   npm run dev
   ```

2. **Database**: PostgreSQL database should be accessible
   ```bash
   # Connection string: postgresql://moobuser:userfortaicweb@localhost:5432/moobfinancial
   ```

3. **Environment Variables**: Required API keys
   ```bash
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_AI_API_KEY=your_google_ai_key (optional)
   JWT_SECRET=your_jwt_secret
   ```

4. **Database Migration**: Run the migration to create new tables
   ```bash
   # Execute migrations/004_bulk_upload_tables.sql
   ```

### **Test Data Requirements**
- **Merchant Account**: Valid merchant user with JWT token
- **CSV Test Files**: Sample product CSV files for upload testing
- **Product Data**: Existing products for AI optimization testing

---

## 📦 **PHASE 1: Bulk Upload Testing**

### **Test 1: Bulk Upload Interface Access**
**Objective**: Verify the bulk upload page loads correctly

**Steps**:
1. Navigate to `http://localhost:9002/merchant/products/bulk-upload`
2. Ensure merchant authentication is working
3. Verify the page loads without errors

**Expected Results**:
✅ Page loads with drag-and-drop interface  
✅ Progress steps are visible (Upload → Validate → Preview → Submit → Complete)  
✅ Template download button is functional  
✅ No console errors  

### **Test 2: CSV Template Generation**
**Objective**: Test CSV template download functionality

**Steps**:
1. Click "Download Template" button
2. Select template type (basic/comprehensive)
3. Verify file downloads

**Expected Results**:
✅ CSV file downloads successfully  
✅ File contains proper headers  
✅ Sample data is included (if requested)  
✅ File format is valid CSV  

### **Test 3: File Upload and Validation**
**Objective**: Test drag-and-drop upload and validation

**Test CSV Content**:
```csv
product_handle,product_name,variant_sku,variant_stock_quantity,product_base_price
test-product-1,Test Wireless Headphones,TWH-001,50,99.99
test-product-2,Test Fitness Tracker,TFT-002,30,149.99
invalid-product,,INVALID-SKU,-5,invalid-price
```

**Steps**:
1. Drag and drop the test CSV file
2. Wait for validation to complete
3. Review validation results

**Expected Results**:
✅ File uploads successfully  
✅ Validation detects errors in row 3  
✅ Error messages are specific and helpful  
✅ Valid rows are identified correctly  

### **Test 4: Upload Preview and Submission**
**Objective**: Test the preview and submission workflow

**Steps**:
1. Upload a valid CSV file
2. Review the preview data
3. Submit the upload
4. Monitor progress

**Expected Results**:
✅ Preview shows first 5 rows correctly  
✅ Upload progress is displayed  
✅ Success/failure counts are accurate  
✅ Upload completes successfully  

### **Test 5: Upload History**
**Objective**: Verify upload history tracking

**Steps**:
1. Complete several uploads
2. Check upload history section
3. Verify status and metrics

**Expected Results**:
✅ Upload history displays correctly  
✅ Status badges are accurate  
✅ File names and dates are correct  
✅ Success/failure counts match  

---

## 🤖 **PHASE 2: AI Tools Testing**

### **Test 6: AI Tools Dashboard Access**
**Objective**: Verify AI tools page loads and functions

**Steps**:
1. Navigate to `http://localhost:9002/merchant/ai-tools`
2. Check all tabs load correctly
3. Verify form elements are functional

**Expected Results**:
✅ Page loads without errors  
✅ All tabs are accessible  
✅ Form inputs work correctly  
✅ UI components render properly  

### **Test 7: Product Title Optimization**
**Objective**: Test AI-powered title optimization

**Test Data**:
- **Current Title**: "Bluetooth Headphones"
- **Keywords**: "wireless, noise cancelling, premium"
- **Target Audience**: "Professionals"

**Steps**:
1. Fill in title optimization form
2. Click "Optimize Title"
3. Wait for AI processing
4. Review suggestions

**Expected Results**:
✅ Processing indicator shows  
✅ AI suggestions are generated  
✅ Confidence scores are displayed  
✅ Reasoning is provided  
✅ Improvements are listed  

### **Test 8: Description Enhancement**
**Objective**: Test AI description enhancement

**Test Data**:
- **Current Description**: "Good quality headphones with noise cancelling"
- **Features**: "30hr battery, quick charge, comfortable"
- **Benefits**: "all-day listening, crystal clear audio"

**Steps**:
1. Fill in description enhancement form
2. Submit for AI processing
3. Review enhanced description

**Expected Results**:
✅ Enhanced description is generated  
✅ Readability score is calculated  
✅ SEO score is provided  
✅ Improvements are highlighted  
✅ Content is well-structured  

### **Test 9: Pricing Analysis**
**Objective**: Test AI pricing recommendations

**Steps**:
1. Select a product for analysis
2. Set target margin
3. Run pricing analysis
4. Review recommendations

**Expected Results**:
✅ Multiple pricing strategies provided  
✅ Expected impact is calculated  
✅ Confidence scores are shown  
✅ Reasoning is clear  
✅ Recommendations are actionable  

### **Test 10: Market Intelligence Dashboard**
**Objective**: Test market intelligence features

**Steps**:
1. Navigate to `http://localhost:9002/merchant/market-intelligence`
2. Select different categories and timeframes
3. Review trend data and forecasts

**Expected Results**:
✅ Market trends display correctly  
✅ Competitor analysis shows data  
✅ Demand forecast calendar works  
✅ Opportunities are identified  
✅ Data refreshes properly  

---

## 🔍 **API Testing**

### **Test 11: Bulk Upload API Endpoints**

**Session Creation**:
```bash
curl -X POST http://localhost:9002/api/merchant/bulk-upload/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.csv","fileSize":1024,"expectedRows":10}'
```

**Template Generation**:
```bash
curl -X POST http://localhost:9002/api/merchant/bulk-upload/template \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateType":"comprehensive","sampleData":true}'
```

### **Test 12: AI Optimization API**

**Title Optimization**:
```bash
curl -X POST http://localhost:9002/api/merchant/ai/optimize-product \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "optimizationType": "title_optimization",
    "options": {
      "currentTitle": "Bluetooth Headphones",
      "targetKeywords": ["wireless", "premium"],
      "targetAudience": "professionals"
    }
  }'
```

---

## 📊 **Performance Testing**

### **Test 13: Upload Performance**
**Objective**: Verify upload performance meets requirements

**Test Cases**:
- Small file (100 products): <5 seconds
- Medium file (500 products): <15 seconds  
- Large file (1000 products): <30 seconds

### **Test 14: AI Response Times**
**Objective**: Verify AI tools meet performance requirements

**Test Cases**:
- Title optimization: <3 seconds
- Description enhancement: <5 seconds
- Pricing analysis: <3 seconds

### **Test 15: Concurrent Users**
**Objective**: Test system under load

**Test Cases**:
- 5 concurrent uploads
- 10 concurrent AI requests
- Mixed load scenarios

---

## 🐛 **Error Handling Testing**

### **Test 16: Invalid File Uploads**
**Test Cases**:
- Non-CSV files
- Files over 50MB
- Corrupted CSV files
- Empty files

### **Test 17: API Error Scenarios**
**Test Cases**:
- Invalid authentication tokens
- Missing required parameters
- Network timeouts
- Database connection issues

### **Test 18: AI Service Failures**
**Test Cases**:
- OpenAI API unavailable
- Invalid API responses
- Rate limiting scenarios
- Timeout handling

---

## ✅ **Acceptance Criteria Checklist**

### **Bulk Upload Features**
- [ ] Drag-and-drop CSV upload works
- [ ] Real-time validation with error highlighting
- [ ] Template download with sample data
- [ ] Upload preview with data validation
- [ ] Progress tracking and status updates
- [ ] Upload history and retry functionality
- [ ] Integration with product approval workflow

### **AI-Powered Tools**
- [ ] Product title optimization with suggestions
- [ ] Description enhancement with scoring
- [ ] Pricing analysis with strategies
- [ ] Market intelligence dashboard
- [ ] Confidence scoring and reasoning
- [ ] Professional UI with intuitive workflows

### **Performance Requirements**
- [ ] Upload processing <30 seconds for 1000 products
- [ ] AI responses <3 seconds
- [ ] 99.9% system uptime
- [ ] <1% error rate for automated processes

### **Integration Requirements**
- [ ] Merchant authentication working
- [ ] Database integration complete
- [ ] API endpoints functional
- [ ] UI components consistent
- [ ] No breaking changes to existing features

---

## 🚀 **Production Readiness Checklist**

### **Security**
- [ ] Input validation and sanitization
- [ ] Authentication and authorization
- [ ] Rate limiting implemented
- [ ] Error messages don't expose sensitive data

### **Monitoring**
- [ ] Error tracking configured
- [ ] Performance monitoring setup
- [ ] Usage analytics implemented
- [ ] Health checks functional

### **Documentation**
- [ ] API documentation complete
- [ ] User guides created
- [ ] Technical documentation updated
- [ ] Deployment procedures documented

### **Backup & Recovery**
- [ ] Database backup procedures
- [ ] Error recovery mechanisms
- [ ] Rollback procedures defined
- [ ] Disaster recovery plan

---

## 📞 **Support & Troubleshooting**

### **Common Issues**
1. **Upload fails**: Check file format and size limits
2. **AI tools not responding**: Verify API keys are configured
3. **Authentication errors**: Check JWT token validity
4. **Database errors**: Verify connection and migrations

### **Debug Information**
- Check browser console for JavaScript errors
- Review server logs for API errors
- Monitor database query performance
- Verify environment variable configuration

### **Contact Information**
- **Technical Support**: Development team
- **Documentation**: Implementation guides and API docs
- **Escalation**: Project manager for critical issues

This comprehensive testing guide ensures all implemented features work correctly and meet the specified requirements for production deployment.
