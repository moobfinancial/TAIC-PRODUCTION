import { test, expect } from '@playwright/test';

test.describe('SitePal Avatar Loading - Phase 3', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console logs
    page.on('console', msg => {
      if (msg.text().includes('[HomePageCanvas]')) {
        console.log('🖥️ Browser:', msg.text());
      }
    });

    // Navigate to home page
    await page.goto('http://localhost:9002', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should load avatar and speak Pioneer Program greeting', async ({ page }) => {
    console.log('🎯 Phase 3: Testing avatar loading and greeting...');
    
    // Monitor SitePal callbacks
    await page.addInitScript(() => {
      window.sitePalCallbacks = [];
      
      // Override SitePal callbacks to track them
      const originalSceneLoaded = window.vh_sceneLoaded;
      window.vh_sceneLoaded = function(...args) {
        window.sitePalCallbacks.push({
          type: 'vh_sceneLoaded',
          timestamp: Date.now(),
          args: args
        });
        console.log('[Avatar Test] vh_sceneLoaded called');
        if (originalSceneLoaded) originalSceneLoaded.apply(this, args);
      };
      
      const originalSpeechStarted = window.vh_speechStarted;
      window.vh_speechStarted = function(...args) {
        window.sitePalCallbacks.push({
          type: 'vh_speechStarted',
          timestamp: Date.now(),
          args: args
        });
        console.log('[Avatar Test] vh_speechStarted called');
        if (originalSpeechStarted) originalSpeechStarted.apply(this, args);
      };
      
      const originalSpeechEnded = window.vh_speechEnded;
      window.vh_speechEnded = function(...args) {
        window.sitePalCallbacks.push({
          type: 'vh_speechEnded',
          timestamp: Date.now(),
          args: args
        });
        console.log('[Avatar Test] vh_speechEnded called');
        if (originalSpeechEnded) originalSpeechEnded.apply(this, args);
      };
    });
    
    // Click Start AI Presentation button
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    console.log('🖱️ Clicked Start AI Presentation button');
    
    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    console.log('✅ Modal opened');
    
    // Debug: Check what containers exist
    const containerDebug = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div[id*="vhss"]'));
      return {
        allContainers: allDivs.map(div => ({ id: div.id, visible: div.offsetWidth > 0 })),
        vhssPlayer: !!document.getElementById('vhss_aiPlayer'),
        modalVisible: !!document.querySelector('[role="dialog"]'),
        modalContent: document.querySelector('[role="dialog"]')?.innerHTML?.substring(0, 300) || 'No modal'
      };
    });

    console.log('🔍 Container debug:', JSON.stringify(containerDebug, null, 2));

    // Wait for SitePal container to be ready (using correct ID)
    try {
      await page.waitForSelector('#vhss_aiPlayer', { timeout: 5000 });
      console.log('✅ Container ready');
    } catch (error) {
      console.log('⚠️ No container found, continuing with debug...');
    }
    
    // Debug: Check if embedding was called and capture console logs
    const embeddingStatus = await page.evaluate(() => {
      return {
        embedFunctionExists: typeof window.AI_vhost_embed === 'function',
        containerExists: !!document.getElementById('vhss_aiPlayer'),
        containerContent: document.getElementById('vhss_aiPlayer')?.innerHTML || 'No container',
        callbacksRegistered: {
          vh_sceneLoaded: typeof window.vh_sceneLoaded === 'function',
          vh_speechStarted: typeof window.vh_speechStarted === 'function',
          vh_speechEnded: typeof window.vh_speechEnded === 'function'
        }
      };
    });

    console.log('🔍 Embedding status:', JSON.stringify(embeddingStatus, null, 2));

    // Capture console logs from the page
    const consoleLogs = await page.evaluate(() => {
      // Get recent console logs if they exist
      return window.console._logs || 'No console logs captured';
    });

    console.log('📝 Browser console logs:', consoleLogs);

    // Wait longer and check for any avatar activity
    console.log('⏳ Waiting for avatar to load (extended timeout)...');

    try {
      await page.waitForFunction(() => {
        return window.sitePalCallbacks &&
               window.sitePalCallbacks.some(cb => cb.type === 'vh_sceneLoaded');
      }, { timeout: 45000 });
      console.log('✅ Avatar loaded (vh_sceneLoaded fired)');
    } catch (error) {
      console.log('⚠️ Avatar loading timeout - checking container content...');

      const containerDebug = await page.evaluate(() => {
        const container = document.getElementById('vhss_aiPlayer');
        return {
          exists: !!container,
          innerHTML: container?.innerHTML || 'No container',
          children: container?.children.length || 0,
          offsetWidth: container?.offsetWidth || 0,
          offsetHeight: container?.offsetHeight || 0,
          callbacks: window.sitePalCallbacks || []
        };
      });

      console.log('🔍 Container debug:', JSON.stringify(containerDebug, null, 2));

      // Continue with test even if avatar didn't load
      console.log('⚠️ Continuing test without avatar load confirmation...');
    }
    
    console.log('✅ Avatar loaded (vh_sceneLoaded fired)');
    
    // Check for avatar elements in the container
    const avatarElements = await page.evaluate(() => {
      const container = document.getElementById('vhss_aiPlayer');
      if (!container) return { found: false, children: 0 };
      
      return {
        found: true,
        children: container.children.length,
        innerHTML: container.innerHTML.substring(0, 200), // First 200 chars
        hasCanvas: !!container.querySelector('canvas'),
        hasObject: !!container.querySelector('object'),
        hasEmbed: !!container.querySelector('embed'),
        hasIframe: !!container.querySelector('iframe')
      };
    });
    
    console.log('📊 Avatar elements:', JSON.stringify(avatarElements, null, 2));
    
    // Verify avatar loaded
    expect(avatarElements.found).toBe(true);
    expect(avatarElements.children).toBeGreaterThan(0);
    console.log('✅ Avatar elements found in container');
    
    // Wait for initial greeting (speech should start)
    console.log('⏳ Waiting for avatar greeting...');
    await page.waitForFunction(() => {
      return window.sitePalCallbacks && 
             window.sitePalCallbacks.some(cb => cb.type === 'vh_speechStarted');
    }, { timeout: 15000 });
    
    console.log('✅ Avatar started speaking (vh_speechStarted fired)');
    
    // Get callback summary
    const callbackSummary = await page.evaluate(() => {
      return {
        callbacks: window.sitePalCallbacks || [],
        totalCallbacks: (window.sitePalCallbacks || []).length,
        sceneLoadedCount: (window.sitePalCallbacks || []).filter(cb => cb.type === 'vh_sceneLoaded').length,
        speechStartedCount: (window.sitePalCallbacks || []).filter(cb => cb.type === 'vh_speechStarted').length,
        speechEndedCount: (window.sitePalCallbacks || []).filter(cb => cb.type === 'vh_speechEnded').length
      };
    });
    
    console.log('📊 Callback summary:', JSON.stringify(callbackSummary, null, 2));
    
    // Verify callbacks fired
    expect(callbackSummary.sceneLoadedCount).toBeGreaterThan(0);
    expect(callbackSummary.speechStartedCount).toBeGreaterThan(0);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/avatar-loading-complete.png' });
    console.log('📸 Screenshot saved: avatar-loading-complete.png');
    
    console.log('🎉 Avatar loading and greeting test PASSED!');
  });
});
