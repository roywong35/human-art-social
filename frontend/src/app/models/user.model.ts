export interface User {
  id: number;
  username: string;
  handle: string;
  display_name: string;
  email: string;
  profile_picture?: string;
  banner_image?: string;
  bio?: string;
  location?: string;
  website?: string;
  created_at: string;
  date_joined: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following?: boolean;
  is_verified?: boolean;
  is_private?: boolean;
  is_staff?: boolean;
} 