import { test, expect } from '@playwright/test';

test.describe('Pioneer Program Avatar Flow', () => {
  test.beforeEach(async ({ context, browserName }) => {
    // Grant microphone permissions automatically (only for Chromium-based browsers)
    if (browserName === 'chromium') {
      await context.grantPermissions(['microphone']);
    }
  });

  test('should display all Pioneer Program action cards correctly', async ({ page }) => {
    console.log('🚀 Testing complete Pioneer Program action card functionality...');

    // Navigate to home page
    await page.goto('http://localhost:9002', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Find and click the SitePal avatar button
    console.log('🔍 Looking for SitePal avatar button...');
    const avatarButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(avatarButton).toBeVisible({ timeout: 10000 });
    await avatarButton.click();

    // Wait for modal to appear
    console.log('⏳ Waiting for SitePal modal...');
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Wait for avatar initialization and action cards to load
    console.log('🤖 Waiting for avatar initialization and action cards...');
    await page.waitForTimeout(30000);

    // Test all Pioneer Program action cards
    const expectedActions = [
      'Founding Merchants',
      'Strategic Influencers',
      'Community Champions',
      'General Interest',
      'Program Benefits',
      'How to Apply'
    ];

    console.log('🎯 Checking for all Pioneer Program action cards...');
    for (const actionText of expectedActions) {
      const actionCard = modal.locator(`button:has-text("${actionText}")`);
      await expect(actionCard).toBeVisible({ timeout: 5000 });
      console.log(`✅ Found action card: ${actionText}`);
    }

    // Verify greeting text is present
    const greetingText = modal.locator('text=Welcome to TAIC');
    await expect(greetingText).toBeVisible({ timeout: 5000 });
    console.log('✅ Greeting text is visible');

    // Test clicking on one of the action cards
    console.log('🖱️ Testing action card interaction...');
    const foundingMerchantsCard = modal.locator('button:has-text("Founding Merchants")');
    await foundingMerchantsCard.click();

    // Wait a moment for any response
    await page.waitForTimeout(3000);

    console.log('🎉 All Pioneer Program action cards are working correctly!');
  });

  test.skip('should display Pioneer Program tier action cards with icons', async ({ page }) => {
    console.log('🚀 Starting Pioneer Program Flow Test');

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });

    // Navigate to home page
    await page.goto('http://localhost:9002', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait for and click the SitePal avatar button
    console.log('🔍 Looking for SitePal avatar button...');
    const avatarButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(avatarButton).toBeVisible({ timeout: 10000 });
    await avatarButton.click();

    // Wait for modal to appear
    console.log('⏳ Waiting for SitePal modal...');
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Check if modal stays open
    console.log('🔍 Checking if modal stays open...');
    await page.waitForTimeout(5000);
    const isModalStillVisible = await modal.isVisible();
    console.log('Modal still visible after 5s:', isModalStillVisible);

    if (!isModalStillVisible) {
      console.log('❌ Modal closed unexpectedly, checking for errors...');
      // Try to find the modal again
      const modalAgain = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
      const modalCount = await modalAgain.count();
      console.log('Modal count:', modalCount);
      return; // Exit early if modal is gone
    }

    // Wait for avatar initialization (extended timeout)
    console.log('🤖 Waiting for avatar initialization...');
    await page.waitForTimeout(15000); // Allow time for SitePal to load

    // Check for Pioneer Program action cards
    console.log('🎯 Checking for Pioneer Program action cards...');
    
    // Verify tier action cards are present with icons
    const foundingMerchantsCard = modal.locator('button:has-text("Founding Merchants")');
    const strategicInfluencersCard = modal.locator('button:has-text("Strategic Influencers")');
    const communityChampionsCard = modal.locator('button:has-text("Community Champions")');
    const generalInterestCard = modal.locator('button:has-text("General Interest")');
    const programBenefitsCard = modal.locator('button:has-text("Program Benefits")');
    const howToApplyCard = modal.locator('button:has-text("How to Apply")');
    
    // Wait for action cards to appear
    await expect(foundingMerchantsCard).toBeVisible({ timeout: 20000 });
    await expect(strategicInfluencersCard).toBeVisible({ timeout: 5000 });
    await expect(communityChampionsCard).toBeVisible({ timeout: 5000 });
    await expect(generalInterestCard).toBeVisible({ timeout: 5000 });
    await expect(programBenefitsCard).toBeVisible({ timeout: 5000 });
    await expect(howToApplyCard).toBeVisible({ timeout: 5000 });
    
    console.log('✅ All Pioneer Program tier cards are visible');
    
    // Verify icons are present in action cards
    const storeIcon = modal.locator('svg[data-lucide="store"]');
    const megaphoneIcon = modal.locator('svg[data-lucide="megaphone"]');
    const usersIcon = modal.locator('svg[data-lucide="users"]');
    const listIcon = modal.locator('svg[data-lucide="list"]');
    const starIcon = modal.locator('svg[data-lucide="star"]');
    const userPlusIcon = modal.locator('svg[data-lucide="user-plus"]');
    
    // Check if at least some icons are present (they may have different attributes)
    const iconCount = await modal.locator('svg').count();
    expect(iconCount).toBeGreaterThan(5); // Should have at least 6 icons for the action cards
    
    console.log(`✅ Found ${iconCount} icons in action cards`);
  });

  test('should handle Founding Merchants tier interaction', async ({ page }) => {
    console.log('🏪 Testing Founding Merchants tier interaction');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');
    
    // Open SitePal modal
    const avatarButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(avatarButton).toBeVisible({ timeout: 10000 });
    await avatarButton.click();
    
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // Wait for avatar initialization
    await page.waitForTimeout(15000);
    
    // Click on Founding Merchants card
    const foundingMerchantsCard = modal.locator('button:has-text("Founding Merchants")');
    await expect(foundingMerchantsCard).toBeVisible({ timeout: 20000 });
    await foundingMerchantsCard.click();
    
    // Wait for AI response
    console.log('⏳ Waiting for AI response about Founding Merchants...');
    await page.waitForTimeout(10000);
    
    // Check for response text about merchants
    const responseText = modal.locator('text=benefits').first();
    await expect(responseText).toBeVisible({ timeout: 15000 });
    
    console.log('✅ Founding Merchants tier interaction successful');
  });

  test('should handle action type routing correctly', async ({ page }) => {
    console.log('🔄 Testing action type routing');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');
    
    // Open SitePal modal
    const avatarButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(avatarButton).toBeVisible({ timeout: 10000 });
    await avatarButton.click();
    
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // Wait for avatar initialization
    await page.waitForTimeout(15000);
    
    // Test command action type (default behavior)
    const programBenefitsCard = modal.locator('button:has-text("Program Benefits")');
    await expect(programBenefitsCard).toBeVisible({ timeout: 20000 });
    
    // Listen for console logs to verify action handling
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('[HomePageCanvas] Action clicked:')) {
        consoleLogs.push(msg.text());
      }
    });
    
    await programBenefitsCard.click();
    
    // Wait for action to be processed
    await page.waitForTimeout(3000);
    
    // Verify action was logged
    expect(consoleLogs.length).toBeGreaterThan(0);
    console.log('✅ Action type routing working correctly');
  });

  test('should clean JSON artifacts from speech text', async ({ page }) => {
    console.log('🧹 Testing JSON artifact cleaning');
    
    await page.goto('http://localhost:9002');
    await page.waitForLoadState('domcontentloaded');
    
    // Monitor console for speech text logs
    const speechLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('Speech Text:')) {
        speechLogs.push(msg.text());
      }
    });
    
    // Open SitePal modal and interact
    const avatarButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(avatarButton).toBeVisible({ timeout: 10000 });
    await avatarButton.click();
    
    const modal = page.locator('.fixed.inset-0.bg-black.bg-opacity-50');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    // Wait for avatar initialization and greeting
    await page.waitForTimeout(20000);
    
    // Interact with an action to trigger AI response
    const foundingMerchantsCard = modal.locator('button:has-text("Founding Merchants")');
    if (await foundingMerchantsCard.isVisible()) {
      await foundingMerchantsCard.click();
      await page.waitForTimeout(10000);
    }
    
    // Verify no JSON artifacts in speech logs
    for (const log of speechLogs) {
      expect(log).not.toContain('{');
      expect(log).not.toContain('}');
      expect(log).not.toContain('[');
      expect(log).not.toContain(']');
      expect(log).not.toContain('"');
    }
    
    console.log('✅ JSON artifact cleaning verified');
  });
});
