// Import file upload plugin
import 'cypress-file-upload'

// Custom commands for authentication testing
// @ts-ignore
Cypress.Commands.add('openLoginModal', () => {
  cy.get('button').contains('Sign in').click()
})

// @ts-ignore
Cypress.Commands.add('openRegisterModal', () => {
  cy.get('button').contains('Join us').click()
})

// @ts-ignore
Cypress.Commands.add('fillLoginForm', (email: string, password: string) => {
  cy.get('#email').type(email)
  cy.get('#password').type(password)
})

// @ts-ignore
Cypress.Commands.add('fillRegisterForm', (username: string, handle: string, email: string, password: string) => {
  cy.get('#username').type(username)
  cy.get('#handle').type(handle)
  cy.get('#email').type(email)
  cy.get('#password').type(password)
  cy.get('#password2').type(password)
})

// @ts-ignore
Cypress.Commands.add('submitLoginForm', () => {
  cy.get('button[type="submit"]').click()
})

// @ts-ignore
Cypress.Commands.add('submitRegisterForm', () => {
  cy.get('button[type="submit"]').click()
})

// @ts-ignore
Cypress.Commands.add('closeModal', () => {
  cy.get('button[type="button"]').first().click()
}) 