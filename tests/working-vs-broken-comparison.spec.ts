import { test, expect } from '@playwright/test';

test.describe('Working vs Broken SitePal Comparison', () => {
  test('TEST AVATAR PAGE (Working Baseline) - Should find Open Canvas button and avatar container', async ({ page }) => {
    console.log('🚀 Testing WORKING test-avatar page...');
    
    // Navigate to the test-avatar page
    await page.goto('http://localhost:9002/test-avatar');
    console.log('📍 Navigated to test-avatar page');
    
    // Progressive loading verification
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ DOM content loaded');
    
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             (window as any).React !== undefined || 
             document.readyState === 'complete';
    }, { timeout: 10000 });
    console.log('✅ React framework initialized');
    
    await page.waitForLoadState('networkidle');
    console.log('✅ Network idle state reached');
    
    await page.waitForTimeout(3000);
    console.log('✅ Component hydration wait completed');
    
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/working-test-avatar.png', fullPage: true });
    console.log('📸 Test avatar page screenshot saved');
    
    // Get page title
    const pageTitle = await page.title();
    console.log(`📄 Page Title: "${pageTitle}"`);
    
    // Check for page content
    const totalButtons = await page.locator('button').count();
    console.log(`🔍 Total buttons found: ${totalButtons}`);
    
    // Check for "Open Canvas" button
    const openCanvasButton = await page.locator('button:has-text("Open Canvas")').count();
    console.log(`🔍 "Open Canvas" buttons found: ${openCanvasButton}`);
    
    // Check for "Avatar Test Page" heading
    const testPageHeading = await page.locator('h1:has-text("Avatar Test Page")').count();
    console.log(`🔍 "Avatar Test Page" heading found: ${testPageHeading}`);
    
    // Check for vhss_aiPlayer container (should be visible since canvas opens by default)
    const avatarContainer = await page.locator('#vhss_aiPlayer').count();
    console.log(`🔍 Avatar container (#vhss_aiPlayer) found: ${avatarContainer}`);
    
    // Check for Pioneer_AMA_Canvas component
    const canvasComponent = await page.locator('[class*="Pioneer"], [class*="Canvas"]').count();
    console.log(`🔍 Canvas component elements found: ${canvasComponent}`);
    
    // Log console errors
    if (consoleErrors.length > 0) {
      console.log(`🚨 Console errors: ${consoleErrors.join(', ')}`);
    } else {
      console.log('✅ No console errors detected');
    }
    
    // Assertions for working page
    expect(pageTitle).toBeDefined();
    expect(totalButtons).toBeGreaterThan(0);
    expect(testPageHeading).toBeGreaterThan(0);
    
    console.log('✅ TEST AVATAR PAGE: All checks passed - this is our working baseline!');
  });

  test('HOME PAGE (Broken) - Should find Start AI Presentation button but currently fails', async ({ page }) => {
    console.log('🚀 Testing BROKEN home page...');
    
    // Navigate to the home page
    await page.goto('http://localhost:9002');
    console.log('📍 Navigated to home page');
    
    // Progressive loading verification
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ DOM content loaded');
    
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             (window as any).React !== undefined || 
             document.readyState === 'complete';
    }, { timeout: 10000 });
    console.log('✅ React framework initialized');
    
    await page.waitForLoadState('networkidle');
    console.log('✅ Network idle state reached');
    
    await page.waitForTimeout(3000);
    console.log('✅ Component hydration wait completed');
    
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/broken-home-page.png', fullPage: true });
    console.log('📸 Home page screenshot saved');
    
    // Get page title
    const pageTitle = await page.title();
    console.log(`📄 Page Title: "${pageTitle}"`);
    
    // Check for page content
    const totalButtons = await page.locator('button').count();
    console.log(`🔍 Total buttons found: ${totalButtons}`);
    
    // Check for "Start AI Presentation" button
    const startAIButton = await page.locator('button:has-text("Start AI Presentation")').count();
    console.log(`🔍 "Start AI Presentation" buttons found: ${startAIButton}`);
    
    // Check for HomePageSitePalIntegration component
    const sitePalComponent = await page.locator('[class*="HomePageSitePal"], [class*="interactive-ai"]').count();
    console.log(`🔍 SitePal component elements found: ${sitePalComponent}`);
    
    // Check for TAIC branding/content
    const taicContent = await page.locator('text="TAIC"').count();
    console.log(`🔍 TAIC content found: ${taicContent}`);
    
    // Log console errors
    if (consoleErrors.length > 0) {
      console.log(`🚨 Console errors: ${consoleErrors.join(', ')}`);
    } else {
      console.log('✅ No console errors detected');
    }
    
    // Get main content structure for debugging
    try {
      const mainContent = await page.locator('main, body > div').first().innerHTML();
      console.log(`🏗️ Main content structure: ${mainContent.substring(0, 300)}...`);
    } catch (error) {
      console.log('🏗️ Main content structure: Could not get main content HTML...');
    }
    
    // Basic assertions (not expecting success yet)
    expect(pageTitle).toBeDefined();
    
    console.log('🚨 HOME PAGE: Diagnostic complete - issues identified for fixing');
  });

  test('DIRECT COMPARISON - Identify key differences between working and broken implementations', async ({ page }) => {
    console.log('🔍 Starting direct comparison analysis...');
    
    // Test working page first
    console.log('📊 Testing working test-avatar page...');
    await page.goto('http://localhost:9002/test-avatar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const workingButtons = await page.locator('button').count();
    const workingTitle = await page.title();
    const workingAvatarContainer = await page.locator('#vhss_aiPlayer').count();
    
    console.log(`✅ Working page - Buttons: ${workingButtons}, Title: "${workingTitle}", Avatar container: ${workingAvatarContainer}`);
    
    // Test broken page
    console.log('📊 Testing broken home page...');
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const brokenButtons = await page.locator('button').count();
    const brokenTitle = await page.title();
    const brokenSitePalComponent = await page.locator('[class*="HomePageSitePal"]').count();
    
    console.log(`🚨 Broken page - Buttons: ${brokenButtons}, Title: "${brokenTitle}", SitePal component: ${brokenSitePalComponent}`);
    
    // Analysis
    console.log('📋 COMPARISON ANALYSIS:');
    console.log(`   Working page has ${workingButtons} buttons vs broken page has ${brokenButtons} buttons`);
    console.log(`   Working page title: "${workingTitle}" vs broken page title: "${brokenTitle}"`);
    console.log(`   Working page uses Pioneer_AMA_Canvas with #vhss_aiPlayer container`);
    console.log(`   Broken page uses HomePageSitePalCanvas with #homepage-vhss-aiPlayer container`);
    
    // Key findings
    if (workingButtons > 0 && brokenButtons === 0) {
      console.log('🎯 KEY FINDING: Working page renders buttons, broken page does not render any buttons');
      console.log('🎯 HYPOTHESIS: Server response or component rendering issue on home page');
    }
    
    expect(workingButtons).toBeGreaterThan(0);
  });
});
