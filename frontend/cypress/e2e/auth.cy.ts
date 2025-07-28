describe('Authentication', () => {

  before(() => {
    // Create test user if it doesn't exist (run once before all tests)
    cy.request({
      method: 'POST',
      url: 'http://localhost:8000/api/users/',
      body: {
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'SecurePass123!',
        password2: 'SecurePass123!',
        handle: 'testuser1'
      },
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 201) {
        cy.log('✅ Test user created successfully')
      } else if (response.status === 400 && response.body.username) {
        cy.log('✅ Test user already exists')
      } else {
        cy.log(`⚠️ Unexpected response: ${response.status}`)
        cy.log(`Response body: ${JSON.stringify(response.body)}`)
      }
    })
  })

  beforeEach(() => {
    // Set viewport to mobile size to show mobile navigation
    cy.viewport(375, 667)
    cy.visit('/', { failOnStatusCode: false })
    // Wait for Angular to load
    cy.wait(1000)
  })

  describe('Login Modal', () => {
    it('should open login modal when clicking Sign in button', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('h2').should('contain', 'Sign in to your account')
      cy.get('#email').should('be.visible')
      cy.get('#password').should('be.visible')
    })

    it('should display validation errors for empty form submission', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('form').submit()
      // The form should not submit due to required fields
      cy.get('#email').should('have.attr', 'required')
      cy.get('#password').should('have.attr', 'required')
    })

    it('should allow typing in email and password fields', () => {
      cy.get('button').contains('Sign in').click()
      cy.wait(1000) // Wait for modal to fully render
      cy.get('#email').type('test@example.com')
      cy.get('#password').type('password123')
      cy.get('#email').should('have.value', 'test@example.com')
      cy.get('#password').should('have.value', 'password123')
    })

    it('should close modal when clicking close button', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('button[type="button"]').first().click() // Close button
      // Check that the modal dialog is no longer visible
      cy.get('[role="dialog"]').should('not.exist')
    })

    it('should switch to register modal when clicking register link', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('button').contains('Don\'t have an account? Register').click()
      cy.get('h2').should('contain', 'Create your account')
    })
  })

  describe('Register Modal', () => {
    it('should open register modal when clicking Join us button', () => {
      cy.get('button').contains('Join us').click()
      cy.get('h2').should('contain', 'Create your account')
      cy.get('#username').should('be.visible')
      cy.get('#handle').should('be.visible')
      cy.get('#email').should('be.visible')
      cy.get('#password').should('be.visible')
      cy.get('#password2').should('be.visible')
    })

    it('should display validation errors for empty form submission', () => {
      cy.get('button').contains('Join us').click()
      cy.get('form').submit()
      // The form should not submit due to required fields
      cy.get('#username').should('have.attr', 'required')
      cy.get('#handle').should('have.attr', 'required')
      cy.get('#email').should('have.attr', 'required')
      cy.get('#password').should('have.attr', 'required')
      cy.get('#password2').should('have.attr', 'required')
    })

    it('should allow typing in all form fields', () => {
      cy.get('button').contains('Join us').click()
      cy.wait(500)
      cy.get('#username').type('TestUser')
      cy.get('#handle').type('testuser')
      cy.get('#email').type('test@example.com')
      cy.get('#password').type('password123')
      cy.get('#password2').type('password123')
      
      cy.get('#username').should('have.value', 'TestUser')
      cy.get('#handle').should('have.value', 'testuser')
      cy.get('#email').should('have.value', 'test@example.com')
      cy.get('#password').should('have.value', 'password123')
      cy.get('#password2').should('have.value', 'password123')
    })

    it('should close modal when clicking close button', () => {
      cy.get('button').contains('Join us').click()
      cy.get('button[type="button"]').first().click() // Close button
      // Check that the modal dialog is no longer visible
      cy.get('[role="dialog"]').should('not.exist')
    })

    it('should switch to login modal when clicking sign in link', () => {
      cy.get('button').contains('Join us').click()
      cy.get('button').contains('Already have an account? Sign in').click()
      cy.get('h2').should('contain', 'Sign in to your account')
    })

    it('should have demo data button', () => {
      cy.get('button').contains('Join us').click()
      cy.get('button').contains('Fill with demo data').should('be.visible')
    })
  })

  describe('Modal Navigation', () => {
    it('should be able to switch between login and register modals', () => {
      // Start with login modal
      cy.get('button').contains('Sign in').click()
      cy.get('h2').should('contain', 'Sign in to your account')
      
      // Switch to register
      cy.get('button').contains('Don\'t have an account? Register').click()
      cy.get('h2').should('contain', 'Create your account')
      
      // Switch back to login
      cy.get('button').contains('Already have an account? Sign in').click()
      cy.get('h2').should('contain', 'Sign in to your account')
    })
  })

  describe('Form Validation', () => {
    it('should validate email format in login form', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('#email').type('invalid-email')
      cy.get('#email').should('have.attr', 'type', 'email')
    })

    it('should validate email format in register form', () => {
      cy.get('button').contains('Join us').click()
      cy.get('#email').type('invalid-email')
      cy.get('#email').should('have.attr', 'type', 'email')
    })

    it('should require password confirmation in register form', () => {
      cy.get('button').contains('Join us').click()
      cy.get('#password').type('password123')
      cy.get('#password2').type('differentpassword')
      // The form should not be valid due to password mismatch
      cy.get('button[type="submit"]').should('be.disabled')
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels for form fields', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('label[for="email"]').should('contain', 'Email')
      cy.get('label[for="password"]').should('contain', 'Password')
      
      cy.get('button').contains('Don\'t have an account? Register').click()
      cy.get('label[for="username"]').should('contain', 'Name')
      cy.get('label[for="handle"]').should('contain', 'Handle')
      cy.get('label[for="email"]').should('contain', 'Email')
      cy.get('label[for="password"]').should('contain', 'Password')
      cy.get('label[for="password2"]').should('contain', 'Confirm Password')
    })

    it('should have proper placeholders', () => {
      cy.get('button').contains('Sign in').click()
      cy.get('#email').should('have.attr', 'placeholder', 'Enter your email')
      cy.get('#password').should('have.attr', 'placeholder', 'Enter your password')
      
      cy.get('button').contains('Don\'t have an account? Register').click()
      cy.get('#username').should('have.attr', 'placeholder', 'Enter your name (you can customize this anytime)')
      cy.get('#handle').should('have.attr', 'placeholder', 'Choose your handle (this will be permanent)')
      cy.get('#email').should('have.attr', 'placeholder', 'Enter your email')
      cy.get('#password').should('have.attr', 'placeholder', 'Create a password')
      cy.get('#password2').should('have.attr', 'placeholder', 'Confirm your password')
    })
  })

  describe('Real Login Test', () => {
    it('should successfully login with test user', () => {
      // Set viewport to desktop for this test
      cy.viewport(1280, 720)
      cy.visit('/', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Click Sign in
      cy.get('button:visible').contains('Sign in').click()
      cy.wait(500)
      
      // Fill in login form with test user credentials
      cy.get('#email').type('test1@example.com')
      cy.get('#password').type('SecurePass123!')
      
      // Submit login
      cy.get('button[type="submit"]').contains('Sign in').click()
      cy.wait(1000)
      
      // Verify successful login by checking for sidebar
      cy.get('app-sidebar').should('exist')
      cy.log('✅ Successfully logged in - sidebar is present')
    })

    it('should handle invalid credentials', () => {
      cy.viewport(1280, 720)
      cy.visit('/', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Click Sign in
      cy.get('button:visible').contains('Sign in').click()
      cy.wait(500)
      
      // Fill in login form with invalid credentials
      cy.get('#email').type('invalid@example.com')
      cy.get('#password').type('wrongpassword')
      
      // Submit login
      cy.get('button[type="submit"]').contains('Sign in').click()
      cy.wait(1000)
      
      // Should still be on login modal (not logged in)
      cy.get('h2').should('contain', 'Sign in to your account')
      cy.log('✅ Invalid credentials handled correctly - user not logged in')
    })
  })

  describe('Logout Functionality', () => {
    it('should successfully logout user', () => {
      // First login
      cy.viewport(1280, 720)
      cy.visit('/', { failOnStatusCode: false })
      cy.wait(1000)
      
      cy.get('button:visible').contains('Sign in').click()
      cy.wait(500)
      cy.get('#email').type('test1@example.com')
      cy.get('#password').type('SecurePass123!')
      cy.get('button[type="submit"]').contains('Sign in').click()
      cy.wait(1000)
      
      // Verify logged in
      cy.get('app-sidebar').should('exist')
      
      // Open user menu in sidebar to access logout button
      cy.get('app-sidebar').first().within(() => {
        // Look for the user menu button with title="User menu"
        cy.get('button[title="User menu"]').click()
        cy.wait(2000) // Wait longer for menu to render
      })
      
      // Wait for the user menu to be visible and then click Log out
      cy.get('body').should('contain', 'Log out')
      // The logout button should be visible in the user menu
      // Target only visible logout buttons to avoid the hidden mobile one
      cy.get('button:visible').contains('Log out').click()
      
      cy.wait(1000)
      
      // Verify logged out - sidebar should not exist
      cy.get('app-sidebar').should('not.exist')
      cy.log('✅ Successfully logged out - sidebar removed')
    })
  })

  describe('Registration Flow', () => {
    it('should successfully register a new user', () => {
      // Use desktop viewport to test desktop registration flow
      cy.viewport(1280, 720)
      cy.visit('/', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Click Join us (should be visible in desktop sidebar)
      cy.get('button:visible').contains('Join us').click()
      cy.wait(500)
      
      // Fill registration form with unique data
      const timestamp = Date.now()
      const uniqueUsername = `testuser${timestamp}`
      const uniqueEmail = `test${timestamp}@example.com`
      const uniqueHandle = `testuser${timestamp}`
      
      cy.get('#username').type(uniqueUsername)
      cy.get('#handle').type(uniqueHandle)
      cy.get('#email').type(uniqueEmail)
      cy.get('#password').type('SecurePass123!')
      cy.get('#password2').type('SecurePass123!')
      
      // Submit registration
      cy.get('button[type="submit"]').contains('Create account').click()
      cy.wait(1000)
      
      // Should be logged in after successful registration
      cy.get('app-sidebar').should('exist')
      cy.log('✅ Successfully registered and logged in')
    })

    it('should handle registration with existing email', () => {
      // Use desktop viewport to test desktop registration flow
      cy.viewport(1280, 720)
      cy.visit('/', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Click Join us (should be visible in desktop sidebar)
      cy.get('button:visible').contains('Join us').click()
      cy.wait(500)
      
      // Try to register with existing email
      cy.get('#username').type('newuser')
      cy.get('#handle').type('newuser')
      cy.get('#email').type('test1@example.com') // Existing email
      cy.get('#password').type('SecurePass123!')
      cy.get('#password2').type('SecurePass123!')
      
      // Submit registration
      cy.get('button[type="submit"]').contains('Create account').click()
      cy.wait(1000)
      
      // Should still be on registration form (not logged in)
      cy.get('h2').should('contain', 'Create your account')
      cy.log('✅ Registration with existing email handled correctly')
    })
  })
}) 