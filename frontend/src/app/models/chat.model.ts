import { User } from './user.model';

export interface Message {
  id: number;
  content: string;
  image?: string;
  image_url?: string;
  sender: User;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  id: number;
  participants: User[];
  other_participant: User;
  last_message: Message | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ConversationDetail {
  id: number;
  participants: User[];
  other_participant: User;
  messages: Message[];
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ChatMessage {
  type: 'chat_message' | 'typing_indicator';
  message?: Message;
  user_id?: number;
  username?: string;
  is_typing?: boolean;
} 