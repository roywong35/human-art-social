import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Post } from '../../../models/post.model';
import { PostService } from '../../../services/post.service';
import { PostComponent } from '../../features/posts/post/post.component';
import { SearchBarComponent } from '../../widgets/search-bar/search-bar.component';

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
  isLoading: boolean = false;
  isHashtagSearch: boolean = false;
  hasSearched: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService
  ) {}

  ngOnInit() {
    // Subscribe to query parameter changes
    this.route.queryParams.subscribe(params => {
      const query = params['q'] || '';
      this.searchQuery = query.trim();
      this.isHashtagSearch = this.searchQuery.startsWith('#');
      
      if (this.searchQuery) {
        this.hasSearched = true;
        this.searchPosts(this.searchQuery);
      } else {
        this.posts = [];
        this.hasSearched = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  trackByPostId(index: number, post: Post): number {
    return post.id;
  }

  private searchPosts(query: string) {
    if (!query.trim()) {
      this.posts = [];
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.posts = [];

    // If it's a hashtag search, remove the # symbol for the API call
    const searchTerm = this.isHashtagSearch ? query.substring(1) : query;

    console.log('Searching for:', searchTerm, 'Original query:', query, 'Is hashtag:', this.isHashtagSearch);

    this.postService.searchPosts(searchTerm).subscribe({
      next: (posts) => {
        console.log('Search results received:', posts);
        this.posts = posts;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error searching posts:', error);
        this.posts = [];
        this.isLoading = false;
      }
    });
  }
} 