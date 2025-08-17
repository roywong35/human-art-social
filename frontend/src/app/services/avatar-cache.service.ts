import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AvatarCacheService {
  private avatarCache = new Map<string, string>();
  private defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MyLjY3IDAgNC44NCAyLjE3IDQuODQgNC44NFMxNC42NyAxNC42OCAxMiAxNC42OHMtNC44NC0yLjE3LTQuODQtNC44NFM5LjMzIDUgMTIgNXptMCAxM2MtMi4yMSAwLTQuMi45NS01LjU4IDIuNDhDNy42MyAxOS4yIDkuNzEgMjAgMTIgMjBzNC4zNy0uOCA1LjU4LTIuNTJDMTYuMiAxOC45NSAxNC4yMSAxOCAxMiAxOHoiLz48L3N2Zz4=';

  constructor() {}

  // Get avatar URL - returns cached version if available, otherwise returns default
  getAvatarUrl(userId: number, profilePicture?: string): string {
    if (!profilePicture) {
      return this.defaultAvatar;
    }

    const cacheKey = `${userId}_${profilePicture}`;
    
    // Return cached avatar if available
    if (this.avatarCache.has(cacheKey)) {
      return this.avatarCache.get(cacheKey)!;
    }

    // Cache the new avatar and return it
    this.avatarCache.set(cacheKey, profilePicture);
    return profilePicture;
  }

  // Preload avatars for a list of users (useful for chat rooms)
  preloadAvatars(users: Array<{id: number, profile_picture?: string}>): void {
    users.forEach(user => {
      if (user.profile_picture) {
        this.getAvatarUrl(user.id, user.profile_picture);
      }
    });
  }

  // Clear cache (useful for memory management)
  clearCache(): void {
    this.avatarCache.clear();
  }

  // Get cache size (for debugging)
  getCacheSize(): number {
    return this.avatarCache.size;
  }

  // Get default avatar
  getDefaultAvatar(): string {
    return this.defaultAvatar;
  }
}
