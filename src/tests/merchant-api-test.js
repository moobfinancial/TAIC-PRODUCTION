/**
 * Merchant API Integration Test Script
 * 
 * This script tests the merchant API endpoints for:
 * - Registration
 * - Login
 * - Token refresh
 * - Product management (CRUD operations)
 * - Category retrieval
 * 
 * Run with: node src/tests/merchant-api-test.js
 */

// Test configuration
const API_BASE_URL = 'http://localhost:9002/api';
const TEST_MERCHANT = {
  username: `test_merchant_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  businessName: 'Test Business',
};

let authToken = null;
let testProductId = null;

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, data };
}

// Test runner
async function runTests() {
  console.log('🧪 Starting Merchant API Integration Tests');
  console.log('----------------------------------------');

  try {
    // Test 1: Register a new merchant
    console.log('Test 1: Merchant Registration');
    const registerResult = await apiRequest('/merchant/register', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(TEST_MERCHANT),
    });

    if (registerResult.response.ok) {
      console.log('✅ Registration successful');
    } else {
      console.error('❌ Registration failed:', registerResult.data);
      // If registration fails because user already exists, we can continue
      if (!registerResult.data.error?.includes('already exists')) {
        throw new Error('Registration test failed');
      } else {
        console.log('⚠️ User already exists, continuing with login test');
      }
    }

    // Test 2: Login with the new merchant
    console.log('\nTest 2: Merchant Login');
    const loginResult = await apiRequest('/merchant/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({
        email: TEST_MERCHANT.email,
        password: TEST_MERCHANT.password,
      }),
    });

    if (loginResult.response.ok && loginResult.data.token) {
      console.log('✅ Login successful');
      authToken = loginResult.data.token;
    } else {
      console.error('❌ Login failed:', loginResult.data);
      throw new Error('Login test failed');
    }

    // Test 3: Token Refresh
    console.log('\nTest 3: Token Refresh');
    const refreshResult = await apiRequest('/merchant/refresh-token', {
      method: 'POST',
    });

    if (refreshResult.response.ok && refreshResult.data.token) {
      console.log('✅ Token refresh successful');
      authToken = refreshResult.data.token;
    } else {
      console.error('❌ Token refresh failed:', refreshResult.data);
      throw new Error('Token refresh test failed');
    }

    // Test 4: Get Categories
    console.log('\nTest 4: Get Categories');
    const categoriesResult = await apiRequest('/categories', {
      skipAuth: true,
    });

    if (categoriesResult.response.ok && Array.isArray(categoriesResult.data.categories)) {
      console.log(`✅ Retrieved ${categoriesResult.data.categories.length} categories`);
    } else {
      console.error('❌ Categories retrieval failed:', categoriesResult.data);
      throw new Error('Categories test failed');
    }

    // Test 5: Create a product
    console.log('\nTest 5: Create Product');
    
    // For testing purposes, we'll create a product without a category
    // since the API expects categoryId to be a UUID string and our test data has numeric IDs
    const newProduct = {
      name: `Test Product ${Date.now()}`,
      description: 'This is a test product created by the API test script',
      price: 99.99,
      stockQuantity: 100,
      imageUrl: 'https://via.placeholder.com/300',
      // Omitting categoryId since we don't have a valid UUID
      cashbackConfig: {
        type: 'percentage',
        value: 5 // Number as expected by the schema
      },
      isActive: true,
    };
    
    // Log the product data being sent
    console.log('Product data being sent:', JSON.stringify(newProduct, null, 2));

    const createProductResult = await apiRequest('/merchant/products', {
      method: 'POST',
      body: JSON.stringify(newProduct),
    });

    if (createProductResult.response.ok && createProductResult.data.id) {
      console.log('✅ Product created successfully');
      testProductId = createProductResult.data.id;
    } else {
      console.error('❌ Product creation failed:', createProductResult.data);
      throw new Error('Product creation test failed');
    }

    // Test 6: Get merchant products
    console.log('\nTest 6: Get Merchant Products');
    const getProductsResult = await apiRequest('/merchant/products');

    if (getProductsResult.response.ok && Array.isArray(getProductsResult.data.products)) {
      console.log(`✅ Retrieved ${getProductsResult.data.products.length} products`);
    } else {
      console.error('❌ Products retrieval failed:', getProductsResult.data);
      throw new Error('Products retrieval test failed');
    }

    // Test 7: Get specific product
    console.log('\nTest 7: Get Specific Product');
    console.log(`Attempting to retrieve product with ID: ${testProductId}`);
    
    try {
      const getProductResult = await apiRequest(`/merchant/products/${testProductId}`);
      
      console.log('Product retrieval response status:', getProductResult.response.status);
      console.log('Product retrieval response data:', JSON.stringify(getProductResult.data, null, 2));
      
      if (getProductResult.response.ok && getProductResult.data.id === testProductId) {
        console.log('✅ Retrieved specific product successfully');
      } else {
        console.error('❌ Product retrieval failed:', getProductResult.data);
        throw new Error('Product retrieval test failed');
      }
    } catch (error) {
      console.error('❌ Exception during product retrieval:', error.message);
      throw new Error('Product retrieval test failed with exception');
    }

    // Test 8: Update product
    console.log('\nTest 8: Update Product');
    const updatedProduct = {
      ...newProduct,
      name: `Updated Test Product ${Date.now()}`,
      price: 129.99,
    };

    const updateProductResult = await apiRequest(`/merchant/products/${testProductId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedProduct),
    });

    if (updateProductResult.response.ok) {
      console.log('✅ Product updated successfully');
    } else {
      console.error('❌ Product update failed:', updateProductResult.data);
      throw new Error('Product update test failed');
    }

    // Test 9: Delete product
    console.log('\nTest 9: Delete Product');
    const deleteProductResult = await apiRequest(`/merchant/products/${testProductId}`, {
      method: 'DELETE',
    });

    if (deleteProductResult.response.ok) {
      console.log('✅ Product deleted successfully');
    } else {
      console.error('❌ Product deletion failed:', deleteProductResult.data);
      throw new Error('Product deletion test failed');
    }

    console.log('\n----------------------------------------');
    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error('----------------------------------------');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error in test runner:', error);
  process.exit(1);
});
