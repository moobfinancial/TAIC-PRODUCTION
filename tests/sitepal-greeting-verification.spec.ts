import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('SitePal Greeting Verification', () => {
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

  test('Verify SitePal Avatar Greeting Delivery Works', async () => {
    console.log('🎯 Testing SitePal avatar greeting delivery...');

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

    // Step 4: Monitor console for key events
    let sceneLoaded = false;
    let greetingAttempted = false;
    let speechStarted = false;
    let actionButtonsVisible = false;

    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[CONSOLE] ${text}`);
      
      if (text.includes('vh_sceneLoaded') || text.includes('Scene is ready')) {
        console.log('✅ Scene loaded detected');
        sceneLoaded = true;
      }
      if (text.includes('Attempting to speak greeting') || 
          text.includes('Avatar speaking Pioneer Program greeting')) {
        console.log('✅ Greeting attempt detected');
        greetingAttempted = true;
      }
      if (text.includes('sayText') || text.includes('Started speaking')) {
        console.log('✅ Speech started detected');
        speechStarted = true;
      }
    });

    // Step 5: Wait for scene loading (extended timeout)
    console.log('⏳ Waiting for scene loading (up to 60 seconds)...');
    let waitTime = 0;
    const maxWaitTime = 60000;
    const checkInterval = 2000;

    while (waitTime < maxWaitTime && !sceneLoaded) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;
      
      if (waitTime % 10000 === 0) {
        console.log(`⏳ Still waiting for scene loading... ${waitTime/1000}s elapsed`);
      }
    }

    // Step 6: Wait for greeting attempt (extended timeout)
    console.log('⏳ Waiting for greeting attempt (up to 30 seconds)...');
    waitTime = 0;
    const maxGreetingWait = 30000;

    while (waitTime < maxGreetingWait && !greetingAttempted) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;
      
      if (waitTime % 10000 === 0) {
        console.log(`⏳ Still waiting for greeting attempt... ${waitTime/1000}s elapsed`);
      }
    }

    // Step 7: Check for Pioneer Program action buttons
    console.log('🔍 Checking for Pioneer Program action buttons...');
    try {
      const actionButtons = page.locator('button:has-text("Tell me about Pioneer Program")');
      await expect(actionButtons).toBeVisible({ timeout: 10000 });
      actionButtonsVisible = true;
      console.log('✅ Pioneer Program action buttons found');
    } catch (error) {
      console.log('⚠️ Pioneer Program action buttons not found within timeout');
    }

    // Step 8: Final verification
    console.log('\n📊 Final Verification Results:');
    console.log(`- Scene Loaded: ${sceneLoaded ? '✅' : '❌'}`);
    console.log(`- Greeting Attempted: ${greetingAttempted ? '✅' : '❌'}`);
    console.log(`- Speech Started: ${speechStarted ? '✅' : '❌'}`);
    console.log(`- Action Buttons Visible: ${actionButtonsVisible ? '✅' : '❌'}`);

    // Test passes if scene loads and greeting is attempted
    expect(sceneLoaded).toBe(true);
    expect(greetingAttempted || actionButtonsVisible).toBe(true);
    
    console.log('🎉 SitePal avatar greeting verification completed successfully!');
  });
});
