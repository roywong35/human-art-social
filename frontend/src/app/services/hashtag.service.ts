import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HashtagResult {
  name: string;
  post_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class HashtagService {
  private apiUrl = `${environment.apiUrl}/api/posts`;

  constructor(private http: HttpClient) {}

  searchHashtags(query: string): Observable<{ results: HashtagResult[] }> {
    return this.http.get<{ results: HashtagResult[] }>(`${this.apiUrl}/search_hashtags/`, {
      params: { q: query }
    });
  }

  getTrendingHashtags(): Observable<{ results: HashtagResult[] }> {
    return this.http.get<{ results: HashtagResult[] }>(`${this.apiUrl}/trending_hashtags/`);
  }
} 