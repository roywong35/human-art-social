import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../models/post.model';
import { User } from '../../../models/user.model';
import { PostService } from '../../../services/post.service';
import { UserService } from '../../../services/user.service';
import { OptimisticUpdateService } from '../../../services/optimistic-update.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchBarComponent, PostComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  searchQuery: string = '';
  posts: Post[] = [];
  users: User[] = [];
  isLoading: boolean = false;
  isHashtagSearch: boolean = false;
  hasSearched: boolean = false;
  
  // Tab management
  activeTab: 'top' | 'people' = 'top';
  
  // Loading states for different sections
  isLoadingPosts: boolean = false;
  isLoadingUsers: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private userService: UserService,
    private optimisticUpdateService: OptimisticUpdateService
  ) {}

  ngOnInit() {
    // Subscribe to query parameter changes
    this.route.queryParams.subscribe(params => {
      const query = params['q'] || '';
      this.searchQuery = query.trim();
      this.isHashtagSearch = this.searchQuery.startsWith('#');
      
      if (this.searchQuery) {
        this.hasSearched = true;
        this.performSearch(this.searchQuery);
      } else {
        this.posts = [];
        this.users = [];
        this.hasSearched = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  switchTab(tab: 'top' | 'people') {
    this.activeTab = tab;
  }

  trackByPostId(index: number, post: Post): number {
    return post.id;
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }

  followUser(user: User, event: Event) {
    event.stopPropagation(); // Prevent navigation to profile
    
    // Apply optimistic update immediately
    const optimisticUser = this.optimisticUpdateService.getOptimisticUserForFollow(user);
    const index = this.users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.users[index] = optimisticUser;
    }
    
    // Make the API call
    this.optimisticUpdateService.followUserOptimistic(user).subscribe({
      next: (updatedUser) => {
        // Update with real response
        if (index !== -1) {
          this.users[index] = updatedUser;
        }
      },
      error: (error) => {
        console.error('Error following user:', error);
        // Rollback to original state on error
        if (index !== -1) {
          this.users[index] = user;
        }
      }
    });
  }

  navigateToProfile(user: User) {
    this.router.navigate(['/', user.handle]);
  }

  onFollowButtonHover(user: User, isHovering: boolean) {
    // Handle follow button hover effects if needed
    // This method is called from the template to match right-sidebar behavior
  }

  // Get limited users for Top tab (max 3)
  get limitedUsers(): User[] {
    return this.users.slice(0, 3);
  }

  // Filter out reposted posts from search results
  get filteredPosts(): Post[] {
    return this.posts.filter(post => post.post_type !== 'repost');
  }

  private performSearch(query: string) {
    if (!query.trim()) {
      this.posts = [];
      this.users = [];
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.posts = [];
    this.users = [];

    // Determine search terms for different types
    const isHashtagSearch = query.startsWith('#');
    const isUserSearch = query.startsWith('@');
    
    // For hashtag searches, only search posts
    if (isHashtagSearch) {
      const hashtagTerm = query.substring(1);
      this.searchPosts(hashtagTerm);
    } else {
      // For regular searches, search both users and posts
      const userSearchTerm = isUserSearch ? query.substring(1) : query;
      const postSearchTerm = isUserSearch ? userSearchTerm : query;
      
      // Search both users and posts simultaneously
      this.isLoadingUsers = true;
      this.isLoadingPosts = true;
      
      forkJoin({
        users: this.userService.searchUsers(userSearchTerm),
        posts: this.postService.searchPosts(postSearchTerm)
      }).subscribe({
        next: (results) => {
          console.log('Search results received:', results);
          this.users = results.users;
          // Filter out reposted posts from search results
          this.posts = results.posts.filter(post => post.post_type !== 'repost');
          

          
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
        },
        error: (error) => {
          console.error('Error searching:', error);
          this.users = [];
          this.posts = [];
          this.isLoading = false;
          this.isLoadingUsers = false;
          this.isLoadingPosts = false;
        }
      });
    }
  }

  private searchPosts(query: string) {
    this.isLoadingPosts = true;
    
    this.postService.searchPosts(query).subscribe({
      next: (posts) => {
        console.log('Post search results received:', posts);
        // Filter out reposted posts from search results
        this.posts = posts.filter(post => post.post_type !== 'repost');
        this.isLoading = false;
        this.isLoadingPosts = false;
      },
      error: (error) => {
        console.error('Error searching posts:', error);
        this.posts = [];
        this.isLoading = false;
        this.isLoadingPosts = false;
      }
    });
  }

  onPostReported(postId: number): void {
    // Remove the reported post from search results
    this.posts = this.posts.filter(post => post.id !== postId);
  }
} 