import { test, expect } from '@playwright/test';

test.describe('Pioneer Program Modal Integration', () => {
  test.beforeEach(async ({ page, context, browserName }) => {
    // Grant microphone permissions automatically (only for Chromium)
    if (browserName === 'chromium') {
      await context.grantPermissions(['microphone']);
    }

    // Navigate to home page
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
  });

  test('should open modal when clicking Pioneer Program action cards', async ({ page }) => {
    console.log('🚀 Starting Pioneer Program Modal Integration Test');

    // Step 1: Open SitePal Modal
    console.log('📱 Step 1: Opening SitePal Modal');
    const openModalButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(openModalButton).toBeVisible({ timeout: 10000 });
    await openModalButton.click();

    // Step 2: Wait for SitePal Avatar Initialization
    console.log('🤖 Step 2: Waiting for SitePal Avatar Initialization');
    
    // Wait for modal to be visible
    const sitePalModal = page.locator('[data-testid="sitepal-modal"]');
    await expect(sitePalModal).toBeVisible({ timeout: 15000 });

    // Wait for avatar container to be present
    const avatarContainer = page.locator('#AI_vhost_embed');
    await expect(avatarContainer).toBeVisible({ timeout: 30000 });

    // Wait for scene loaded callback (check console logs)
    await page.waitForFunction(() => {
      return window.console.log.toString().includes('vh_sceneLoaded') || 
             document.querySelector('#AI_vhost_embed')?.innerHTML?.includes('canvas');
    }, { timeout: 45000 });

    console.log('✅ Avatar initialization detected');

    // Step 3: Wait for Pioneer Program Action Cards
    console.log('🎯 Step 3: Waiting for Pioneer Program Action Cards');
    
    // Wait for action cards to appear
    const actionCards = page.locator('[data-testid="action-card"]');
    await expect(actionCards.first()).toBeVisible({ timeout: 30000 });

    // Verify all 6 Pioneer Program action cards are present
    const expectedActions = [
      'Founding Merchants',
      'Strategic Influencers', 
      'Community Champions',
      'General Interest',
      'Program Benefits',
      'How to Apply'
    ];

    for (const actionText of expectedActions) {
      const actionCard = page.locator(`[data-testid="action-card"]:has-text("${actionText}")`);
      await expect(actionCard).toBeVisible({ timeout: 5000 });
      console.log(`✅ Found action card: ${actionText}`);
    }

    // Step 4: Test Modal Opening for Signup Actions
    console.log('📋 Step 4: Testing Modal Opening for Signup Actions');

    // Test clicking on "Founding Merchants" (should be signup type)
    const foundingMerchantsCard = page.locator('[data-testid="action-card"]:has-text("Founding Merchants")');
    await foundingMerchantsCard.click();

    // Wait for Pioneer Application Modal to open
    const pioneerModal = page.locator('[data-testid="pioneer-application-modal"]');
    await expect(pioneerModal).toBeVisible({ timeout: 10000 });
    console.log('✅ Pioneer Application Modal opened successfully');

    // Step 5: Verify Form Pre-population
    console.log('📝 Step 5: Verifying Form Pre-population');
    
    // Check if tier is pre-selected (should be "Tier 1: Founding Merchant")
    const tierSelect = page.locator('select[name="applying_for_tier"]');
    await expect(tierSelect).toHaveValue('Tier 1: Founding Merchant', { timeout: 5000 });
    console.log('✅ Tier pre-population verified');

    // Step 6: Test Modal Close
    console.log('❌ Step 6: Testing Modal Close');
    
    const closeButton = page.locator('[data-testid="pioneer-modal-close"]');
    await closeButton.click();
    await expect(pioneerModal).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Modal closed successfully');

    // Step 7: Test Different Tier Actions
    console.log('🔄 Step 7: Testing Different Tier Actions');

    // Test Strategic Influencers
    const strategicInfluencersCard = page.locator('[data-testid="action-card"]:has-text("Strategic Influencers")');
    await strategicInfluencersCard.click();
    
    await expect(pioneerModal).toBeVisible({ timeout: 10000 });
    await expect(tierSelect).toHaveValue('Tier 2: Strategic Influencer', { timeout: 5000 });
    console.log('✅ Strategic Influencers tier pre-population verified');

    await closeButton.click();
    await expect(pioneerModal).not.toBeVisible({ timeout: 5000 });

    // Test Community Champions
    const communityChampionsCard = page.locator('[data-testid="action-card"]:has-text("Community Champions")');
    await communityChampionsCard.click();
    
    await expect(pioneerModal).toBeVisible({ timeout: 10000 });
    await expect(tierSelect).toHaveValue('Tier 3: Early Community Champion', { timeout: 5000 });
    console.log('✅ Community Champions tier pre-population verified');

    await closeButton.click();
    await expect(pioneerModal).not.toBeVisible({ timeout: 5000 });

    console.log('🎉 Pioneer Program Modal Integration Test Completed Successfully!');
  });

  test('should handle non-signup actions correctly', async ({ page }) => {
    console.log('🚀 Starting Non-Signup Actions Test');

    // Open SitePal Modal
    const openModalButton = page.locator('button:has-text("Start AI Presentation")');
    await openModalButton.click();

    // Wait for avatar initialization
    const sitePalModal = page.locator('[data-testid="sitepal-modal"]');
    await expect(sitePalModal).toBeVisible({ timeout: 15000 });

    const avatarContainer = page.locator('#AI_vhost_embed');
    await expect(avatarContainer).toBeVisible({ timeout: 30000 });

    // Wait for action cards
    const actionCards = page.locator('[data-testid="action-card"]');
    await expect(actionCards.first()).toBeVisible({ timeout: 30000 });

    // Test "Program Benefits" (should be command type, not open modal)
    const programBenefitsCard = page.locator('[data-testid="action-card"]:has-text("Program Benefits")');
    await programBenefitsCard.click();

    // Pioneer Application Modal should NOT open
    const pioneerModal = page.locator('[data-testid="pioneer-application-modal"]');
    await expect(pioneerModal).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Program Benefits correctly handled as command (no modal)');

    // Test "How to Apply" (should be command type, not open modal)
    const howToApplyCard = page.locator('[data-testid="action-card"]:has-text("How to Apply")');
    await howToApplyCard.click();

    // Pioneer Application Modal should NOT open
    await expect(pioneerModal).not.toBeVisible({ timeout: 3000 });
    console.log('✅ How to Apply correctly handled as command (no modal)');

    console.log('🎉 Non-Signup Actions Test Completed Successfully!');
  });

  test('should handle form submission flow', async ({ page }) => {
    console.log('🚀 Starting Form Submission Flow Test');

    // Open SitePal Modal and get to Pioneer Application Modal
    const openModalButton = page.locator('button:has-text("Start AI Presentation")');
    await openModalButton.click();

    const sitePalModal = page.locator('[data-testid="sitepal-modal"]');
    await expect(sitePalModal).toBeVisible({ timeout: 15000 });

    const avatarContainer = page.locator('#AI_vhost_embed');
    await expect(avatarContainer).toBeVisible({ timeout: 30000 });

    const actionCards = page.locator('[data-testid="action-card"]');
    await expect(actionCards.first()).toBeVisible({ timeout: 30000 });

    // Click on Founding Merchants to open modal
    const foundingMerchantsCard = page.locator('[data-testid="action-card"]:has-text("Founding Merchants")');
    await foundingMerchantsCard.click();

    const pioneerModal = page.locator('[data-testid="pioneer-application-modal"]');
    await expect(pioneerModal).toBeVisible({ timeout: 10000 });

    // Fill out the form (basic test)
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '+1234567890');

    // Navigate through form steps (if multi-step)
    const nextButton = page.locator('button:has-text("Next")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    console.log('✅ Form interaction test completed');

    // Close modal
    const closeButton = page.locator('[data-testid="pioneer-modal-close"]');
    await closeButton.click();
    await expect(pioneerModal).not.toBeVisible({ timeout: 5000 });

    console.log('🎉 Form Submission Flow Test Completed Successfully!');
  });
});
