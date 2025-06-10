import { User } from './user.model';

export interface Post {
  id: number;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_reposted: boolean;
  post_type: 'normal' | 'repost';
  referenced_post?: Post;
  reposted_by?: User;
  image?: string;
  is_human_drawing: boolean;
  is_verified: boolean;
  media?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
} 