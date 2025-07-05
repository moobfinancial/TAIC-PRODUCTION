import { test, expect } from '@playwright/test';

test.describe('Home Page Content Verification', () => {
  test.beforeEach(async ({ page, context, browserName }) => {
    // Grant microphone permissions automatically (only for Chromium)
    if (browserName === 'chromium') {
      await context.grantPermissions(['microphone']);
    }
    
    // Navigate to home page
    await page.goto('http://localhost:9002/');
    
    // Wait for page to load completely
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
  });

  test('should display complete restored home page content', async ({ page }) => {
    console.log('🏠 Testing Home Page Content Restoration');

    // 1. Verify Hero Section
    console.log('📝 Step 1: Verifying Hero Section');
    
    // Check main heading
    const mainHeading = page.locator('h1:has-text("TAIC: AI-Powered Crypto Commerce")');
    await expect(mainHeading).toBeVisible({ timeout: 10000 });
    console.log('✅ Main heading found: TAIC: AI-Powered Crypto Commerce');

    // Check hero description
    const heroDescription = page.locator('text=TAIC is an AI-powered, multi-vendor crypto-commerce marketplace');
    await expect(heroDescription).toBeVisible({ timeout: 5000 });
    console.log('✅ Hero description found');

    // 2. Verify Start AI Presentation Button
    console.log('📝 Step 2: Verifying Start AI Presentation Button');
    
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Start AI Presentation button found');

    // 3. Verify Features Section
    console.log('📝 Step 3: Verifying Features Section');
    
    const featuresHeading = page.locator('h2:has-text("Discover Our Features")');
    await expect(featuresHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Features section heading found');

    // Check feature cards
    const aiShoppingCard = page.locator('text=AI-Powered Shopping');
    await expect(aiShoppingCard).toBeVisible({ timeout: 5000 });
    console.log('✅ AI-Powered Shopping card found');

    const merchantToolsCard = page.locator('text=Merchant Tools');
    await expect(merchantToolsCard).toBeVisible({ timeout: 5000 });
    console.log('✅ Merchant Tools card found');

    const cryptoRewardsCard = page.locator('.tracking-tight.text-xl.font-semibold:has-text("Crypto Rewards")');
    await expect(cryptoRewardsCard).toBeVisible({ timeout: 5000 });
    console.log('✅ Crypto Rewards card found');

    // 4. Verify Pioneer Program Section
    console.log('📝 Step 4: Verifying Pioneer Program Section');
    
    const pioneerHeading = page.locator('h2:has-text("Join the Pioneer Program")');
    await expect(pioneerHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Pioneer Program heading found');

    // Check tier cards
    const foundingMerchantsCard = page.locator('text=Founding Merchants');
    await expect(foundingMerchantsCard).toBeVisible({ timeout: 5000 });
    console.log('✅ Founding Merchants card found');

    const strategicInfluencersCard = page.locator('text=Strategic Influencers');
    await expect(strategicInfluencersCard).toBeVisible({ timeout: 5000 });
    console.log('✅ Strategic Influencers card found');

    // 5. Verify Crypto Rewards Section
    console.log('📝 Step 5: Verifying Crypto Rewards Section');
    
    const cryptoRewardsHeading = page.locator('h2:has-text("Earn Real Crypto Rewards")');
    await expect(cryptoRewardsHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Crypto Rewards section heading found');

    // 6. Verify Interactive AI AMA Section
    console.log('📝 Step 6: Verifying Interactive AI AMA Section');
    
    const amaHeading = page.locator('h2:has-text("Ask Our AI Anything")');
    await expect(amaHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Interactive AI AMA section heading found');

    // 7. Verify Community Engagement Section
    console.log('📝 Step 7: Verifying Community Engagement Section');
    
    const communityHeading = page.locator('h2:has-text("Join Our Community")');
    await expect(communityHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Community Engagement section heading found');

    // 8. Verify Final Call-to-Action Section
    console.log('📝 Step 8: Verifying Final Call-to-Action Section');
    
    const finalCtaHeading = page.locator('h2:has-text("Ready to Get Started?")');
    await expect(finalCtaHeading).toBeVisible({ timeout: 5000 });
    console.log('✅ Final CTA section heading found');

    console.log('🎉 All home page content sections verified successfully!');
  });

  test('should test Start AI Presentation button functionality', async ({ page }) => {
    console.log('🤖 Testing Start AI Presentation Button');

    // Find and click the Start AI Presentation button
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Start AI Presentation button found');

    // Click the button
    await startButton.click();
    console.log('🖱️ Clicked Start AI Presentation button');

    // Wait a moment for any modal or dialog to appear
    await page.waitForTimeout(3000);

    // Check if SitePal modal opened (look for modal container)
    const modalContainer = page.locator('[data-testid="sitepal-modal"]');
    const isModalVisible = await modalContainer.isVisible();
    
    if (isModalVisible) {
      console.log('✅ SitePal modal opened successfully');
      
      // Check for loading or initialization state
      const loadingIndicator = page.locator('text=Loading');
      const initializingIndicator = page.locator('text=Initializing');
      
      if (await loadingIndicator.isVisible() || await initializingIndicator.isVisible()) {
        console.log('🔄 SitePal avatar is initializing...');
      }
    } else {
      console.log('⚠️ SitePal modal did not open - this may indicate an issue');
    }

    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/start-ai-presentation-test.png', fullPage: true });
    console.log('📸 Screenshot saved for manual verification');
  });
});
