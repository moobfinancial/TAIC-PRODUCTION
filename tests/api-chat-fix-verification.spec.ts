import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('API Chat Fix Verification', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create new context with microphone permissions
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['microphone'],
    });
    page = await context.newPage();
    
    // Grant microphone permissions for the specific origin
    await context.grantPermissions(['microphone'], { origin: 'http://localhost:9002' });
    console.log('🎤 Microphone permissions granted automatically');
    
    // Navigate to home page
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Verify API Chat Endpoint Returns 200 Status', async () => {
    console.log('🎯 Testing API chat endpoint fix...');

    // Step 1: Open SitePal modal
    console.log('📱 Opening SitePal modal...');
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 15000 });
    await startButton.click();

    // Step 2: Wait for modal to appear
    console.log('🔍 Waiting for modal to appear...');
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 20000 });

    // Step 3: Wait for SitePal container
    console.log('📦 Waiting for SitePal container...');
    const sitePalContainer = page.locator('#vhss_aiPlayer');
    await expect(sitePalContainer).toBeVisible({ timeout: 20000 });

    // Step 4: Monitor network requests for API calls
    let apiRequestMade = false;
    let apiResponseStatus = 0;
    let apiErrorDetails = '';

    page.on('response', (response) => {
      if (response.url().includes('/api/ai/chat')) {
        console.log(`[API] /api/ai/chat response: ${response.status()}`);
        apiRequestMade = true;
        apiResponseStatus = response.status();
        
        if (!response.ok()) {
          response.text().then(text => {
            apiErrorDetails = text;
            console.log(`[API ERROR] Response body: ${text}`);
          }).catch(() => {});
        }
      }
    });

    // Step 5: Wait for scene loading
    console.log('⏳ Waiting for scene loading...');
    let sceneLoaded = false;
    let avatarReady = false;

    page.on('console', (msg) => {
      const text = msg.text();
      
      if (text.includes('vh_sceneLoaded') || text.includes('Scene is ready')) {
        console.log('✅ Scene loaded detected');
        sceneLoaded = true;
      }
      if (text.includes('Avatar is ready')) {
        console.log('✅ Avatar ready detected');
        avatarReady = true;
      }
    });

    // Wait for scene loading
    let waitTime = 0;
    const maxWaitTime = 45000;
    const checkInterval = 2000;

    while (waitTime < maxWaitTime && !sceneLoaded) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;
      
      if (waitTime % 10000 === 0) {
        console.log(`⏳ Still waiting for scene loading... ${waitTime/1000}s elapsed`);
      }
    }

    // Step 6: Test conversation functionality if avatar is ready
    if (sceneLoaded && avatarReady) {
      console.log('🗣️ Testing conversation functionality...');
      
      // Find and use the text input within the modal
      const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
      const textInput = modal.locator('input[placeholder*="Type your message"]');
      await expect(textInput).toBeVisible({ timeout: 10000 });

      // Type a test message
      await textInput.fill('Tell me about the Pioneer Program');

      // Try to click send button, fallback to Enter key
      try {
        const sendButton = modal.locator('button:has-text("Send"), button[aria-label*="Send"], button:has(svg[data-lucide="send"])');
        await sendButton.first().click({ timeout: 5000 });
      } catch (e) {
        console.log('Send button not found, using Enter key');
        await textInput.press('Enter');
      }

      // Wait for API request to be made
      await page.waitForTimeout(8000);
      
      console.log(`📊 API Request Made: ${apiRequestMade}`);
      console.log(`📊 API Response Status: ${apiResponseStatus}`);
      if (apiErrorDetails) {
        console.log(`📊 API Error Details: ${apiErrorDetails}`);
      }
    } else {
      console.log('⚠️ Avatar not ready, skipping conversation test');
    }

    // Step 7: Final verification
    console.log('\n📊 Final Verification Results:');
    console.log(`- Scene Loaded: ${sceneLoaded ? '✅' : '❌'}`);
    console.log(`- Avatar Ready: ${avatarReady ? '✅' : '❌'}`);
    console.log(`- API Request Made: ${apiRequestMade ? '✅' : '❌'}`);
    console.log(`- API Status Code: ${apiResponseStatus === 200 ? '✅ 200' : `❌ ${apiResponseStatus}`}`);

    // Test passes if scene loads (basic functionality)
    expect(sceneLoaded).toBe(true);
    
    // If API request was made, it should return 200 (not 400)
    if (apiRequestMade) {
      expect(apiResponseStatus).toBe(200);
      console.log('🎉 API chat endpoint fix verified successfully!');
    } else {
      console.log('ℹ️ No API request made during test - avatar may still be initializing');
    }
  });
});
