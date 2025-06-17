describe('Authentication', () => {
  beforeEach(() => {
    // Reset the test state before each test
    cy.visit('/auth/login');
  });

  it('should allow users to log in with valid credentials', () => {
    // Mock the API response for successful login
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
        },
        token: 'test-token',
      },
    }).as('loginRequest');

    // Fill in the login form
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    
    // Submit the form
    cy.get('button[type="submit"]').click();

    // Verify the login request was made
    cy.wait('@loginRequest').then((interception) => {
      expect(interception.request.body).to.deep.equal({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    // Verify successful navigation to dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome, Test User').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    // Mock the API response for failed login
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: {
        message: 'Invalid credentials',
      },
    }).as('loginRequest');

    // Fill in the login form with invalid credentials
    cy.get('input[name="email"]').type('wrong@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    
    // Submit the form
    cy.get('button[type="submit"]').click();

    // Verify error message is displayed
    cy.contains('Invalid email or password').should('be.visible');
  });

  it('should allow users to sign up', () => {
    // Mock the API response for successful signup
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 201,
      body: {
        user: {
          id: '456',
          email: 'new@example.com',
          name: 'New User',
        },
        token: 'new-user-token',
      },
    }).as('signupRequest');

    // Navigate to signup page
    cy.contains('Sign up').click();
    
    // Fill in the signup form
    cy.get('input[name="name"]').type('New User');
    cy.get('input[name="email"]').type('new@example.com');
    cy.get('input[name="password"]').type('securePassword123');
    cy.get('input[name="confirmPassword"]').type('securePassword123');
    
    // Submit the form
    cy.get('button[type="submit"]').click();

    // Verify the signup request was made
    cy.wait('@signupRequest').then((interception) => {
      expect(interception.request.body).to.deep.equal({
        name: 'New User',
        email: 'new@example.com',
        password: 'securePassword123',
      });
    });

    // Verify successful navigation to dashboard
    cy.url().should('include', '/dashboard');
  });
});
