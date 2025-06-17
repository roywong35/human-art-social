import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PostService } from '../../services/post.service';
import { Post } from '../../models/post.model';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { PostComponent } from '../shared/post/post.component';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService
  ) {}

  ngOnInit() {
    // Subscribe to query parameter changes
    this.route.queryParams.subscribe(params => {
      const query = params['q'] || '';
      this.searchQuery = query;
      this.isHashtagSearch = query.startsWith('#');
      
      if (query) {
        this.searchPosts(query);
      } else {
        this.posts = [];
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  private searchPosts(query: string) {
    this.isLoading = true;
    this.posts = [];

    // If it's a hashtag search, remove the # symbol
    const searchTerm = this.isHashtagSearch ? query.substring(1) : query;

    this.postService.searchPosts(searchTerm).subscribe({
      next: (posts) => {
        this.posts = posts;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error searching posts:', error);
        this.isLoading = false;
      }
    });
  }
} 