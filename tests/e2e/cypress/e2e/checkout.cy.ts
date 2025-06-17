/// <reference types="cypress" />

describe('Checkout Flow', () => {
  // Test data
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  };

  const testProduct = {
    id: '1',
    name: 'Test Product',
    price: 99.99,
  };

  const shippingAddress = {
    firstName: 'Test',
    lastName: 'User',
    addressLine1: '123 Test St',
    addressLine2: 'Apt 4B',
    city: 'Test City',
    state: 'CA',
    postalCode: '12345',
    country: 'United States',
    phone: '123-456-7890',
  };

  const paymentInfo = {
    cardNumber: '4242424242424242',
    expiryDate: '12/30',
    cvc: '123',
    nameOnCard: 'Test User',
  };

  beforeEach(() => {
    // Reset the test database and seed with test data
    cy.task('db:reset');
    cy.task('db:seed');

    // Stub network requests
    cy.intercept('POST', '/api/auth/login', { fixture: 'auth/success.json' }).as('login');
    cy.intercept('GET', '/api/products/*', { fixture: 'products/single.json' }).as('getProduct');
    cy.intercept('POST', '/api/cart', { statusCode: 201, body: {} }).as('addToCart');
    cy.intercept('GET', '/api/cart', { fixture: 'cart/with-items.json' }).as('getCart');
    cy.intercept('POST', '/api/checkout', { statusCode: 200, body: { orderId: 'order_123' } }).as('submitOrder');
    cy.intercept('GET', '/api/orders/order_123', { fixture: 'orders/success.json' }).as('getOrder');

    // Visit the home page
    cy.visit('/');
  });

  it('completes checkout as guest', () => {
    // Navigate to a product
    cy.visit(`/products/${testProduct.id}`);
    
    // Add to cart
    cy.get('[data-testid="add-to-cart-button"]').click();
    
    // Go to cart
    cy.get('[data-testid="cart-icon"]').click();
    
    // Proceed to checkout
    cy.get('[data-testid="checkout-button"]').click();
    
    // Fill in guest information
    cy.get('[data-testid="guest-email"]').type('guest@example.com');
    cy.get('[data-testid="continue-as-guest"]').click();
    
    // Fill in shipping address
    fillShippingForm();
    cy.get('[data-testid="continue-to-payment"]').click();
    
    // Fill in payment information
    fillPaymentForm();
    
    // Place order
    cy.get('[data-testid="place-order-button"]').click();
    
    // Verify order confirmation
    cy.url().should('include', '/order-confirmation');
    cy.get('[data-testid="order-confirmation"]').should('be.visible');
    cy.get('[data-testid="order-number"]').should('contain', 'order_123');
  });

  it('completes checkout as logged-in user', () => {
    // Login
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email"]').type(testUser.email);
    cy.get('[data-testid="password"]').type(testUser.password);
    cy.get('[data-testid="login-submit"]').click();
    
    // Navigate to a product
    cy.visit(`/products/${testProduct.id}`);
    
    // Add to cart
    cy.get('[data-testid="add-to-cart-button"]').click();
    
    // Go to cart
    cy.get('[data-testid="cart-icon"]').click();
    
    // Proceed to checkout
    cy.get('[data-testid="checkout-button"]').click();
    
    // Verify saved address is shown
    cy.get('[data-testid="saved-address"]').should('be.visible');
    
    // Continue to payment
    cy.get('[data-testid="continue-to-payment"]').click();
    
    // Fill in payment information
    fillPaymentForm();
    
    // Place order
    cy.get('[data-testid="place-order-button"]').click();
    
    // Verify order confirmation
    cy.url().should('include', '/order-confirmation');
    cy.get('[data-testid="order-confirmation"]').should('be.visible');
  });

  it('validates required fields during checkout', () => {
    // Navigate to a product
    cy.visit(`/products/${testProduct.id}`);
    
    // Add to cart
    cy.get('[data-testid="add-to-cart-button"]').click();
    
    // Go to cart
    cy.get('[data-testid="cart-icon"]').click();
    
    // Proceed to checkout
    cy.get('[data-testid="checkout-button"]').click();
    
    // Try to continue without filling required fields
    cy.get('[data-testid="continue-as-guest"]').click();
    
    // Verify validation errors
    cy.get('[data-testid="error-email"]').should('be.visible');
    
    // Fill in email but don't submit
    cy.get('[data-testid="guest-email"]').type('invalid-email');
    cy.get('[data-testid="continue-as-guest"]').click();
    
    // Verify email validation
    cy.get('[data-testid="error-email"]').should('be.visible');
  });

  it('shows order summary with correct totals', () => {
    // Navigate to a product
    cy.visit(`/products/${testProduct.id}`);
    
    // Add to cart
    cy.get('[data-testid="add-to-cart-button"]').click();
    
    // Go to cart
    cy.get('[data-testid="cart-icon"]').click();
    
    // Verify order summary
    cy.get('[data-testid="subtotal"]').should('contain', '$99.99');
    cy.get('[data-testid="shipping"]').should('contain', '$0.00'); // Free shipping
    cy.get('[data-testid="tax"]').should('contain', '$8.00'); // 8% tax
    cy.get('[data-testid="total"]').should('contain', '$107.99');
    
    // Apply promo code
    cy.get('[data-testid="promo-code-input"]').type('TEST10');
    cy.get('[data-testid="apply-promo"]').click();
    
    // Verify discount applied
    cy.get('[data-testid="discount"]').should('contain', '-$10.00');
    cy.get('[data-testid="total"]').should('contain', '$97.99');
  });

  it('handles payment failure gracefully', () => {
    // Mock payment failure
    cy.intercept('POST', '/api/checkout', {
      statusCode: 402,
      body: { error: 'Payment failed: Insufficient funds' },
    }).as('submitOrderFailed');
    
    // Navigate to a product
    cy.visit(`/products/${testProduct.id}`);
    
    // Add to cart and proceed to checkout
    cy.get('[data-testid="add-to-cart-button"]').click();
    cy.get('[data-testid="cart-icon"]').click();
    cy.get('[data-testid="checkout-button"]').click();
    
    // Fill in guest information
    cy.get('[data-testid="guest-email"]').type('guest@example.com');
    cy.get('[data-testid="continue-as-guest"]').click();
    
    // Fill in shipping address
    fillShippingForm();
    cy.get('[data-testid="continue-to-payment"]').click();
    
    // Fill in payment information
    fillPaymentForm();
    
    // Place order (should fail)
    cy.get('[data-testid="place-order-button"]').click();
    
    // Verify error message is shown
    cy.get('[data-testid="payment-error"]').should('be.visible');
    cy.get('[data-testid="payment-error"]').should('contain', 'Payment failed');
    
    // Verify cart is preserved
    cy.get('[data-testid="cart-count"]').should('contain', '1');
  });

  // Helper functions
  function fillShippingForm() {
    cy.get('[data-testid="shipping-firstName"]').type(shippingAddress.firstName);
    cy.get('[data-testid="shipping-lastName"]').type(shippingAddress.lastName);
    cy.get('[data-testid="shipping-addressLine1"]').type(shippingAddress.addressLine1);
    cy.get('[data-testid="shipping-addressLine2"]').type(shippingAddress.addressLine2);
    cy.get('[data-testid="shipping-city"]').type(shippingAddress.city);
    cy.get('[data-testid="shipping-state"]').type(shippingAddress.state);
    cy.get('[data-testid="shipping-postalCode"]').type(shippingAddress.postalCode);
    cy.get('[data-testid="shipping-country"]').select(shippingAddress.country);
    cy.get('[data-testid="shipping-phone"]').type(shippingAddress.phone);
  }

  function fillPaymentForm() {
    cy.get('[data-testid="card-number"]').type(paymentInfo.cardNumber);
    cy.get('[data-testid="card-expiry"]').type(paymentInfo.expiryDate);
    cy.get('[data-testid="card-cvc"]').type(paymentInfo.cvc);
    cy.get('[data-testid="card-name"]').type(paymentInfo.nameOnCard);
  }
});
