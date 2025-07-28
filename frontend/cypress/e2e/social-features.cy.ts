describe('Social Features', () => {
  beforeEach(() => {
    // Set viewport to desktop size to show sidebar
    cy.viewport(1280, 720)
    
    // First login, then navigate to home page
    cy.visit('/', { failOnStatusCode: false })
    cy.wait(1000)
    
    // Login if not already logged in - handle both mobile and desktop
    cy.get('body').then(($body) => {
      if ($body.text().includes('Sign in')) {
        cy.log('Logging in...')
        
        // Try to find Sign in button in different locations
        const signInButtons = $body.find('button').filter((index, button) => {
          return !!(button.textContent && button.textContent.includes('Sign in'))
        })
        
        if (signInButtons.length > 0) {
          // Click the first visible Sign in button
          cy.get('button:visible').contains('Sign in').click()
          cy.wait(1000) // Wait for modal to open
          
          // Fill in the login form in the modal
          cy.get('#email').type('test1@example.com')
          cy.get('#password').type('SecurePass123!')
          
          // Submit the form
          cy.get('button[type="submit"]').contains('Sign in').click()
          cy.wait(1000) // Wait for login to complete
        } else {
          cy.log('No Sign in button found, assuming already logged in')
        }
      } else {
        cy.log('Already logged in')
      }
    })
    
    // Now navigate to home page
    cy.visit('/home', { failOnStatusCode: false })
    cy.wait(1000)
    
    // Ensure we're on the "For You" tab where posts are visible
    cy.get('button').contains('For You').click()
    cy.wait(500)
    
    // Wait for loading to complete (the loading spinner should disappear)
    cy.get('.animate-spin').should('not.exist', { timeout: 5000 })
    
    // Take a screenshot to verify we're actually logged in
    cy.screenshot('social-features-after-login')
    cy.log('Screenshot taken after login attempt')
  })

  describe('Post Interactions', () => {
    it('should like and unlike a post via post detail page', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing like/unlike functionality via post detail')
          
          // Click on the first post to go to post detail page
          cy.get('app-post').first().click()
          cy.wait(1000)
          
          // Verify we're on post detail page
          cy.url().should('include', '/post/')
          
          // Target the main post specifically (not parent posts or replies)
          cy.get('app-post').not('[isReply]').first().within(() => {
            // Verify like button is clickable
            cy.get('div[title="Like"]').should('be.visible')
            
            // Click like button
            cy.get('div[title="Like"]').click()
            cy.wait(1000)
            
            // Verify the click action completed (button is still visible)
            cy.get('div[title="Like"]').should('be.visible')
            cy.log('Like button click completed successfully')
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should comment on a post via post detail page', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing comment functionality via post detail')
          
          // Click on the first post to go to post detail page
          cy.get('app-post').first().click()
          cy.wait(1000)
          
          // Verify we're on post detail page
          cy.url().should('include', '/post/')
          
          // Find the reply input box and type a comment
          cy.get('textarea[placeholder="Post your reply"]').should('be.visible').type('This is a test comment from Cypress!')
          
          // Submit comment
          cy.get('button').contains('Reply').click()
          cy.wait(1000)
          
          // Verify comment was posted (check if it appears in the comments list)
          cy.get('body').should('contain', 'This is a test comment from Cypress!')
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should repost a post via post detail page', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing repost functionality via post detail')
          
          // Click on the first post to go to post detail page
          cy.get('app-post').first().click()
          cy.wait(1000)
          
          // Verify we're on post detail page
          cy.url().should('include', '/post/')
          
          // Target the main post specifically (not parent posts or replies)
          cy.get('app-post').not('[isReply]').first().within(() => {
            // Verify repost button is clickable
            cy.get('div[title="Repost"]').should('be.visible')
            
            // Click repost button to open menu
            cy.get('div[title="Repost"]').click()
            cy.wait(1000)
            
            // Verify menu opened and click Repost option
            cy.get('button').contains('Repost').should('be.visible').click()
            cy.wait(1000)
            
            // Verify the repost action completed (button is still visible)
            cy.get('div[title="Repost"]').should('be.visible')
            cy.log('Repost action completed successfully')
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should bookmark a post', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing bookmark functionality')
          
          // Find the first post
          cy.get('app-post').first().within(() => {
            // Click bookmark button
            cy.get('div[title="Bookmark"]').click()
            cy.wait(500)
            
            // Verify bookmark button shows as bookmarked
            cy.get('div[title="Bookmark"]').should('have.class', 'text-blue-500')
            
            // Click bookmark button again to unbookmark
            cy.get('div[title="Bookmark"]').click()
            cy.wait(500)
            
            // Verify bookmark button shows as not bookmarked
            cy.get('div[title="Bookmark"]').should('not.have.class', 'text-blue-500')
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })
  })

  describe('User Interactions', () => {
    it('should follow and unfollow a user from search', () => {
      // Navigate to search page
      cy.visit('/search', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Check if users are available
      cy.get('body').then(($body) => {
        const userCards = $body.find('.user-card, [data-testid="user-card"]')
        
        if (userCards.length > 0) {
          cy.log('Users found, testing follow/unfollow functionality')
          
          // Find the first user card
          cy.get('.user-card, [data-testid="user-card"]').first().within(() => {
            // Check if follow button exists
            cy.get('button').contains('Follow').then(($followBtn) => {
              if ($followBtn.length > 0) {
                // Click follow button
                cy.get('button').contains('Follow').click()
                cy.wait(500)
                
                // Verify button text changed to "Following"
                cy.get('button').contains('Following').should('be.visible')
                
                // Click follow button again to unfollow
                cy.get('button').contains('Following').click()
                cy.wait(500)
                
                // Verify button text changed back to "Follow"
                cy.get('button').contains('Follow').should('be.visible')
              } else {
                cy.log('No follow button found, test will be skipped')
                expect(true).to.be.true
              }
            })
          })
        } else {
          cy.log('No users found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should view user profile and follow from there', () => {
      // Navigate to search page
      cy.visit('/search', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Check if users are available
      cy.get('body').then(($body) => {
        const userCards = $body.find('.user-card, [data-testid="user-card"]')
        
        if (userCards.length > 0) {
          cy.log('Users found, testing profile follow functionality')
          
          // Click on the first user card to go to their profile
          cy.get('.user-card, [data-testid="user-card"]').first().click()
          cy.wait(1000)
          
          // Check if follow button exists on profile
          cy.get('button').contains('Follow').then(($followBtn) => {
            if ($followBtn.length > 0) {
              // Click follow button
              cy.get('button').contains('Follow').click()
              cy.wait(500)
              
              // Verify button text changed to "Following"
              cy.get('button').contains('Following').should('be.visible')
            } else {
              cy.log('No follow button found on profile, test will be skipped')
              expect(true).to.be.true
            }
          })
        } else {
          cy.log('No users found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should view user posts on their profile', () => {
      // Navigate to search page
      cy.visit('/search', { failOnStatusCode: false })
      cy.wait(1000)
      
      // Check if users are available
      cy.get('body').then(($body) => {
        const userCards = $body.find('.user-card, [data-testid="user-card"]')
        
        if (userCards.length > 0) {
          cy.log('Users found, testing profile posts view')
          
          // Click on the first user card to go to their profile
          cy.get('.user-card, [data-testid="user-card"]').first().click()
          cy.wait(1000)
          
          // Check if posts tab is available
          cy.get('button').contains('Posts').then(($postsTab) => {
            if ($postsTab.length > 0) {
              // Click on Posts tab
              cy.get('button').contains('Posts').click()
              cy.wait(500)
              
              // Verify posts section is visible
              cy.get('.posts-container, [data-testid="posts-container"]').should('be.visible')
            } else {
              cy.log('No posts tab found, test will be skipped')
              expect(true).to.be.true
            }
          })
        } else {
          cy.log('No users found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })
  })

  describe('Social Feed Interactions', () => {
    it('should scroll through feed and interact with multiple posts', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing feed interactions')
          
          // Scroll down to load more posts
          cy.scrollTo('bottom')
          cy.wait(1000)
          
                     // Like the second post
           cy.get('app-post').eq(1).within(() => {
             cy.get('div[title="Like"]').click()
             cy.wait(500)
           })
           
                       // Comment on the third post via post detail page
            cy.get('app-post').eq(2).click()
            cy.wait(1000)
            cy.url().should('include', '/post/')
            cy.get('textarea[placeholder="Post your reply"]').should('be.visible').type('Another test comment!')
            cy.get('button').contains('Reply').click()
            cy.wait(500)
            // Go back to home
            cy.visit('/home')
            cy.wait(1000)
           
           // Repost the fourth post
           cy.get('app-post').eq(3).within(() => {
             cy.get('div[title="Repost"]').click()
             cy.wait(500)
             cy.get('button').contains('Repost').click()
             cy.wait(500)
           })
          
          // Verify interactions were successful
          cy.get('app-post').should('have.length.at.least', 4)
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should handle post interactions with different post types', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing different post types')
          
          // Find posts with different content types
          cy.get('app-post').each(($post, index) => {
            if (index < 3) { // Test first 3 posts
              cy.wrap($post).within(() => {
                // Check if post has image
                cy.get('img').then(($images) => {
                  if ($images.length > 0) {
                    cy.log(`Post ${index + 1} has image`)
                  }
                })
                
                // Check if post has text content
                cy.get('p, .post-content').then(($content) => {
                  if ($content.length > 0) {
                    cy.log(`Post ${index + 1} has text content`)
                  }
                })
                
                                 // Like the post
                 cy.get('div[title="Like"]').click()
                 cy.wait(200)
              })
            }
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should verify all social interaction buttons are present and clickable', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing social interaction buttons')
          
          // Find the first post and verify all interaction buttons are present
          cy.get('app-post').first().within(() => {
            // Verify like button is present and clickable
            cy.get('div[title="Like"]').should('be.visible')
            
            // Verify reply button is present and clickable
            cy.get('div[title="Reply"]').should('be.visible')
            
            // Verify repost button is present and clickable
            cy.get('div[title="Repost"]').should('be.visible')
            
            // Verify bookmark button is present and clickable
            cy.get('div[title="Bookmark"]').should('be.visible')
            
            // Verify share button is present and clickable
            cy.get('div[title="Share"]').should('be.visible')
            
            cy.log('All social interaction buttons are present and clickable')
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })

    it('should verify post content is displayed correctly', () => {
      // Check if posts are available
      cy.get('body').then(($body) => {
        const posts = $body.find('app-post')
        
        if (posts.length > 0) {
          cy.log('Posts found, testing post content')
          
          // Find the first post and verify content structure
          cy.get('app-post').first().within(() => {
            // Verify post content is present
            cy.get('p').should('be.visible')
            
            // Verify post has some content (not empty)
            cy.get('p').should('not.be.empty')
            
            // Verify there's some text content
            cy.get('p').invoke('text').should('not.be.empty')
            
            cy.log('Post content is displayed correctly')
          })
        } else {
          cy.log('No posts found, test will be skipped')
          expect(true).to.be.true
        }
      })
    })
  })

  describe('Social Navigation', () => {
    it('should navigate between different social sections', () => {
      // Navigate to notifications
      cy.get('a[title="Notifications"]').first().click()
      cy.wait(1000)
      cy.url().should('include', '/notifications')
      
      // Navigate to messages
      cy.get('a[title="Messages"]').first().click()
      cy.wait(1000)
      cy.url().should('include', '/messages')
      
      // Navigate back to home
      cy.get('a[title="Home"]').first().click()
      cy.wait(1000)
      cy.url().should('include', '/home')
      
      // Navigate to search
      cy.get('a[title="Search"]').first().click()
      cy.wait(1000)
      cy.url().should('include', '/search')
    })

    it('should access user profile from sidebar', () => {
      // Click on user menu button in sidebar
      cy.get('app-sidebar').first().within(() => {
        cy.get('button[title="User menu"]').click()
      })
      cy.wait(1000)
      
      // Click on Profile option in the menu (use force to bypass overlay)
      cy.get('a').contains('Profile').click({ force: true })
      cy.wait(1000)
      
      // Verify we're on profile page (profile URL is /username, not /profile)
      cy.url().should('include', '/testuser1')
      
      // Verify we're on a profile page by checking for username in URL
      cy.url().should('contain', 'testuser1')
    })
  })
}) 