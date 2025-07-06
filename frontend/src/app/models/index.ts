import { User } from './user.model';

export interface Post {
  id: number;
  content: string;
  image?: string;
  author: User;
  created_at: string;
  updated_at: string;
  likes_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password2: string;
  handle: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user?: User;
}

export { User } from './user.model';
export { Message, Conversation, ConversationDetail, ChatMessage } from './chat.model'; 