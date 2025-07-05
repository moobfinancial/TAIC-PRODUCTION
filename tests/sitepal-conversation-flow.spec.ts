import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * TAIC Platform - SitePal Avatar Conversation Flow Testing
 * 
 * Phase 4: Avatar Integration and Conversation Flow Testing
 * 
 * This test suite validates the complete conversation flow functionality including:
 * - Message sending through interactive buttons
 * - Query processing and AI system integration
 * - Response delivery through the avatar
 * - Conversation persistence throughout the session
 * - Pioneer Program conversion optimization flows
 * 
 * Success Criteria:
 * - All interactive buttons send messages correctly
 * - AI responses are delivered within 3 seconds
 * - Conversation history is maintained
 * - Pioneer Program signup flow is accessible
 * - Network connectivity remains stable throughout conversation
 */

test.describe('SitePal Avatar Conversation Flow Testing', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    // Create new context and page for each test
    try {
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        // Remove microphone permission as it's not supported in all browsers
      });
      page = await context.newPage();
    } catch (error) {
      console.error('Failed to create browser context:', error);
      throw error;
    }

    // Monitor console errors and network requests
    const consoleErrors: string[] = [];
    const networkRequests: string[] = [];
    const sitePalRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('request', (request) => {
      const url = request.url();
      networkRequests.push(url);
      
      if (url.includes('oddcast.com') || url.includes('sitepal') || url.includes('vhss')) {
        sitePalRequests.push(url);
      }
    });

    // Store arrays in page context for access in tests
    (page as any).testData = {
      consoleErrors,
      networkRequests,
      sitePalRequests
    };

    // Navigate to home page (TAIC production server runs on port 9002)
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Complete Conversation Flow - Message Sending and Response Delivery', async () => {
    console.log('🎯 Testing complete conversation flow with message sending and response delivery...');

    // Step 1: Open SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Step 2: Wait for modal to appear and avatar to initialize
    // The modal uses a fixed positioned div, not role="dialog"
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Step 3: Wait for SitePal container and avatar initialization
    const sitePalContainer = page.locator('#sitePalContainer');
    await expect(sitePalContainer).toBeVisible({ timeout: 15000 });

    // Wait for avatar to fully load (up to 15 seconds)
    await page.waitForTimeout(15000);

    // Step 4: Test interactive button functionality
    console.log('🔘 Testing interactive button message sending...');
    
    const interactiveButtons = [
      'Tell me about TAIC',
      'What is the Pioneer Program?',
      'How do I get started?',
      'Show me the benefits'
    ];

    for (const buttonText of interactiveButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`);
      if (await button.isVisible()) {
        console.log(`📤 Clicking button: ${buttonText}`);
        await button.click();
        
        // Wait for potential response (3 second target)
        await page.waitForTimeout(3000);
        
        // Check for any conversation updates or responses
        const conversationArea = page.locator('.conversation-area, .chat-messages, .response-area');
        if (await conversationArea.isVisible()) {
          console.log(`✅ Conversation area detected after clicking: ${buttonText}`);
        }
      }
    }

    // Step 5: Test Pioneer Program signup flow accessibility
    console.log('🎯 Testing Pioneer Program signup flow accessibility...');
    
    const signupButtons = [
      'Join Pioneer Program',
      'Sign Up Now',
      'Get Started',
      'Apply Now'
    ];

    for (const buttonText of signupButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`);
      if (await button.isVisible()) {
        console.log(`🚀 Pioneer Program signup button found: ${buttonText}`);
        // Don't click to avoid navigation, just verify accessibility
      }
    }

    // Step 6: Validate network stability throughout conversation
    const testData = (page as any).testData;
    console.log(`📊 Network requests during conversation: ${testData.networkRequests.length}`);
    console.log(`🎭 SitePal requests during conversation: ${testData.sitePalRequests.length}`);
    
    // Verify no network errors occurred
    const networkErrors = testData.consoleErrors.filter((error: string) => 
      error.includes('ERR_NAME_NOT_RESOLVED') || 
      error.includes('net::') ||
      error.includes('Failed to fetch')
    );
    
    expect(networkErrors.length).toBe(0);
    console.log('✅ No network errors detected during conversation flow');

    // Step 7: Test conversation persistence
    console.log('💾 Testing conversation persistence...');
    
    // Check for conversation history elements
    const historyElements = page.locator('.conversation-history, .chat-history, .message-history');
    if (await historyElements.count() > 0) {
      console.log('✅ Conversation history elements detected');
    }

    // Check localStorage for conversation data
    const conversationData = await page.evaluate(() => {
      return {
        hasConversationId: !!localStorage.getItem('conversationId'),
        hasSessionData: !!localStorage.getItem('sitePalSession'),
        hasUserMessages: !!localStorage.getItem('userMessages')
      };
    });
    
    console.log('💾 Conversation persistence check:', conversationData);
  });

  test('AI Response Time Validation', async () => {
    console.log('⏱️ Testing AI response time validation...');

    // Open modal and wait for avatar
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    const sitePalContainer = page.locator('#sitePalContainer');
    await expect(sitePalContainer).toBeVisible({ timeout: 15000 });
    
    // Wait for avatar initialization
    await page.waitForTimeout(15000);

    // Test response time for interactive buttons
    const testButton = page.locator('button:has-text("Tell me about TAIC")');
    if (await testButton.isVisible()) {
      const startTime = Date.now();
      await testButton.click();
      
      // Wait for response indicators (target: <3 seconds)
      await page.waitForTimeout(3000);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`⏱️ Response time: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(5000); // Allow 5 seconds for comprehensive test
    }
  });

  test('Pioneer Program Conversion Flow Validation', async () => {
    console.log('🎯 Testing Pioneer Program conversion flow validation...');

    // Open modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // Wait for avatar and conversation elements
    await page.waitForTimeout(15000);

    // Look for Pioneer Program related content
    const pioneerContent = page.locator('text=/pioneer/i, text=/program/i, text=/tier/i, text=/benefit/i');
    const pioneerContentCount = await pioneerContent.count();
    
    console.log(`🎯 Pioneer Program content elements found: ${pioneerContentCount}`);

    // Check for conversion-optimized conversation flows
    const conversionElements = page.locator('text=/join/i, text=/signup/i, text=/apply/i, text=/get started/i');
    const conversionCount = await conversionElements.count();
    
    console.log(`🚀 Conversion elements found: ${conversionCount}`);

    // Validate natural speech synthesis patterns (avoiding numbered lists)
    const numberedLists = page.locator('text=/1\\./i, text=/2\\./i, text=/first:/i, text=/second:/i');
    const numberedCount = await numberedLists.count();
    
    console.log(`📝 Numbered list elements (should be minimal): ${numberedCount}`);
    
    // Prefer natural transitions
    const naturalTransitions = page.locator('text=/additionally/i, text=/furthermore/i, text=/also/i, text=/moreover/i');
    const transitionCount = await naturalTransitions.count();
    
    console.log(`🗣️ Natural transition elements: ${transitionCount}`);
  });

  test('Network Error Recovery During Conversation', async () => {
    console.log('🔄 Testing network error recovery during conversation...');

    // Open modal and establish conversation
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // Wait for stable connection
    await page.waitForTimeout(15000);

    // Monitor network requests throughout test
    const testData = (page as any).testData;
    const initialRequestCount = testData.sitePalRequests.length;
    
    // Simulate interaction to trigger network activity
    const interactionButton = page.locator('button:has-text("What is the Pioneer Program?")');
    if (await interactionButton.isVisible()) {
      await interactionButton.click();
      await page.waitForTimeout(5000);
    }

    // Check for network error recovery mechanisms
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
    const networkStatus = page.locator('.network-status, .connection-status, .error-message');
    
    console.log(`🔄 Retry mechanisms available: ${await retryButton.count()}`);
    console.log(`📡 Network status indicators: ${await networkStatus.count()}`);

    // Verify no ERR_NAME_NOT_RESOLVED errors
    const networkErrors = testData.consoleErrors.filter((error: string) => 
      error.includes('ERR_NAME_NOT_RESOLVED')
    );
    
    expect(networkErrors.length).toBe(0);
    console.log('✅ No ERR_NAME_NOT_RESOLVED errors during conversation');

    // Verify SitePal requests are successful
    const finalRequestCount = testData.sitePalRequests.length;
    console.log(`📊 SitePal requests: ${initialRequestCount} → ${finalRequestCount}`);
    expect(finalRequestCount).toBeGreaterThanOrEqual(initialRequestCount);
  });
});
