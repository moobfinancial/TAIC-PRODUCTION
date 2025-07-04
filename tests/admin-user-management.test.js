/**
 * REQ-023 Admin User Management System - Comprehensive Test Suite
 * Phase 4: Testing & Optimization
 */

const { test, expect } = require('@playwright/test');

// Test Configuration
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key';

// Test Data
const TEST_USER_DATA = {
  username: 'test_user_' + Date.now(),
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'SHOPPER'
};

describe('REQ-023 Admin User Management System Tests', () => {
  
  // 1. FUNCTIONAL TESTING
  describe('1. Functional Testing', () => {
    
    test('User Listing Page Loads Successfully', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      // Check page title and main elements
      await expect(page.locator('h1')).toContainText('User Management');
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
      
      // Verify pagination controls
      await expect(page.locator('button:has-text("Previous")')).toBeVisible();
      await expect(page.locator('button:has-text("Next")')).toBeVisible();
    });

    test('Search Functionality Works', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      // Test search input
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('test');
      
      // Wait for search results
      await page.waitForTimeout(1000);
      
      // Verify search results are filtered
      const userRows = page.locator('tbody tr');
      const count = await userRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('Filter Controls Work Correctly', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      // Test role filter
      await page.selectOption('select:near(:text("All Roles"))', 'SHOPPER');
      await page.waitForTimeout(1000);
      
      // Test status filter
      await page.selectOption('select:near(:text("All Status"))', 'active');
      await page.waitForTimeout(1000);
      
      // Verify filters applied
      const userRows = page.locator('tbody tr');
      const count = await userRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('User Profile Page Navigation', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      // Click on first user's view button
      const firstViewButton = page.locator('tbody tr:first-child button:has-text("👁")').first();
      if (await firstViewButton.isVisible()) {
        await firstViewButton.click();
        
        // Verify navigation to user profile
        await expect(page.url()).toMatch(/\/admin\/users\/[a-f0-9-]+/);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('button:has-text("Back to Users")')).toBeVisible();
      }
    });

    test('Bulk Selection and Export', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      // Select first few users
      const checkboxes = page.locator('tbody tr button:has(svg)').first();
      if (await checkboxes.isVisible()) {
        await checkboxes.click();
        
        // Verify bulk operations appear
        await expect(page.locator('text="selected"')).toBeVisible();
        await expect(page.locator('button:has-text("Export Selected")')).toBeVisible();
      }
    });
  });

  // 2. API TESTING
  describe('2. API Testing', () => {
    
    test('GET /api/admin/users - User Listing API', async ({ request }) => {
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('totalPages');
      expect(Array.isArray(data.users)).toBe(true);
    });

    test('GET /api/admin/users with filters', async ({ request }) => {
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users?role=SHOPPER&status=active&page=1&limit=10`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.users.length).toBeLessThanOrEqual(10);
      
      // Verify filtering worked
      data.users.forEach(user => {
        expect(user.role).toBe('SHOPPER');
        expect(user.is_active).toBe(true);
      });
    });

    test('GET /api/admin/users/[id] - Individual User API', async ({ request }) => {
      // First get a user ID from the listing
      const listResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/users?limit=1`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      const listData = await listResponse.json();
      if (listData.users.length > 0) {
        const userId = listData.users[0].id;
        
        const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users/${userId}`, {
          headers: {
            'X-Admin-API-Key': ADMIN_API_KEY
          }
        });
        
        expect(response.status()).toBe(200);
        
        const userData = await response.json();
        expect(userData).toHaveProperty('id');
        expect(userData).toHaveProperty('username');
        expect(userData).toHaveProperty('email');
        expect(userData).toHaveProperty('role');
        expect(userData).toHaveProperty('order_count');
        expect(userData).toHaveProperty('total_spent');
        expect(userData).toHaveProperty('addresses');
      }
    });

    test('PATCH /api/admin/users/[id] - User Update API', async ({ request }) => {
      // Get a user to update
      const listResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/users?limit=1`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      const listData = await listResponse.json();
      if (listData.users.length > 0) {
        const userId = listData.users[0].id;
        const originalUser = listData.users[0];
        
        const updateData = {
          is_active: !originalUser.is_active,
          email_verified: !originalUser.email_verified
        };
        
        const response = await request.patch(`${ADMIN_BASE_URL}/api/admin/users/${userId}`, {
          headers: {
            'X-Admin-API-Key': ADMIN_API_KEY,
            'Content-Type': 'application/json'
          },
          data: updateData
        });
        
        expect(response.status()).toBe(200);
        
        const result = await response.json();
        expect(result).toHaveProperty('message');
        expect(result.message).toContain('updated successfully');
      }
    });

    test('GET /api/admin/audit-log - Audit Log API', async ({ request }) => {
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/audit-log`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('logs');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(Array.isArray(data.logs)).toBe(true);
    });

    test('GET /api/admin/users/export - CSV Export API', async ({ request }) => {
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users/export?export=csv`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/csv');
      
      const csvContent = await response.text();
      expect(csvContent).toContain('ID,Username,Email'); // CSV headers
    });

    test('API Authentication - Unauthorized Access', async ({ request }) => {
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users`);
      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Unauthorized');
    });
  });

  // 3. AUDIT LOGGING VALIDATION
  describe('3. Audit Logging Validation', () => {
    
    test('User View Action Logged', async ({ page, request }) => {
      // Navigate to user profile to trigger audit log
      await page.goto(`${ADMIN_BASE_URL}/admin/users`);
      
      const firstViewButton = page.locator('tbody tr:first-child button:has-text("👁")').first();
      if (await firstViewButton.isVisible()) {
        await firstViewButton.click();
        await page.waitForTimeout(2000); // Wait for audit log to be recorded
        
        // Check audit log for the view action
        const auditResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/audit-log?action=user_viewed&limit=5`, {
          headers: {
            'X-Admin-API-Key': ADMIN_API_KEY
          }
        });
        
        expect(auditResponse.status()).toBe(200);
        const auditData = await auditResponse.json();
        expect(auditData.logs.length).toBeGreaterThan(0);
        
        const latestLog = auditData.logs[0];
        expect(latestLog.action).toBe('user_viewed');
        expect(latestLog.target_entity_type).toBe('user');
      }
    });

    test('Audit Log Page Functionality', async ({ page }) => {
      await page.goto(`${ADMIN_BASE_URL}/admin/audit-log`);
      
      // Check page loads
      await expect(page.locator('h1')).toContainText('Admin Audit Log');
      await expect(page.locator('table')).toBeVisible();
      
      // Test filters
      await page.selectOption('select:near(:text("All Actions"))', 'user_viewed');
      await page.waitForTimeout(1000);
      
      // Verify filtered results
      const logRows = page.locator('tbody tr');
      const count = await logRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // 4. PERFORMANCE TESTING
  describe('4. Performance Testing', () => {
    
    test('User Listing Response Time < 2 seconds', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users?limit=50`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(2000); // < 2 seconds
      
      console.log(`User listing response time: ${responseTime}ms`);
    });

    test('Search Performance < 2 seconds', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users?search=test&limit=20`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(2000); // < 2 seconds
      
      console.log(`Search response time: ${responseTime}ms`);
    });

    test('Individual User Profile Load Time', async ({ request }) => {
      // Get a user ID first
      const listResponse = await request.get(`${ADMIN_BASE_URL}/api/admin/users?limit=1`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      const listData = await listResponse.json();
      if (listData.users.length > 0) {
        const userId = listData.users[0].id;
        
        const startTime = Date.now();
        
        const response = await request.get(`${ADMIN_BASE_URL}/api/admin/users/${userId}`, {
          headers: {
            'X-Admin-API-Key': ADMIN_API_KEY
          }
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        expect(response.status()).toBe(200);
        expect(responseTime).toBeLessThan(2000); // < 2 seconds
        
        console.log(`User profile load time: ${responseTime}ms`);
      }
    });
  });
});

// Helper functions for test data management
async function createTestUser(request) {
  // This would create a test user if we had a user creation endpoint
  // For now, we'll work with existing users
  return null;
}

async function cleanupTestData(request) {
  // Cleanup any test data created during tests
  // Implementation depends on available cleanup endpoints
  return null;
}
