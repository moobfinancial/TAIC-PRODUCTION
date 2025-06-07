// Test script for Virtual Try-On functionality with image saving
// Run with: node test-virtual-try-on.js

const fetch = require('node-fetch');

async function testVirtualTryOn() {
  console.log('Testing Virtual Try-On API with image saving...');
  
  // Replace these with actual URLs for testing
  const testData = {
    userImageUrl: 'https://example.com/path/to/user-image.jpg',
    productImageUrl: 'https://example.com/path/to/product-image.jpg',
    userDescription: 'A person with short dark hair wearing a white t-shirt',
    productDescription: 'A stylish black leather jacket with silver zippers',
    productId: 'jacket-123'
  };
  
  try {
    // Add a custom user ID header for testing
    const response = await fetch('http://localhost:3000/api/virtual-try-on', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123' // This will be used if no session is available
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Generated image URL (saved to user account):', result.generatedImageUrl);
    console.log('Original generated image URL:', result.originalGeneratedImageUrl);
    
    if (result.saveErrorMessage) {
      console.error('Error saving image:', result.saveErrorMessage);
    }
    
    if (result.errorMessage) {
      console.error('Error in virtual try-on process:', result.errorMessage);
    }
    
    return result;
  } catch (error) {
    console.error('Error testing Virtual Try-On API:', error);
    throw error;
  }
}

testVirtualTryOn()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err));
