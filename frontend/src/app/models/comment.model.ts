import { User } from './user.model';

export interface Comment {
  id: number;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  is_liked: boolean;
  is_reposted: boolean;
  is_bookmarked: boolean;
  parent_comment?: Comment;
  parent_comment_id?: number;
  replies?: Comment[];
  depth?: number;
  post_id: number;
  image?: string;
  media?: {
    url: string;
    type: 'image' | 'video';
  }[];
} 