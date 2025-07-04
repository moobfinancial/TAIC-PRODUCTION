import { test, expect, Page } from '@playwright/test';

interface ContainerDebugInfo {
  step: string;
  timestamp: number;
  containerIdState: string;
  elementFound: boolean;
  elementId: string | null;
  elementDimensions: { width: number; height: number };
  elementVisibility: {
    offsetParent: boolean;
    parentNode: boolean;
    display: string;
    visibility: string;
    opacity: string;
  };
  retryCount: number;
  hasTriedIdSwitch: boolean;
}

class DOMContainerDebugger {
  private page: Page;
  private debugLog: ContainerDebugInfo[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async injectDebugScript() {
    await this.page.addInitScript(() => {
      // Override console.log to capture debug messages
      const originalConsoleLog = console.log;
      (window as any).debugMessages = [];
      
      console.log = function(...args) {
        (window as any).debugMessages.push({
          timestamp: Date.now(),
          message: args.join(' ')
        });
        return originalConsoleLog.apply(console, args);
      };

      // Add DOM mutation observer
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.id && (element.id.includes('vhss') || element.id.includes('homepage'))) {
                  (window as any).debugMessages.push({
                    timestamp: Date.now(),
                    message: `[DOM Observer] Element added: ${element.id}`
                  });
                }
              }
            });
            
            mutation.removedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.id && (element.id.includes('vhss') || element.id.includes('homepage'))) {
                  (window as any).debugMessages.push({
                    timestamp: Date.now(),
                    message: `[DOM Observer] Element removed: ${element.id}`
                  });
                }
              }
            });
          }
          
          if (mutation.type === 'attributes' && mutation.attributeName === 'id') {
            const element = mutation.target as Element;
            if (element.id && (element.id.includes('vhss') || element.id.includes('homepage'))) {
              (window as any).debugMessages.push({
                timestamp: Date.now(),
                message: `[DOM Observer] ID changed: ${element.id}`
              });
            }
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id']
      });
    });
  }

  async captureContainerState(step: string): Promise<ContainerDebugInfo> {
    return await this.page.evaluate((stepName) => {
      const timestamp = Date.now();
      
      // Try to find container with either ID
      const homepageContainer = document.getElementById('homepage-vhss-aiPlayer');
      const sitePalContainer = document.getElementById('vhss_aiPlayer');
      const activeContainer = homepageContainer || sitePalContainer;
      
      let containerInfo: ContainerDebugInfo = {
        step: stepName,
        timestamp,
        containerIdState: 'unknown',
        elementFound: !!activeContainer,
        elementId: activeContainer?.id || null,
        elementDimensions: { width: 0, height: 0 },
        elementVisibility: {
          offsetParent: false,
          parentNode: false,
          display: 'none',
          visibility: 'hidden',
          opacity: '0'
        },
        retryCount: 0,
        hasTriedIdSwitch: false
      };

      if (activeContainer) {
        const computedStyle = window.getComputedStyle(activeContainer);
        containerInfo.elementDimensions = {
          width: activeContainer.offsetWidth,
          height: activeContainer.offsetHeight
        };
        containerInfo.elementVisibility = {
          offsetParent: activeContainer.offsetParent !== null,
          parentNode: activeContainer.parentNode !== null,
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity
        };
      }

      return containerInfo;
    }, step);
  }

  async getDebugMessages(): Promise<Array<{timestamp: number, message: string}>> {
    return await this.page.evaluate(() => {
      return (window as any).debugMessages || [];
    });
  }

  async clearDebugMessages() {
    await this.page.evaluate(() => {
      (window as any).debugMessages = [];
    });
  }
}

test.describe('DOM Container Initialization Debug', () => {
  let debugger: DOMContainerDebugger;

  test.beforeEach(async ({ page }) => {
    debugger = new DOMContainerDebugger(page);
    await debugger.injectDebugScript();
    await page.goto('/');
  });

  test('should trace complete DOM container lifecycle', async ({ page }) => {
    console.log('🔍 Starting DOM container lifecycle trace...');
    
    // Capture initial state
    const initialState = await debugger.captureContainerState('page_load');
    console.log('📊 Initial state:', initialState);
    
    // Find and click Start AI Presentation button
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    
    const beforeClickState = await debugger.captureContainerState('before_modal_open');
    console.log('📊 Before modal open:', beforeClickState);
    
    // Clear debug messages before clicking
    await debugger.clearDebugMessages();
    
    // Click to open modal
    await startButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    const afterModalOpenState = await debugger.captureContainerState('after_modal_open');
    console.log('📊 After modal open:', afterModalOpenState);
    
    // Wait and capture states during initialization
    const states: ContainerDebugInfo[] = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const state = await debugger.captureContainerState(`initialization_step_${i}`);
      states.push(state);
      console.log(`📊 Step ${i}:`, state);
      
      // If container is found and ready, break early
      if (state.elementFound && state.elementDimensions.width > 0) {
        console.log('✅ Container found and ready!');
        break;
      }
    }
    
    // Get all debug messages
    const debugMessages = await debugger.getDebugMessages();
    console.log('📝 Debug messages:', debugMessages);
    
    // Analyze the results
    const containerFound = states.some(state => state.elementFound);
    const containerReady = states.some(state => 
      state.elementFound && 
      state.elementDimensions.width > 0 && 
      state.elementVisibility.offsetParent
    );
    
    console.log('🎯 Analysis Results:');
    console.log('- Container found:', containerFound);
    console.log('- Container ready:', containerReady);
    console.log('- Total debug messages:', debugMessages.length);
    
    // Check for specific error patterns
    const errorMessages = debugMessages.filter(msg => 
      msg.message.includes('failed to initialize') ||
      msg.message.includes('maximum retries') ||
      msg.message.includes('error')
    );
    
    const retryMessages = debugMessages.filter(msg => 
      msg.message.includes('retry') ||
      msg.message.includes('checkContainerAndEmbed')
    );
    
    console.log('❌ Error messages:', errorMessages.length);
    console.log('🔄 Retry messages:', retryMessages.length);
    
    // Assertions
    expect(containerFound).toBe(true);
    expect(errorMessages.length).toBe(0);
    expect(retryMessages.length).toBeLessThan(50); // Should not have excessive retries
  });

  test('should identify why container is not found', async ({ page }) => {
    console.log('🔍 Investigating container discovery failure...');
    
    // Open modal
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Wait for initialization attempt
    await page.waitForTimeout(3000);
    
    // Detailed DOM inspection
    const domAnalysis = await page.evaluate(() => {
      const analysis = {
        allElementsWithVhss: [] as string[],
        allElementsWithHomepage: [] as string[],
        modalContent: '',
        reactComponents: [] as string[],
        containerParents: [] as string[]
      };
      
      // Find all elements with 'vhss' in ID
      document.querySelectorAll('[id*="vhss"]').forEach(el => {
        analysis.allElementsWithVhss.push(`${el.id} (${el.tagName})`);
      });
      
      // Find all elements with 'homepage' in ID
      document.querySelectorAll('[id*="homepage"]').forEach(el => {
        analysis.allElementsWithHomepage.push(`${el.id} (${el.tagName})`);
      });
      
      // Get modal content
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        analysis.modalContent = modal.innerHTML.substring(0, 500) + '...';
      }
      
      // Find React components
      document.querySelectorAll('[data-reactroot], [data-react-*]').forEach(el => {
        if (el.id) {
          analysis.reactComponents.push(el.id);
        }
      });
      
      // Check for potential container parents
      document.querySelectorAll('div[class*="canvas"], div[class*="sitepal"], div[class*="player"]').forEach(el => {
        analysis.containerParents.push(`${el.className} (${el.id || 'no-id'})`);
      });
      
      return analysis;
    });
    
    console.log('🔍 DOM Analysis Results:');
    console.log('- Elements with "vhss":', domAnalysis.allElementsWithVhss);
    console.log('- Elements with "homepage":', domAnalysis.allElementsWithHomepage);
    console.log('- React components:', domAnalysis.reactComponents);
    console.log('- Potential container parents:', domAnalysis.containerParents);
    console.log('- Modal content preview:', domAnalysis.modalContent.substring(0, 200));
    
    // Get debug messages
    const debugMessages = await debugger.getDebugMessages();
    const containerMessages = debugMessages.filter(msg => 
      msg.message.includes('container') || 
      msg.message.includes('HomePageCanvas')
    );
    
    console.log('📝 Container-related messages:', containerMessages);
    
    // Check if the issue is timing-related
    const timingAnalysis = await page.evaluate(() => {
      return {
        documentReady: document.readyState,
        modalVisible: !!document.querySelector('[role="dialog"]'),
        reactHydrated: !!(window as any).React,
        sitePalScriptLoaded: !!document.querySelector('script[src*="sitepal"]'),
        embedFunctionExists: !!(window as any).AI_vhost_embed
      };
    });
    
    console.log('⏱️ Timing Analysis:', timingAnalysis);
    
    // The test should help us understand what's happening
    expect(domAnalysis.allElementsWithVhss.length + domAnalysis.allElementsWithHomepage.length).toBeGreaterThan(0);
  });

  test('should verify React state synchronization', async ({ page }) => {
    console.log('🔍 Testing React state synchronization...');
    
    // Inject React state monitoring
    await page.addInitScript(() => {
      (window as any).reactStateChanges = [];
      
      // Monitor React state changes (if possible)
      const originalSetState = React.Component.prototype.setState;
      React.Component.prototype.setState = function(state, callback) {
        (window as any).reactStateChanges.push({
          timestamp: Date.now(),
          component: this.constructor.name,
          state: JSON.stringify(state)
        });
        return originalSetState.call(this, state, callback);
      };
    });
    
    // Open modal and monitor state changes
    const startButton = page.locator('button:has-text("Start AI Presentation")');
    await startButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Wait for state changes to occur
    await page.waitForTimeout(5000);
    
    // Get React state changes
    const stateChanges = await page.evaluate(() => {
      return (window as any).reactStateChanges || [];
    });
    
    console.log('⚛️ React state changes:', stateChanges);
    
    // Get debug messages to correlate with state changes
    const debugMessages = await debugger.getDebugMessages();
    const stateMessages = debugMessages.filter(msg => 
      msg.message.includes('containerIdState') ||
      msg.message.includes('state') ||
      msg.message.includes('ID')
    );
    
    console.log('📝 State-related messages:', stateMessages);
    
    // Verify that state changes are happening
    expect(stateChanges.length).toBeGreaterThan(0);
  });
});
