import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PostComponent } from '../shared/post/post.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PostService } from '../../services/post.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../models/post.model';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { RegisterModalComponent } from '../register-modal/register-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PostComponent,
    SearchBarComponent,
    LoginModalComponent,
    RegisterModalComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="w-[1275px] mx-auto flex gap-8 min-h-screen">
        <!-- Left Sidebar -->
        <div class="w-[275px]">
          <div class="fixed w-[275px] h-screen bg-white shadow-lg">
            <!-- Title -->
            <div class="pt-4 pl-4">
              <h1 class="text-2xl font-bold text-indigo-600 cursor-pointer hover:text-indigo-700 transition-colors" (click)="onTitleClick()">
                Human Art Social
              </h1>
            </div>

            <!-- Promotional Text -->
            <div class="mt-6 px-4">
              <p class="text-xl font-extrabold text-gray-900 tracking-tight">Where human creativity comes to life.</p>
            </div>

            <!-- Auth Buttons -->
            <div class="mt-8 px-4">
              <div class="flex gap-3">
                <button 
                  (click)="showRegisterModal = true"
                  class="flex-1 py-2.5 px-4 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors text-sm">
                  Join us
                </button>
                <button 
                  (click)="showLoginModal = true"
                  class="flex-1 py-2.5 px-4 border border-blue-500 text-blue-500 rounded-full font-semibold hover:bg-blue-50 transition-colors text-sm">
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <main class="w-[600px]">
          <!-- Tab Navigation -->
          <div class="bg-white border-b sticky top-0 z-10">
            <div class="flex">
              <button 
                [class.border-b-2]="activeTab === 'for-you'"
                [class.border-blue-500]="activeTab === 'for-you'"
                [class.text-blue-500]="activeTab === 'for-you'"
                class="flex-1 py-4 text-center font-bold hover:bg-gray-50 transition-colors"
                (click)="setActiveTab('for-you')"
              >
                For You
              </button>
              <button 
                [class.border-b-2]="activeTab === 'human-drawing'"
                [class.border-blue-500]="activeTab === 'human-drawing'"
                [class.text-blue-500]="activeTab === 'human-drawing'"
                class="flex-1 py-4 text-center font-bold hover:bg-gray-50 transition-colors"
                (click)="setActiveTab('human-drawing')"
              >
                Human Art
              </button>
            </div>
          </div>

          <div class="divide-y">
            <app-post *ngFor="let post of posts" [post]="post" [isPreview]="true"></app-post>
          </div>
        </main>

        <!-- Right Sidebar -->
        <div class="w-[350px]">
          <div class="fixed w-[350px] h-screen bg-white shadow-lg p-4">
            <app-search-bar [isPreview]="true"></app-search-bar>
          </div>
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <app-login-modal
      *ngIf="showLoginModal"
      (close)="showLoginModal = false"
      (openRegister)="switchToRegister()"
    ></app-login-modal>

    <!-- Register Modal -->
    <app-register-modal
      *ngIf="showRegisterModal"
      (close)="showRegisterModal = false"
      (openLogin)="switchToLogin()"
    ></app-register-modal>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LandingComponent implements OnInit {
  posts: Post[] = [];
  activeTab: 'for-you' | 'human-drawing' = 'for-you';
  showLoginModal = false;
  showRegisterModal = false;

  constructor(
    private postService: PostService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
      return;
    }

    // Get initial tab state from URL params
    const tabFromParams = this.route.snapshot.queryParams['tab'];
    this.activeTab = (tabFromParams || 'for-you') as 'for-you' | 'human-drawing';
    
    // Initial load of posts
    this.loadPosts();
    
    // Subscribe to future tab changes
    this.route.queryParams.subscribe(params => {
      const newTab = params['tab'] || 'for-you';
      if (this.activeTab !== newTab) {
        this.activeTab = newTab as 'for-you' | 'human-drawing';
        this.loadPosts();
      }
    });
  }

  onTitleClick() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  setActiveTab(tab: 'for-you' | 'human-drawing'): void {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      
      // Update URL without navigation
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: tab === 'for-you' ? null : tab },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      // Reload posts for the new tab
      this.loadPosts();
    }
  }

  private loadPosts() {
    this.postService.getPublicPosts(this.activeTab).subscribe(
      response => {
        // Handle paginated response
        const posts = response.results || [];
        this.posts = posts;
      }
    );
  }

  switchToLogin() {
    this.showRegisterModal = false;
    this.showLoginModal = true;
  }

  switchToRegister() {
    this.showLoginModal = false;
    this.showRegisterModal = true;
  }
} 