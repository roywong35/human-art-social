import { User } from './user.model';

export interface PostImage {
  id: number;
  image: string;
  image_url?: string;
  order: number;
  created_at: string;
}

export interface EvidenceFile {
  id: number;
  file: string;
  file_type: string;
  created_at: string;
}

export interface Post {
  id: number;
  content: string;
  author: User;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  replies_count: number;
  reposts_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_reposted: boolean;
  is_liked_by_current_user?: boolean;
  is_bookmarked_by_current_user?: boolean;
  is_reposted_by_current_user?: boolean;
  post_type: 'post' | 'reply' | 'repost' | 'quote';
  referenced_post?: Post;
  parent_post?: Post;
  reposted_by?: User;
  image?: string;
  is_human_drawing: boolean;
  is_verified: boolean;
  media?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  images?: PostImage[];
  user_id: number;
  user?: {
    id: number;
    display_name: string;
    profile_picture?: string;
  };
  replies?: Post[];
  conversation_chain?: number[];
  reposted_by_current_user?: boolean;
  evidence_files: EvidenceFile[];
} 