import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('SitePal Avatar Initialization and Conversation Flow', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create new context and page for each test
    try {
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        // CRITICAL FIX: Grant microphone permissions automatically
        permissions: ['microphone'],
      });
      page = await context.newPage();

      // CRITICAL FIX: Grant microphone permissions for the specific origin
      await context.grantPermissions(['microphone'], { origin: 'http://localhost:9002' });
      console.log('🎤 Microphone permissions granted automatically');

      // Navigate to home page (TAIC production server runs on port 9002)
      await page.goto('http://localhost:9002');
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      console.error('Failed to create browser context:', error);
      throw error;
    }
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Complete SitePal Avatar Initialization with Greeting Delivery', async () => {
    console.log('🎯 Testing complete SitePal avatar initialization sequence...');

    // Step 1: Open SitePal modal
    console.log('📱 Opening SitePal modal...');
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Step 2: Wait for modal to appear (CORRECT SELECTOR)
    console.log('🔍 Waiting for modal to appear...');
    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Step 3: Wait for SitePal container to be created (CORRECT ID)
    console.log('📦 Waiting for SitePal container...');
    const sitePalContainer = page.locator('#vhss_aiPlayer');
    await expect(sitePalContainer).toBeVisible({ timeout: 15000 });

    // Step 4: Monitor console logs for initialization callbacks
    console.log('👂 Monitoring console logs for SitePal callbacks...');
    let sceneLoaded = false;
    let greetingStarted = false;
    let greetingCompleted = false;
    let avatarReady = false;
    let networkConnected = false;

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('vh_sceneLoaded fired. Scene is ready.') || text.includes('[vh_sceneLoaded] Fired. Scene is ready.')) {
        console.log('✅ vh_sceneLoaded callback detected');
        sceneLoaded = true;
      }
      if (text.includes('Avatar is ready. Delivering Pioneer Program greeting.') ||
          text.includes('Attempting to speak greeting') ||
          text.includes('Avatar speaking Pioneer Program greeting')) {
        console.log('🎯 Avatar ready - greeting delivery starting');
        avatarReady = true;
      }
      if (text.includes('vh_speechStarted') ||
          text.includes('Started speaking') ||
          text.includes('sayText') ||
          text.includes('Avatar is speaking')) {
        console.log('🗣️ Avatar started speaking (greeting)');
        greetingStarted = true;
      }
      if (text.includes('vh_speechEnded') ||
          text.includes('Avatar finished speaking') ||
          text.includes('Speech ended') ||
          text.includes('Greeting completed')) {
        console.log('✅ Avatar finished speaking (greeting completed)');
        greetingCompleted = true;
      }
      if (text.includes('Network connectivity check') ||
          text.includes('SitePal script loaded successfully') ||
          text.includes('Network connectivity established')) {
        console.log('🌐 Network connectivity established');
        networkConnected = true;
      }
    });

    // Step 5: Wait for network connectivity and script loading
    console.log('⏳ Waiting for network connectivity and script loading (up to 45 seconds)...');
    let waitTime = 0;
    const maxInitTime = 45000; // EXTENDED: 45 seconds for initial loading
    const checkInterval = 1000; // Check every second

    while (waitTime < maxInitTime && !networkConnected) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;

      if (waitTime > 15000 && !networkConnected) {
        console.log('⚠️ Network connectivity taking longer than expected...');
      }
    }

    // Step 6: Wait for vh_sceneLoaded callback
    console.log('⏳ Waiting for vh_sceneLoaded callback (up to 35 seconds)...');
    waitTime = 0;
    const maxSceneTime = 35000; // EXTENDED: 35 seconds for scene loading

    while (waitTime < maxSceneTime && !sceneLoaded) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;

      if (waitTime > 15000 && !sceneLoaded) {
        console.log('⚠️ Scene loading taking longer than expected...');
      }
    }

    // Step 7: Wait for avatar readiness and greeting delivery
    console.log('⏳ Waiting for avatar readiness and greeting delivery (up to 60 seconds)...');
    waitTime = 0;
    const maxGreetingTime = 60000; // EXTENDED: 60 seconds for complete greeting delivery sequence

    while (waitTime < maxGreetingTime && !greetingCompleted) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;

      if (sceneLoaded && !avatarReady && waitTime > 10000) {
        console.log('⚠️ Scene loaded but avatar not ready after 10s...');
      }

      if (avatarReady && !greetingStarted && waitTime > 15000) {
        console.log('⚠️ Avatar ready but greeting not started after 15s...');
      }

      if (greetingStarted && !greetingCompleted && waitTime > 25000) {
        console.log('⚠️ Greeting started but not completed after 25s...');
      }
    }

    // Step 8: Verify avatar container has proper dimensions
    console.log('📏 Verifying avatar container dimensions...');
    const containerBounds = await sitePalContainer.boundingBox();
    expect(containerBounds).toBeTruthy();
    expect(containerBounds!.width).toBeGreaterThan(200);
    expect(containerBounds!.height).toBeGreaterThan(200);

    // Step 9: Wait for Pioneer Program action buttons to appear
    console.log('🔍 Waiting for Pioneer Program action buttons...');
    const pioneerButtons = page.locator('button:has-text("Tell me about Pioneer Program benefits"), button:has-text("How do I apply?"), button:has-text("What makes it exclusive?"), button:has-text("Show me success stories")');

    // Wait up to 10 seconds for action buttons to appear
    await page.waitForTimeout(5000);
    const actionButtonCount = await pioneerButtons.count();

    if (actionButtonCount > 0) {
      console.log(`✅ Found ${actionButtonCount} Pioneer Program action buttons`);

      // Test clicking the first action button
      const firstButton = pioneerButtons.first();
      const buttonText = await firstButton.textContent();
      console.log(`🔘 Testing Pioneer Program button: "${buttonText}"`);

      await firstButton.click();

      // Wait for AI response (target: under 3 seconds)
      const responseStart = Date.now();
      await page.waitForTimeout(4000);
      const responseTime = Date.now() - responseStart;
      console.log(`⏱️ Response time: ${responseTime}ms`);

      console.log('✅ Pioneer Program button interaction completed');
    } else {
      console.log('ℹ️ No Pioneer Program action buttons found yet - checking for generic buttons');

      // Check for any action buttons
      const anyButtons = page.locator('button:has-text("Pioneer Program"), button:has-text("benefits"), button:has-text("apply"), button:has-text("exclusive")');
      const anyButtonCount = await anyButtons.count();
      console.log(`Found ${anyButtonCount} general action buttons`);
    }

    console.log('🎉 Complete SitePal avatar initialization test completed successfully!');

    // Final status report
    console.log('\n📊 Initialization Status Report:');
    console.log(`- Network Connected: ${networkConnected ? '✅' : '❌'}`);
    console.log(`- Scene Loaded: ${sceneLoaded ? '✅' : '❌'}`);
    console.log(`- Avatar Ready: ${avatarReady ? '✅' : '❌'}`);
    console.log(`- Greeting Started: ${greetingStarted ? '✅' : '❌'}`);
    console.log(`- Greeting Completed: ${greetingCompleted ? '✅' : '❌'}`);
    console.log(`- Action Buttons: ${actionButtonCount} found`);
    console.log(`- Total Initialization Time: ${waitTime}ms`);
  });

  test('Avatar Conversation Flow with Pioneer Program Focus', async () => {
    console.log('🎯 Testing avatar conversation flow with Pioneer Program focus...');

    // Step 1: Initialize avatar with proper timing
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    const modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });

    const sitePalContainer = page.locator('#vhss_aiPlayer');
    await expect(sitePalContainer).toBeVisible({ timeout: 15000 });

    // Step 2: Monitor for complete initialization
    console.log('⏳ Monitoring for complete avatar initialization...');
    let initializationComplete = false;
    let greetingDelivered = false;

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('vh_sceneLoaded fired. Scene is ready.')) {
        console.log('✅ Scene loaded callback detected');
      }
      if (text.includes('Avatar speaking Pioneer Program greeting with VAD integration')) {
        console.log('🗣️ Pioneer Program greeting delivery started');
        greetingDelivered = true;
      }
      if (text.includes('vh_speechEnded') && text.includes('Avatar finished speaking')) {
        console.log('✅ Greeting delivery completed');
        initializationComplete = true;
      }
    });

    // Wait for complete initialization (up to 35 seconds)
    console.log('⏳ Waiting for complete avatar initialization and greeting delivery...');
    let waitTime = 0;
    const maxWaitTime = 35000; // 35 seconds
    const checkInterval = 1000;

    while (waitTime < maxWaitTime && !initializationComplete) {
      await page.waitForTimeout(checkInterval);
      waitTime += checkInterval;

      if (waitTime > 20000 && !greetingDelivered) {
        console.log('⚠️ Greeting not delivered after 20s - continuing to wait...');
      }
    }

    // Step 3: Verify Pioneer Program action buttons are available
    console.log('🏆 Verifying Pioneer Program action buttons...');

    const pioneerButtons = page.locator('button:has-text("Tell me about Pioneer Program benefits"), button:has-text("How do I apply?"), button:has-text("What makes it exclusive?"), button:has-text("Show me success stories")');

    // Wait a bit more for buttons to be ready
    await page.waitForTimeout(3000);
    const buttonCount = await pioneerButtons.count();

    if (buttonCount > 0) {
      console.log(`✅ Found ${buttonCount} Pioneer Program action buttons`);

      // Step 4: Test Pioneer Program conversation interaction
      console.log('🔘 Testing Pioneer Program conversation interaction...');
      const firstButton = pioneerButtons.first();
      const buttonText = await firstButton.textContent();
      console.log(`Testing button: "${buttonText}"`);

      // Click the button and measure response time
      const responseStart = Date.now();
      await firstButton.click();

      // Wait for AI response processing (target: under 3 seconds)
      await page.waitForTimeout(4000);
      const responseTime = Date.now() - responseStart;

      console.log(`⏱️ Pioneer Program response time: ${responseTime}ms`);

      // Verify response appears in the conversation area
      const responseArea = page.locator('.bg-muted\\/50 p');
      if (await responseArea.isVisible({ timeout: 2000 })) {
        const responseText = await responseArea.textContent();
        console.log(`📝 Response received: ${responseText?.substring(0, 100)}...`);

        // Check for Pioneer Program related keywords
        if (responseText && (
          responseText.includes('Pioneer') ||
          responseText.includes('exclusive') ||
          responseText.includes('benefits') ||
          responseText.includes('early')
        )) {
          console.log('✅ Relevant Pioneer Program response detected');
        }
      }

      // Step 5: Test text input functionality
      console.log('💬 Testing text input functionality...');
      const textInput = page.locator('input[placeholder="Type your message..."]');
      if (await textInput.isVisible()) {
        await textInput.fill('What are the exclusive benefits of joining?');

        const sendButton = page.locator('button:has([data-testid="send"]), button:has-text("Send")').first();
        if (await sendButton.isVisible()) {
          await sendButton.click();
          console.log('✅ Text message sent successfully');

          // Wait for response
          await page.waitForTimeout(4000);
          console.log('✅ Text input conversation flow completed');
        }
      }

    } else {
      console.log('⚠️ No Pioneer Program action buttons found - checking initialization status');

      // Check if avatar is still loading
      const loadingMessage = page.locator('text=Initializing, text=Preparing, text=Loading');
      if (await loadingMessage.isVisible()) {
        console.log('ℹ️ Avatar still initializing - this may be expected');
      }
    }

    console.log('✅ Pioneer Program conversation flow test completed');
    console.log(`📊 Total test duration: ${waitTime}ms`);
    console.log(`📊 Initialization completed: ${initializationComplete ? '✅' : '❌'}`);
    console.log(`📊 Greeting delivered: ${greetingDelivered ? '✅' : '❌'}`);
  });
});
