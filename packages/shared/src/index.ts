// Shared domain types and interfaces for FoodRescue

export type UserRole = 'student' | 'org' | 'provider' | 'admin';
export type ProfileStatus = 'active' | 'suspended' | 'banned';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  status: ProfileStatus;
  created_at?: string;
}

export type FoodPostStatus = 'active' | 'fully_claimed' | 'expired' | 'removed_by_admin';
export type FoodCategory = 'Meals' | 'Produce' | 'Bakery' | 'Snacks' | 'Beverages' | 'Dairy' | 'Other';

export interface FoodPost {
  id: string;
  donor_id: string;
  food_name: string;
  description?: string | null;
  category: FoodCategory | string;
  quantity_total: number;
  quantity_remaining: number;
  photo_url?: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  expires_at: string;
  status: FoodPostStatus;
  created_at?: string;
}

export type ClaimStatus = 'pending' | 'accepted' | 'rejected' | 'picked_up' | 'cancelled';

export interface Claim {
  id: string;
  post_id: string;
  claimant_id: string;
  quantity_claimed: number;
  status: ClaimStatus;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
