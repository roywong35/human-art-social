export interface Donation {
  id: number;
  donor: {
    id: number;
    username: string;
    handle: string;
    profile_picture?: string;
  };
  artist: {
    id: number;
    username: string;
    handle: string;
  };
  post: number;
  amount: number;
  message?: string;
  is_public: boolean;
  created_at: string;
}

export interface CreateDonationRequest {
  post: number;
  amount: number;
  message?: string;
  is_public: boolean;
}