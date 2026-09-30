/**
 * Authentication and User Types
 */

export type UserRole = 'customer' | 'admin';
export type UserStatus = 'active' | 'disabled';
export type WaitlistChannel = 'whatsapp' | 'sms' | 'email';
export type WaitlistStatus = 'pending' | 'contacted' | 'notified' | 'unsubscribed';

export interface UserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

export interface WaitlistRecord {
  id: string;
  service_key: string;
  service_title: string;
  channel: WaitlistChannel;
  contact: string;
  contact_normalized: string;
  user_id: string | null;
  status: WaitlistStatus;
  source_page: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  contacted_at: string | null;
}

export interface AuthSessionResponse {
  user: SafeUserProfile;
  token: string;
  expiresAt: string;
}

export function toSafeUserProfile(user: UserRecord): SafeUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}
