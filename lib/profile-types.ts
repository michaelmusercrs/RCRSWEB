/**
 * Profile Types for Sales Rep Bio Management
 * Types for profile data, reviews, and images
 */

export interface ProfileImage {
  id: string;
  type: 'profile' | 'truck' | 'job-before' | 'job-after' | 'video';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  uploadedAt: string;
  uploadedBy: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ProfileReview {
  id: string;
  repSlug: string;
  customerName: string;
  rating: number; // 1-5 stars
  text: string;
  source: 'google' | 'facebook' | 'yelp' | 'bbb' | 'direct' | 'other';
  date: string;
  visible: boolean; // Rep can toggle visibility
  featured: boolean; // Show prominently
  createdAt: string;
  createdBy: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SocialMediaLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  x?: string;
  linkedin?: string;
  youtube?: string;
}

export interface ContactPreferences {
  preferredContact: 'phone' | 'email' | 'text' | 'any';
  showPhone: boolean;
  showEmail: boolean;
  availableHours?: string;
}

export interface ProfileUpdate {
  slug: string;
  bio?: string;
  tagline?: string;
  keyStrengths?: string[];
  responsibilities?: string[];
  socialMedia?: SocialMediaLinks;
  contactPreferences?: ContactPreferences;
  profileImageUrl?: string;
  truckImageUrl?: string;
  pendingChanges: boolean;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface PendingProfileChange {
  id: string;
  repSlug: string;
  repName: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  comment?: string;
}

export interface RepProfileData {
  slug: string;
  name: string;
  position: string;
  category: string;
  email: string;
  phone: string;
  bio: string;
  tagline?: string;
  region?: string;
  profileImage?: string;
  truckImage?: string;
  socialMedia: SocialMediaLinks;
  contactPreferences: ContactPreferences;
  keyStrengths: string[];
  responsibilities: string[];
  reviews: ProfileReview[];
  images: ProfileImage[];
  pendingUpdate?: ProfileUpdate;
}

// Default contact preferences
export const DEFAULT_CONTACT_PREFERENCES: ContactPreferences = {
  preferredContact: 'any',
  showPhone: true,
  showEmail: true,
};

// Review sources
export const REVIEW_SOURCES = [
  { value: 'google', label: 'Google' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'direct', label: 'Direct Feedback' },
  { value: 'other', label: 'Other' },
] as const;

// Image type labels
export const IMAGE_TYPE_LABELS: Record<ProfileImage['type'], string> = {
  'profile': 'Profile Photo',
  'truck': 'Truck Photo',
  'job-before': 'Job Before',
  'job-after': 'Job After',
  'video': 'Video',
};
