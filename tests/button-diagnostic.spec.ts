import { test, expect } from '@playwright/test';

test.describe('Button Diagnostic Test', () => {
  test('Diagnose Start AI Presentation button rendering issue', async ({ page }) => {
    console.log('🔍 Starting button diagnostic test...');

    // Set up console error monitoring from the start
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`🚨 Console Error: ${msg.text()}`);
      }
    });

    // Navigate to home page
    console.log('📍 Navigating to localhost:9002...');
    await page.goto('http://localhost:9002');

    // PROGRESSIVE LOADING VERIFICATION - Step 1: Basic HTML Structure
    console.log('⏳ Step 1: Waiting for DOM content to load...');
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ DOM content loaded');

    // PROGRESSIVE LOADING VERIFICATION - Step 2: Wait for React to be available
    console.log('⏳ Step 2: Waiting for React framework to initialize...');
    try {
      await page.waitForFunction(() => {
        return typeof window !== 'undefined' &&
               (window as any).React !== undefined ||
               document.readyState === 'complete';
      }, { timeout: 10000 });
      console.log('✅ React framework initialized');
    } catch (error) {
      console.log('⚠️ React framework check timed out, continuing...');
    }

    // PROGRESSIVE LOADING VERIFICATION - Step 3: Wait for main content container
    console.log('⏳ Step 3: Waiting for main content container...');
    try {
      await page.waitForSelector('main, [role="main"], body > div', { timeout: 15000 });
      console.log('✅ Main content container found');
    } catch (error) {
      console.log('⚠️ Main content container not found, continuing...');
    }

    // PROGRESSIVE LOADING VERIFICATION - Step 4: Wait for network to be idle
    console.log('⏳ Step 4: Waiting for network idle state...');
    await page.waitForLoadState('networkidle');
    console.log('✅ Network idle state reached');

    // PROGRESSIVE LOADING VERIFICATION - Step 5: Additional wait for component hydration
    console.log('⏳ Step 5: Additional wait for React component hydration...');
    await page.waitForTimeout(5000);
    console.log('✅ Component hydration wait completed');

    // PROGRESSIVE LOADING VERIFICATION - Step 6: Verify document ready state
    console.log('⏳ Step 6: Verifying document ready state...');
    const readyState = await page.evaluate(() => document.readyState);
    console.log(`📋 Document ready state: ${readyState}`);
    
    // Take full page screenshot for visual inspection
    await page.screenshot({ 
      path: 'test-results/button-diagnostic-full-page.png', 
      fullPage: true 
    });
    console.log('📸 Full page screenshot saved');
    
    // Log page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page Title: "${title}"`);
    console.log(`🔗 Page URL: ${url}`);
    
    // Check for HomePageSitePalIntegration component with retry logic
    console.log('🔍 Searching for HomePageSitePalIntegration component...');
    let componentExists = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const sitePalComponent = page.locator('[class*="HomePageSitePalIntegration"], [data-testid*="sitepal"], [id*="sitepal"], [class*="interactive-ai"]');
      componentExists = await sitePalComponent.count();
      console.log(`   Attempt ${attempt}: HomePageSitePalIntegration component elements found: ${componentExists}`);
      if (componentExists > 0) break;
      await page.waitForTimeout(2000);
    }

    // Log all button elements on the page with retry logic
    console.log('🔍 Searching for button elements...');
    let buttonCount = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const allButtons = page.locator('button');
      buttonCount = await allButtons.count();
      console.log(`   Attempt ${attempt}: Total buttons found on page: ${buttonCount}`);

      if (buttonCount > 0) {
        for (let i = 0; i < Math.min(buttonCount, 10); i++) { // Limit to first 10 buttons
          const button = allButtons.nth(i);
          const buttonText = await button.textContent();
          const isVisible = await button.isVisible();
          const buttonClass = await button.getAttribute('class');
          console.log(`      Button ${i + 1}: "${buttonText}" | Visible: ${isVisible} | Classes: ${buttonClass}`);
        }
        break;
      }
      await page.waitForTimeout(2000);
    }
    
    // Check for specific text content with retry logic
    console.log('🔍 Searching for "Start AI Presentation" text...');
    let textCount = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const startAIText = page.locator('text=Start AI Presentation');
      textCount = await startAIText.count();
      console.log(`   Attempt ${attempt}: "Start AI Presentation" text found: ${textCount} times`);
      if (textCount > 0) {
        for (let i = 0; i < textCount; i++) {
          const element = startAIText.nth(i);
          const tagName = await element.evaluate(el => el.tagName);
          const isVisible = await element.isVisible();
          const parentClass = await element.evaluate(el => el.parentElement?.className || 'no-parent');
          console.log(`      Text instance ${i + 1}: <${tagName}> | Visible: ${isVisible} | Parent class: ${parentClass}`);
        }
        break;
      }
      await page.waitForTimeout(2000);
    }

    // Check for specific button with exact text using multiple selectors
    console.log('🔍 Searching for "Start AI Presentation" button with multiple strategies...');
    let targetButtonExists = 0;

    // Strategy 1: Text-based selector
    const targetButton1 = page.locator('button:has-text("Start AI Presentation")');
    const count1 = await targetButton1.count();
    console.log(`   Strategy 1 (text-based): ${count1} buttons found`);

    // Strategy 2: ARIA role-based selector
    const targetButton2 = page.getByRole('button', { name: /start ai presentation/i });
    const count2 = await targetButton2.count();
    console.log(`   Strategy 2 (ARIA role): ${count2} buttons found`);

    // Strategy 3: Partial text filter
    const targetButton3 = page.locator('button').filter({ hasText: 'Start AI' });
    const count3 = await targetButton3.count();
    console.log(`   Strategy 3 (partial text): ${count3} buttons found`);

    // Strategy 4: CSS class-based (gradient styling)
    const targetButton4 = page.locator('button[class*="gradient"]');
    const count4 = await targetButton4.count();
    console.log(`   Strategy 4 (gradient class): ${count4} buttons found`);

    targetButtonExists = Math.max(count1, count2, count3, count4);
    console.log(`🎯 Best result: ${targetButtonExists} "Start AI Presentation" buttons found`);
    
    // Check for Play icon (which should be in the button)
    const playIcon = page.locator('[class*="lucide-play"], svg[class*="play"]');
    const playIconCount = await playIcon.count();
    console.log(`▶️ Play icons found: ${playIconCount}`);
    
    // Additional wait to capture any delayed console errors
    await page.waitForTimeout(2000);
    
    // Console error summary
    if (consoleErrors.length > 0) {
      console.log('🚨 Console errors detected:');
      consoleErrors.forEach((error, index) => {
        console.log(`   Error ${index + 1}: ${error}`);
      });
    } else {
      console.log('✅ No console errors detected');
    }
    
    // Check if user is authenticated (might affect button visibility)
    const authElements = page.locator('[class*="auth"], [data-testid*="auth"], button:has-text("Login"), button:has-text("Connect Wallet")');
    const authElementCount = await authElements.count();
    console.log(`🔐 Authentication-related elements found: ${authElementCount}`);
    
    // Log the HTML structure around where the button should be
    const mainContent = page.locator('main, [role="main"], .main-content');
    const mainHTML = await mainContent.innerHTML().catch(() => 'Could not get main content HTML');
    console.log('🏗️ Main content structure preview (first 500 chars):');
    console.log(mainHTML.substring(0, 500) + '...');
    
    // Final assertion to make test fail if button not found (for visibility in test results)
    if (targetButtonExists === 0) {
      console.log('🚨 DIAGNOSTIC RESULT: "Start AI Presentation" button NOT FOUND');
      throw new Error(`DIAGNOSTIC FAILURE: Expected "Start AI Presentation" button not found. Found ${buttonCount} total buttons on page.`);
    } else {
      console.log('✅ DIAGNOSTIC RESULT: "Start AI Presentation" button FOUND');
    }
  });
});
