import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HashtagResult {
  name: string;
  post_count: number;
}

export interface TrendingResponse {
  results: HashtagResult[];
}

export type TimeFrame = 'hour' | 'day';

@Injectable({
  providedIn: 'root'
})
export class HashtagService {
  private apiUrl = `${environment.apiUrl}/api/posts`;

  constructor(private http: HttpClient) {}

  searchHashtags(query: string): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${this.apiUrl}/search_hashtags/`, {
      params: { q: query }
    });
  }

  getTrendingHashtags(timeframe: TimeFrame = 'hour'): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${this.apiUrl}/trending_hashtags/`, {
      params: { timeframe }
    });
  }

  calculateTrending(timeframe: TimeFrame = 'hour'): Observable<TrendingResponse> {
    return this.http.post<TrendingResponse>(`${this.apiUrl}/calculate_trending/`, {
      timeframe
    });
  }
} 