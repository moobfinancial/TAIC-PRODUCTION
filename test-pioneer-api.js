#!/usr/bin/env node

/**
 * Test script for the Pioneer Program API proxy route
 * This script tests the /api/pioneer/applications endpoint
 */

const BASE_URL = 'http://localhost:9002';
const API_ENDPOINT = `${BASE_URL}/api/pioneer/applications`;

// Test data that matches the form structure
const testApplicationData = {
  full_name: "Test User",
  email: `test-${Date.now()}@example.com`, // Unique email to avoid conflicts
  telegram_handle: "testuser_tg",
  discord_id: "testuser#1234",
  country_of_residence: "United States",
  applying_for_tier: "Tier 2: Strategic Influencer",
  interest_reason: "I am very passionate about the potential of AI in commerce and believe TAIC is leading the way. I want to contribute to the platform's growth by leveraging my social media presence and technical background to help onboard new users and merchants.",
  contribution_proposal: "I propose to create educational content about TAIC's features, host community events, and provide feedback on user experience improvements. My goal is to help bridge the gap between traditional commerce and AI-powered solutions.",
  relevant_experience: "5 years in digital marketing, 3 years in blockchain technology, active community manager for several tech projects",
  primary_social_profile_link: "https://twitter.com/testuser",
  follower_subscriber_count: "25000",
  audience_demographics_description: "Tech-savvy millennials and Gen Z interested in AI, blockchain, and e-commerce innovations",
  engagement_statistics_overview: "Average 5% engagement rate, 1000+ likes per post, 100+ comments on educational content",
  secondary_social_profile_links: "https://linkedin.com/in/testuser, https://youtube.com/testuser",
  previous_programs_experience: "Beta tester for 3 blockchain projects, ambassador for 2 AI startups",
  taic_compatible_wallet_address: "0x1234567890123456789012345678901234567890",
  agreed_to_terms: true,
  agreed_to_token_vesting: true
};

async function testPioneerApplicationAPI() {
  console.log('🚀 Testing Pioneer Program API Proxy Route');
  console.log('📍 Endpoint:', API_ENDPOINT);
  console.log('📧 Test Email:', testApplicationData.email);
  console.log('');

  try {
    console.log('📤 Sending POST request...');
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testApplicationData)
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseData = await response.json();
    console.log('📄 Response Body:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('');
      console.log('✅ SUCCESS: Pioneer Program application submitted successfully!');
      console.log('🆔 Application ID:', responseData.application?.id);
      console.log('📧 Email:', responseData.application?.email);
      console.log('🎯 Tier:', responseData.application?.applying_for_tier);
      console.log('📊 Status:', responseData.application?.application_status);
      console.log('⏰ Submitted At:', responseData.application?.submitted_at);
    } else {
      console.log('');
      console.log('❌ FAILED: Application submission failed');
      console.log('💬 Error Message:', responseData.message);
      console.log('🔍 Error Type:', responseData.error);
      if (responseData.details) {
        console.log('📝 Error Details:', responseData.details);
      }
    }

  } catch (error) {
    console.log('');
    console.log('💥 NETWORK ERROR:', error.message);
    console.log('🔧 Check that:');
    console.log('   - Next.js server is running on port 9002');
    console.log('   - FastAPI backend is running on port 8000');
    console.log('   - Database connection is working');
  }
}

async function testInvalidRequests() {
  console.log('');
  console.log('🧪 Testing Invalid Requests...');

  // Test missing required fields
  console.log('');
  console.log('📤 Testing missing required fields...');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name: "Test User",
        // Missing email and applying_for_tier
        agreed_to_terms: true,
        agreed_to_token_vesting: true
      })
    });

    const responseData = await response.json();
    console.log('📥 Status:', response.status);
    console.log('💬 Message:', responseData.message);

    if (response.status === 400) {
      console.log('✅ Correctly rejected missing fields');
    } else {
      console.log('❌ Should have returned 400 for missing fields');
    }
  } catch (error) {
    console.log('💥 Error testing invalid request:', error.message);
  }

  // Test missing terms agreement
  console.log('');
  console.log('📤 Testing missing terms agreement...');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name: "Test User",
        email: "test@example.com",
        applying_for_tier: "Tier 1: Visionary Partner",
        interest_reason: "Test reason",
        contribution_proposal: "Test proposal",
        agreed_to_terms: false, // Should fail
        agreed_to_token_vesting: true
      })
    });

    const responseData = await response.json();
    console.log('📥 Status:', response.status);
    console.log('💬 Message:', responseData.message);

    if (response.status === 400) {
      console.log('✅ Correctly rejected missing terms agreement');
    } else {
      console.log('❌ Should have returned 400 for missing terms agreement');
    }
  } catch (error) {
    console.log('💥 Error testing terms agreement:', error.message);
  }

  // Test unsupported HTTP method
  console.log('');
  console.log('📤 Testing unsupported HTTP method (GET)...');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'GET'
    });

    const responseData = await response.json();
    console.log('📥 Status:', response.status);
    console.log('💬 Message:', responseData.message);

    if (response.status === 405) {
      console.log('✅ Correctly rejected GET method');
    } else {
      console.log('❌ Should have returned 405 for GET method');
    }
  } catch (error) {
    console.log('💥 Error testing GET method:', error.message);
  }
}

async function runAllTests() {
  console.log('🎯 Pioneer Program API Test Suite');
  console.log('==================================');
  
  await testPioneerApplicationAPI();
  await testInvalidRequests();
  
  console.log('');
  console.log('🏁 Test Suite Complete');
  console.log('==================================');
}

// Run the tests
runAllTests().catch(console.error);
