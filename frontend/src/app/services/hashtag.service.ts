import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
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

  // Cache for trending hashtags
  private trendingCache: {
    hashtags: HashtagResult[];
    timestamp: number;
  } | null = null;

  constructor(private http: HttpClient) {}

  searchHashtags(query: string): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${this.apiUrl}/search_hashtags/`, {
      params: { q: query }
    });
  }

  getTrendingHashtags(timeframe?: TimeFrame, params?: any): Observable<TrendingResponse> {
    // Check if we have valid cached data and no cache-busting parameters
    if (!params?._t && this.isTrendingCacheValid()) {
      return of({
        results: this.trendingCache!.hashtags
      });
    }

    return this.http.get<TrendingResponse>(`${this.apiUrl}/trending_hashtags/`, { params }).pipe(
      tap(response => {
        // Cache the trending hashtags
        this.cacheTrendingHashtags(response.results);
      })
    );
  }

  calculateTrending(timeframe?: TimeFrame): Observable<TrendingResponse> {
    return this.http.post<TrendingResponse>(`${this.apiUrl}/calculate_trending/`, {});
  }

  /**
   * Cache trending hashtags data
   */
  private cacheTrendingHashtags(hashtags: HashtagResult[]): void {
    this.trendingCache = {
      hashtags: [...hashtags],
      timestamp: Date.now()
    };
  }

  /**
   * Check if trending cache is still valid (less than 10 minutes old)
   */
  private isTrendingCacheValid(): boolean {
    if (!this.trendingCache) return false;
    
    const cacheAge = Date.now() - this.trendingCache.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 minutes
    return cacheAge < maxAge;
  }

  /**
   * Clear trending hashtags cache
   */
  public clearTrendingCache(): void {
    this.trendingCache = null;
  }

  /**
   * Check if trending hashtags have cached content
   */
  public hasCachedTrending(): boolean {
    return this.isTrendingCacheValid();
  }
} 