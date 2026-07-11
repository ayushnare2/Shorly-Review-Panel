export interface Business {
  id: string;
  slug: string;
  name: string;
  logo_url?: string;
  business_type: string;
  google_review_link: string;
  owner_email: string;
  owner_whatsapp?: string;
  location?: string;
  services: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Feedback {
  id: string;
  business_id: string;
  rating: number;
  name?: string;
  phone?: string;
  feedback: string;
  category: 'service' | 'staff' | 'product' | 'cleanliness' | 'pricing' | 'other';
  created_at: string;
}

export interface ReviewLog {
  id: string;
  business_id: string;
  rating: number;
  review_type: 'ai' | 'direct';
  language?: string;
  created_at: string;
}

export interface AIGeneration {
  id: string;
  business_id: string;
  prompt: string;
  generated_text: string;
  style: 'short' | 'detailed' | 'professional' | 'friendly' | 'local';
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  created_at: string;
}
