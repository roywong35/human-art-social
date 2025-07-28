import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    // Don't fail if server is not running
    retries: {
      runMode: 0,
      openMode: 0
    },
    // Disable web security to avoid CORS issues
    chromeWebSecurity: false,
    // Additional settings for network issues
    experimentalModifyObstructiveThirdPartyCode: true
  },
}) 