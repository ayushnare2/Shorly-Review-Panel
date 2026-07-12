import { createClient, Session } from "@supabase/supabase-js";
import { Business, Feedback, ReviewLog, AIGeneration } from "../types";

// Read environment variables
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Detect if we have real Supabase keys configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Real Supabase Client (only instantiated if keys exist, prevents crashes)
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// CLIENT-SIDE LOCAL STORAGE FALLBACK ENGINE
// ==========================================
// Seed initial demo data for local simulation if localStorage is empty
const SEED_BUSINESSES: Business[] = [
  {
    id: "royal-cafe-uuid-1111",
    slug: "royal-cafe",
    name: "The Royal Cafe & Bistro",
    logo_url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=150&h=150&fit=crop&q=80",
    business_type: "Restaurant / Cafe",
    google_review_link: "https://g.page/r/example-royal-cafe/review",
    owner_email: "owner.royalcafe@example.com",
    owner_whatsapp: "+919876543210",
    location: "Bandra West, Mumbai",
    services: ["Specialty Coffee", "Woodfired Pizzas", "Artisanal Desserts", "Continental Breakfast"]
  },
  {
    id: "abc-salon-uuid-2222",
    slug: "abc-salon",
    name: "ABC Hair & Beauty Salon",
    logo_url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&q=80",
    business_type: "Beauty & Wellness Salon",
    google_review_link: "https://g.page/r/example-abc-salon/review",
    owner_email: "owner.abcsalon@example.com",
    owner_whatsapp: "+919876543211",
    location: "Jubilee Hills, Hyderabad",
    services: ["Hair Styling", "Balayage & Coloring", "Luxury Facials", "Bridal Makeover", "Nail Art"]
  },
  {
    id: "fitzone-gym-uuid-3333",
    slug: "fitzone-gym",
    name: "FitZone Premium Gym",
    logo_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&h=150&fit=crop&q=80",
    business_type: "Gym & Fitness Center",
    google_review_link: "https://g.page/r/example-fitzone-gym/review",
    owner_email: "owner.fitzone@example.com",
    owner_whatsapp: "+919876543212",
    location: "Koramangala, Bangalore",
    services: ["Personal Training", "Group HIIT", "Strength & Conditioning", "Yoga Sessions"]
  }
];

// Helper to initialize Local Storage
const initLocalStorage = () => {
  if (!localStorage.getItem("shorly_businesses")) {
    localStorage.setItem("shorly_businesses", JSON.stringify(SEED_BUSINESSES));
  }
  if (!localStorage.getItem("shorly_feedback")) {
    localStorage.setItem("shorly_feedback", JSON.stringify([]));
  }
  if (!localStorage.getItem("shorly_review_logs")) {
    localStorage.setItem("shorly_review_logs", JSON.stringify([]));
  }
  if (!localStorage.getItem("shorly_ai_generations")) {
    localStorage.setItem("shorly_ai_generations", JSON.stringify([]));
  }
};

initLocalStorage();

// ==========================================
// EXPOSED API FUNCTIONS (REAL OR FALLBACK)
// ==========================================

export const api = {
  
  // =============================
// BUSINESS OPERATIONS
// =============================

async getBusinesses(): Promise<Business[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return data || [];
  }

  const bStr = localStorage.getItem("shorly_businesses");
  return bStr ? JSON.parse(bStr) : [];
},

async getBusinessBySlug(slug: string): Promise<Business | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    return data;
  }

  const businesses = await this.getBusinesses();
  return businesses.find(
    (b) => b.slug.toLowerCase() === slug.toLowerCase()
  ) || null;
},

async createBusiness(business: Omit<Business, "id">): Promise<Business> {

  if (isSupabaseConfigured && supabase) {

    const { data, error } = await supabase
      .from("businesses")
      .insert([
        {
          slug: business.slug,
          name: business.name,
          logo_url: business.logo_url,
          business_type: business.business_type,
          google_review_link: business.google_review_link,
          owner_email: business.owner_email,
          owner_whatsapp: business.owner_whatsapp,
          location: business.location,
          services: business.services,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return data as Business;
  }

  // Local fallback

  const newBusiness: Business = {
    ...business,
    id: `local-biz-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Business;

  const businesses = await this.getBusinesses();

  businesses.push(newBusiness);

  localStorage.setItem(
    "shorly_businesses",
    JSON.stringify(businesses)
  );

  return newBusiness;
},

async updateBusiness(
  id: string,
  updates: Partial<Business>
): Promise<Business> {

  if (isSupabaseConfigured && supabase) {

    const { data, error } = await supabase
      .from("businesses")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data as Business;
  }

  const businesses = await this.getBusinesses();

  const index = businesses.findIndex((b) => b.id === id);

  if (index === -1) {
    throw new Error("Business not found");
  }

  const updated = {
    ...businesses[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  businesses[index] = updated;

  localStorage.setItem(
    "shorly_businesses",
    JSON.stringify(businesses)
  );

  return updated as Business;
},

async deleteBusiness(id: string): Promise<boolean> {

  if (isSupabaseConfigured && supabase) {

    const { error } = await supabase
      .from("businesses")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  }

  const businesses = await this.getBusinesses();

  const filtered = businesses.filter(
    (b) => b.id !== id
  );

  localStorage.setItem(
    "shorly_businesses",
    JSON.stringify(filtered)
  );

  return true;
},

  // Generate a guaranteed unique slug for a business
  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "-");
    
    let slug = baseSlug;
    let count = 1;
    let exists = true;

    while (exists) {
      const biz = await this.getBusinessBySlug(slug);
      if (!biz) {
        exists = false;
      } else {
        slug = `${baseSlug}-${count}`;
        count++;
      }
    }
    return slug;
  },

  // --- PRIVATE FEEDBACK OPERATIONS ---

  async submitFeedback(feedback: Omit<Feedback, "id" | "created_at">): Promise<Feedback> {

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("feedback")
      .insert([
        {
          business_id: feedback.business_id,
          rating: feedback.rating,
          name: feedback.name,
          phone: feedback.phone,
          feedback: feedback.feedback,
          category: feedback.category
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return data as Feedback;
  }

  const newFeedback: Feedback = {
    ...feedback,
    id: `local-feedback-${Date.now()}`,
    created_at: new Date().toISOString()
  } as Feedback;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("feedback")
        .insert([newFeedback])
        .select()
        .single();
      if (error) throw error;
      
      // Call secure proxy endpoint to trigger email alerts in background
      try {
        const biz = await this.getBusinessBySlug(feedback.business_id);
        if (biz) {
          fetch("/api/send-feedback-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessName: biz.name,
              rating: feedback.rating,
              feedbackText: feedback.feedback,
              category: feedback.category,
              customerName: feedback.name || "Anonymous",
              customerPhone: feedback.phone || "Not provided",
              ownerEmail: biz.owner_email
            })
          }).catch(err => console.error("Error triggering email alert:", err));
        }
      } catch (e) {
        console.error("Email notify fail:", e);
      }

      return data;
    } else {
      const feedbacksStr = localStorage.getItem("shorly_feedback");
      const feedbacks: Feedback[] = feedbacksStr ? JSON.parse(feedbacksStr) : [];
      feedbacks.push(newFeedback);
      localStorage.setItem("shorly_feedback", JSON.stringify(feedbacks));

      // Trigger server-side simulated email alert for developers to inspect logs
      try {
        const businesses = await this.getBusinesses();
        const biz = businesses.find(b => b.id === feedback.business_id);
        if (biz) {
          fetch("/api/send-feedback-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessName: biz.name,
              rating: feedback.rating,
              feedbackText: feedback.feedback,
              category: feedback.category,
              customerName: feedback.name || "Anonymous",
              customerPhone: feedback.phone || "Not provided",
              ownerEmail: biz.owner_email,
              previewMode: true
            })
          }).catch(err => console.error("Simulated email trigger fail:", err));
        }
      } catch (e) {
        console.error("Simulated email notify fail:", e);
      }

      return newFeedback;
    }
  },

  async getFeedback(businessId?: string): Promise<Feedback[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("feedback").select("*");
      if (businessId) {
        query = query.eq("business_id", businessId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const feedbacksStr = localStorage.getItem("shorly_feedback");
      const feedbacks: Feedback[] = feedbacksStr ? JSON.parse(feedbacksStr) : [];
      if (businessId) {
        return feedbacks.filter(f => f.business_id === businessId).reverse();
      }
      return feedbacks.reverse();
    }
  },

  // --- REVIEW CONVERSION LOGGING ---

async logReview(log: Omit<ReviewLog, "id" | "created_at">): Promise<ReviewLog> {

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("review_logs")
      .insert([
        {
          business_id: log.business_id,
          rating: log.rating,
          review_type: log.review_type,
          language: log.language
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return data as ReviewLog;
  }

  const newLog: ReviewLog = {
    ...log,
    id: `local-log-${Date.now()}`,
    created_at: new Date().toISOString()
  } as ReviewLog;

  const logsStr = localStorage.getItem("shorly_review_logs");
  const logs: ReviewLog[] = logsStr ? JSON.parse(logsStr) : [];
  logs.push(newLog);
  localStorage.setItem("shorly_review_logs", JSON.stringify(logs));

  return newLog;
},
  
  async getReviewLogs(businessId?: string): Promise<ReviewLog[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("review_logs").select("*");
      if (businessId) {
        query = query.eq("business_id", businessId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const logsStr = localStorage.getItem("shorly_review_logs");
      const logs: ReviewLog[] = logsStr ? JSON.parse(logsStr) : [];
      if (businessId) {
        return logs.filter(l => l.business_id === businessId).reverse();
      }
      return logs.reverse();
    }
  },

  // --- AI GENERATION AUDITING ---

 async logAIGeneration(gen: Omit<AIGeneration, "id" | "created_at">): Promise<AIGeneration> {

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("ai_generations")
      .insert([
        {
          business_id: gen.business_id,
          prompt: gen.prompt,
          generated_text: gen.generated_text,
          style: gen.style
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return data as AIGeneration;
  }

  const newGen: AIGeneration = {
    ...gen,
    id: `local-gen-${Date.now()}`,
    created_at: new Date().toISOString()
  } as AIGeneration;

  const gensStr = localStorage.getItem("shorly_ai_generations");
  const gens: AIGeneration[] = gensStr ? JSON.parse(gensStr) : [];
  gens.push(newGen);
  localStorage.setItem("shorly_ai_generations", JSON.stringify(gens));

  return newGen;
},

  async getAIGenerations(businessId?: string): Promise<AIGeneration[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("ai_generations").select("*");
      if (businessId) {
        query = query.eq("business_id", businessId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const gensStr = localStorage.getItem("shorly_ai_generations");
      const gens: AIGeneration[] = gensStr ? JSON.parse(gensStr) : [];
      if (businessId) {
        return gens.filter(g => g.business_id === businessId).reverse();
      }
      return gens.reverse();
    }
  }
};

// ==========================================
// ADMIN AUTHENTICATION (Supabase Auth only)
// ==========================================
// Reuses the same `supabase` client above. No new client, no profile/role
// tables — admin accounts are created manually in the Supabase Dashboard
// under Authentication > Users, and public signups should stay disabled there.

export const auth = {
  async signIn(email: string, password: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    if (!isSupabaseConfigured || !supabase) {
      // Return a no-op subscription so callers can always call .unsubscribe()
      // without checking whether Supabase is configured.
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }
};