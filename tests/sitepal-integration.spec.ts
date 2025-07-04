import { test, expect, Page } from '@playwright/test';

interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

interface DOMContainerInfo {
  id: string | null;
  exists: boolean;
  visible: boolean;
  dimensions: { width: number; height: number };
  offsetParent: boolean;
  parentNode: boolean;
  computedStyle: {
    display: string;
    visibility: string;
    opacity: string;
  };
}

class SitePalTestHelper {
  private page: Page;
  private consoleMessages: ConsoleMessage[] = [];

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleLogging();
  }

  private setupConsoleLogging() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
    });
  }

  async getConsoleMessages(filter?: string): Promise<ConsoleMessage[]> {
    if (filter) {
      return this.consoleMessages.filter(msg => msg.text.includes(filter));
    }
    return this.consoleMessages;
  }

  async clearConsoleMessages() {
    this.consoleMessages = [];
  }

  async getDOMContainerInfo(containerId: string): Promise<DOMContainerInfo> {
    return await this.page.evaluate((id) => {
      const element = document.getElementById(id);
      if (!element) {
        return {
          id: null,
          exists: false,
          visible: false,
          dimensions: { width: 0, height: 0 },
          offsetParent: false,
          parentNode: false,
          computedStyle: {
            display: 'none',
            visibility: 'hidden',
            opacity: '0'
          }
        };
      }

      const computedStyle = window.getComputedStyle(element);
      return {
        id: element.id,
        exists: true,
        visible: element.offsetWidth > 0 && element.offsetHeight > 0,
        dimensions: {
          width: element.offsetWidth,
          height: element.offsetHeight
        },
        offsetParent: element.offsetParent !== null,
        parentNode: element.parentNode !== null,
        computedStyle: {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity
        }
      };
    }, containerId);
  }

  async waitForSitePalScript(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const checkScript = () => {
          if (window.AI_vhost_embed && typeof window.AI_vhost_embed === 'function') {
            resolve(true);
            return;
          }
          setTimeout(checkScript, 100);
        };
        checkScript();
        
        // Timeout after 10 seconds
        setTimeout(() => resolve(false), 10000);
      });
    });
  }

  async checkSitePalEmbedding(): Promise<{
    scriptLoaded: boolean;
    embedFunctionExists: boolean;
    containerReady: boolean;
    embeddingAttempted: boolean;
  }> {
    return await this.page.evaluate(() => {
      return {
        scriptLoaded: !!document.querySelector('script[src*="sitepalPlayer"]'),
        embedFunctionExists: !!(window as any).AI_vhost_embed,
        containerReady: !!document.getElementById('vhss_aiPlayer') || !!document.getElementById('homepage-vhss-aiPlayer'),
        embeddingAttempted: !!(window as any).sitePalEmbedAttempted
      };
    });
  }
}

test.describe('SitePal DOM Container Integration', () => {
  let helper: SitePalTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new SitePalTestHelper(page);
    await page.goto('/');
    await helper.clearConsoleMessages();
  });

  test('should load home page without console errors', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check for any JavaScript errors
    const errorMessages = await helper.getConsoleMessages('error');
    const criticalErrors = errorMessages.filter(msg => 
      !msg.text.includes('favicon') && 
      !msg.text.includes('404') &&
      !msg.text.includes('net::ERR_')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should find Start AI Presentation button and open SitePal modal', async ({ page }) => {
    // Look for the Start AI Presentation button
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });

    // Click the button to open modal
    await startButton.click();

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Verify modal is visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
  });

  test('should initialize DOM container without infinite retry loops', async ({ page }) => {
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Clear console messages before container initialization
    await helper.clearConsoleMessages();
    
    // Wait for container initialization to complete (max 5 seconds)
    await page.waitForTimeout(5000);
    
    // Check console messages for container initialization
    const containerMessages = await helper.getConsoleMessages('HomePageCanvas');
    
    // Should not see "failed to initialize after maximum retries"
    const failureMessages = containerMessages.filter(msg => 
      msg.text.includes('failed to initialize after maximum retries')
    );
    expect(failureMessages).toHaveLength(0);
    
    // Should see successful container initialization
    const successMessages = containerMessages.filter(msg => 
      msg.text.includes('Starting container initialization') ||
      msg.text.includes('Found container') ||
      msg.text.includes('Container is ready')
    );
    expect(successMessages.length).toBeGreaterThan(0);
  });

  test('should create DOM container with correct ID and properties', async ({ page }) => {
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal and container initialization
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Check for both possible container IDs
    const homepageContainer = await helper.getDOMContainerInfo('homepage-vhss-aiPlayer');
    const sitePalContainer = await helper.getDOMContainerInfo('vhss_aiPlayer');
    
    // At least one container should exist
    const containerExists = homepageContainer.exists || sitePalContainer.exists;
    expect(containerExists).toBe(true);
    
    // Get the existing container info
    const activeContainer = homepageContainer.exists ? homepageContainer : sitePalContainer;
    
    // Verify container properties
    expect(activeContainer.visible).toBe(true);
    expect(activeContainer.dimensions.width).toBeGreaterThan(0);
    expect(activeContainer.dimensions.height).toBeGreaterThan(0);
    expect(activeContainer.offsetParent).toBe(true);
    expect(activeContainer.parentNode).toBe(true);
    expect(activeContainer.computedStyle.display).not.toBe('none');
    expect(activeContainer.computedStyle.visibility).not.toBe('hidden');
  });

  test('should load SitePal script and embed function', async ({ page }) => {
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Wait for SitePal script to load
    const scriptLoaded = await helper.waitForSitePalScript();
    expect(scriptLoaded).toBe(true);
    
    // Check SitePal embedding status
    const embeddingStatus = await helper.checkSitePalEmbedding();
    expect(embeddingStatus.scriptLoaded).toBe(true);
    expect(embeddingStatus.embedFunctionExists).toBe(true);
    expect(embeddingStatus.containerReady).toBe(true);
  });

  test('should complete container initialization within timeout', async ({ page }) => {
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Clear console messages
    await helper.clearConsoleMessages();
    
    // Wait for container initialization (should complete within 3 seconds)
    const startTime = Date.now();
    
    // Wait for either success or failure message
    await page.waitForFunction(() => {
      const messages = Array.from(document.querySelectorAll('*')).map(el => el.textContent).join(' ');
      return messages.includes('Container is ready') || 
             messages.includes('failed to initialize') ||
             window.console.toString().includes('Container is ready');
    }, { timeout: 5000 });
    
    const endTime = Date.now();
    const initializationTime = endTime - startTime;
    
    // Should complete within 3 seconds (3000ms)
    expect(initializationTime).toBeLessThan(3000);
    
    // Check for success messages
    const containerMessages = await helper.getConsoleMessages('HomePageCanvas');
    const failureMessages = containerMessages.filter(msg => 
      msg.text.includes('failed to initialize')
    );
    expect(failureMessages).toHaveLength(0);
  });

  test('should handle modal close and reopen without errors', async ({ page }) => {
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal to appear and initialize
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Close the modal
    const closeButton = page.locator('[role="dialog"] button[aria-label="Close"]').first();
    await closeButton.click();
    
    // Wait for modal to close
    await page.waitForTimeout(1000);
    
    // Clear console messages
    await helper.clearConsoleMessages();
    
    // Reopen the modal
    await startButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(3000);
    
    // Check for errors during reopen
    const errorMessages = await helper.getConsoleMessages('error');
    const domErrors = errorMessages.filter(msg => 
      msg.text.includes('removeChild') || 
      msg.text.includes('DOM') ||
      msg.text.includes('failed to initialize')
    );
    expect(domErrors).toHaveLength(0);
  });

  test('should not create infinite setTimeout loops', async ({ page }) => {
    // Monitor setTimeout calls
    await page.addInitScript(() => {
      const originalSetTimeout = window.setTimeout;
      let timeoutCount = 0;
      
      window.setTimeout = function(...args) {
        timeoutCount++;
        (window as any).timeoutCallCount = timeoutCount;
        return originalSetTimeout.apply(this, args);
      };
    });
    
    // Open the SitePal modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    
    // Wait for modal and initialization
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(5000);
    
    // Check setTimeout call count
    const timeoutCount = await page.evaluate(() => (window as any).timeoutCallCount || 0);
    
    // Should not have excessive setTimeout calls (indicating infinite loops)
    // Allow reasonable number for normal operation but catch runaway loops
    expect(timeoutCount).toBeLessThan(100);
  });
});
