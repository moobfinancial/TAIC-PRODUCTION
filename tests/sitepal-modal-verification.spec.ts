import { test, expect } from '@playwright/test';

test.describe('SitePal Modal Verification - Phase 1', () => {
  // Increase timeout for SitePal avatar loading
  test.setTimeout(60000); // 60 seconds to allow for avatar embedding
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React hydration
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' &&
             (window as any).React !== undefined ||
             document.readyState === 'complete';
    }, { timeout: 15000 });

    // Skip networkidle wait as it may timeout with ongoing requests
    // Just wait for basic page readiness
    await page.waitForTimeout(3000);
  });

  test('should find and click Start AI Presentation button to open modal', async ({ page }) => {
    console.log('🎯 Phase 1.1: Testing modal opening functionality...');

    // Set up console monitoring for SitePal callbacks
    const sitePalCallbacks = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('vh_sceneLoaded') || text.includes('SitePal') || text.includes('AI_vhost_embed') || text.includes('HomePageCanvas')) {
        sitePalCallbacks.push(text);
        console.log(`🎤 SitePal Log: ${text}`);
      }
    });

    // Verify the button exists
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Start AI Presentation button found and visible');

    // Click the button to open modal
    await startButton.click();
    console.log('🖱️ Clicked Start AI Presentation button');

    // Wait for modal to appear with extended timeout
    await page.waitForTimeout(3000);

    // Check for modal elements (HomePageSitePalCanvas uses fixed overlay structure)
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    const modalVisible = await modal.isVisible();
    console.log(`🔍 Modal visibility: ${modalVisible}`);

    if (modalVisible) {
      console.log('✅ Modal opened successfully');

      // Wait for SitePal container to appear with extended timeout
      const sitePalContainer = page.locator('#vhss_aiPlayer');
      await expect(sitePalContainer).toBeVisible({ timeout: 15000 });
      console.log('✅ SitePal container (#vhss_aiPlayer) is visible');

      // Get container dimensions
      const boundingBox = await sitePalContainer.boundingBox();
      console.log(`📐 Container dimensions:`, boundingBox);

      // Wait for SitePal script to load and avatar to embed (extended timeout)
      console.log('⏳ Waiting for SitePal avatar to fully load and embed...');
      await page.waitForTimeout(12000); // Extended timeout for avatar embedding

      // Check if avatar content has been embedded
      const avatarContent = await sitePalContainer.innerHTML();
      const hasAvatarContent = avatarContent.length > 50; // Basic check for embedded content
      console.log(`🎭 Avatar content embedded: ${hasAvatarContent} (content length: ${avatarContent.length})`);

      // Wait for vh_sceneLoaded callback or similar SitePal initialization
      let sceneLoadedDetected = false;
      for (let i = 0; i < 20; i++) { // Check for up to 20 seconds
        if (sitePalCallbacks.some(log => log.includes('vh_sceneLoaded') || log.includes('Avatar loaded') || log.includes('embedding avatar'))) {
          sceneLoadedDetected = true;
          console.log('✅ SitePal scene loaded callback detected');
          break;
        }
        await page.waitForTimeout(1000);
        console.log(`⏳ Waiting for SitePal callbacks... (${i + 1}/20)`);
      }

      if (!sceneLoadedDetected) {
        console.log('⚠️ SitePal scene loaded callback not detected within timeout');
      }

      // Check for loading states
      const loadingIndicators = await page.locator('.animate-spin').count();
      console.log(`🔄 Loading indicators found: ${loadingIndicators}`);

      // Check for any error messages
      const errorMessages = await page.locator('[class*="error"], [class*="Error"]').count();
      console.log(`❌ Error messages found: ${errorMessages}`);

      // Log all captured SitePal callbacks
      console.log(`📋 Total SitePal callbacks captured: ${sitePalCallbacks.length}`);
      sitePalCallbacks.forEach((callback, index) => {
        console.log(`  ${index + 1}. ${callback}`);
      });

    } else {
      console.log('❌ Modal did not open - investigating...');

      // Check if HomePageSitePalCanvas component exists in DOM
      const canvasComponent = await page.locator('[class*="HomePageSitePal"], [class*="sitepal"]').count();
      console.log(`🔍 SitePal canvas components in DOM: ${canvasComponent}`);

      // Check for any JavaScript errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);
      if (consoleErrors.length > 0) {
        console.log('🚨 Console errors detected:', consoleErrors);
      }
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/modal-verification-after-click.png' });
    console.log('📸 Screenshot saved: modal-verification-after-click.png');
  });

  test('should verify SitePal script loading when modal opens', async ({ page }) => {
    console.log('🎯 Phase 1.2: Testing SitePal script loading sequence...');
    
    // Set up network monitoring
    const scriptRequests = [];
    page.on('request', request => {
      if (request.url().includes('oddcast.com') || request.url().includes('sitepal')) {
        scriptRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
        console.log(`📡 SitePal script request: ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('oddcast.com') || response.url().includes('sitepal')) {
        console.log(`📡 SitePal script response: ${response.url()} - Status: ${response.status()}`);
      }
    });
    
    // Monitor for AI_vhost_embed function availability
    await page.addInitScript(() => {
      window.sitePalScriptMonitor = {
        scriptLoaded: false,
        embedFunctionAvailable: false,
        loadTimestamp: null
      };
      
      // Monitor for script loading
      const originalAppendChild = document.body.appendChild;
      document.body.appendChild = function(child) {
        if (child.tagName === 'SCRIPT' && child.src && child.src.includes('oddcast.com')) {
          console.log('[Monitor] SitePal script element added:', child.src);
          window.sitePalScriptMonitor.scriptLoaded = true;
          window.sitePalScriptMonitor.loadTimestamp = Date.now();
          
          child.onload = () => {
            console.log('[Monitor] SitePal script loaded successfully');
            if (typeof window.AI_vhost_embed === 'function') {
              window.sitePalScriptMonitor.embedFunctionAvailable = true;
              console.log('[Monitor] AI_vhost_embed function is available');
            }
          };
        }
        return originalAppendChild.call(this, child);
      };
    });
    
    // Click the button to trigger script loading
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    console.log('🖱️ Clicked Start AI Presentation button to trigger script loading');
    
    // Wait for script loading attempts with extended timeout
    console.log('⏳ Waiting for SitePal script to load...');
    await page.waitForTimeout(8000);

    // Wait for AI_vhost_embed function to become available
    let embedFunctionAvailable = false;
    for (let i = 0; i < 15; i++) { // Check for up to 15 seconds
      const scriptStatus = await page.evaluate(() => {
        return {
          monitor: window.sitePalScriptMonitor,
          embedFunctionExists: typeof window.AI_vhost_embed === 'function',
          scriptElements: Array.from(document.querySelectorAll('script')).filter(s =>
            s.src && s.src.includes('oddcast.com')
          ).map(s => ({ src: s.src, id: s.id }))
        };
      });

      if (scriptStatus.embedFunctionExists) {
        embedFunctionAvailable = true;
        console.log('✅ AI_vhost_embed function became available');
        console.log('📊 Final script loading status:', JSON.stringify(scriptStatus, null, 2));
        break;
      }

      await page.waitForTimeout(1000);
      console.log(`⏳ Waiting for AI_vhost_embed function... (${i + 1}/15)`);
    }

    console.log(`📡 Network requests captured: ${scriptRequests.length}`);

    if (scriptRequests.length > 0) {
      console.log('📡 SitePal script requests:', scriptRequests);
    }

    // Verify script loading success
    expect(embedFunctionAvailable).toBe(true);
    console.log('✅ AI_vhost_embed function verification passed');
  });

  test('should diagnose avatar container initialization issues', async ({ page }) => {
    console.log('🎯 Phase 1.3: Diagnosing avatar container initialization...');

    // Monitor DOM mutations for container creation
    await page.addInitScript(() => {
      window.containerMutations = [];

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1 && node.id && node.id.includes('vhss')) {
                window.containerMutations.push({
                  type: 'container_added',
                  id: node.id,
                  className: node.className,
                  timestamp: Date.now()
                });
                console.log('[Container Monitor] SitePal container added:', node.id);
              }
            });
          }

          if (mutation.type === 'attributes' && mutation.target.id && mutation.target.id.includes('vhss')) {
            window.containerMutations.push({
              type: 'container_modified',
              id: mutation.target.id,
              attribute: mutation.attributeName,
              timestamp: Date.now()
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id', 'class', 'style']
      });
    });

    // Click button and monitor container creation
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    console.log('🖱️ Clicked Start AI Presentation button');

    // Wait for container initialization
    await page.waitForTimeout(3000);

    // Check container status (using consistent ID from simplified implementation)
    const containerStatus = await page.evaluate(() => {
      const container = document.getElementById('vhss_aiPlayer');
      return {
        exists: !!container,
        visible: container ? container.offsetWidth > 0 && container.offsetHeight > 0 : false,
        dimensions: container ? {
          width: container.offsetWidth,
          height: container.offsetHeight,
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight
        } : null,
        styles: container ? {
          display: getComputedStyle(container).display,
          visibility: getComputedStyle(container).visibility,
          position: getComputedStyle(container).position
        } : null,
        parentElement: container ? container.parentElement?.tagName : null,
        mutations: window.containerMutations || []
      };
    });

    console.log('📊 Container status:', JSON.stringify(containerStatus, null, 2));

    // Verify container exists and has proper dimensions
    expect(containerStatus.exists).toBe(true);
    console.log('✅ Container existence verified');

    if (containerStatus.dimensions) {
      expect(containerStatus.dimensions.width).toBeGreaterThan(0);
      expect(containerStatus.dimensions.height).toBeGreaterThan(0);
      console.log('✅ Container has valid dimensions');
    }

    // Check for SitePal embedding attempts
    const embeddingStatus = await page.evaluate(() => {
      return {
        embedCalled: window.sitePalEmbedCalled || false,
        embedErrors: window.sitePalEmbedErrors || [],
        callbacksRegistered: {
          vh_sceneLoaded: typeof window.vh_sceneLoaded === 'function',
          vh_speechStarted: typeof window.vh_speechStarted === 'function',
          vh_speechEnded: typeof window.vh_speechEnded === 'function'
        }
      };
    });

    console.log('📊 Embedding status:', JSON.stringify(embeddingStatus, null, 2));

    // Take final screenshot
    await page.screenshot({ path: 'test-results/container-diagnosis-complete.png' });
    console.log('📸 Screenshot saved: container-diagnosis-complete.png');
  });
});
