-- Shorly Smart Review Funnel - Supabase PostgreSQL Schema
-- Premium, Scalable, Production-Ready Setup

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. BUSINESSES TABLE
create table if nulls not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  logo_url text,
  business_type text not null, -- e.g. restaurant, salon, gym, cafe, hotel, clinic, retail, service
  google_review_link text not null,
  owner_email text not null,
  owner_whatsapp text,
  location text,
  services text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for businesses
alter table public.businesses enable row level security;

-- Policies for public.businesses:
-- Anyone can view business details (needed for customer-facing /business/:slug page)
create policy "Allow public read access to businesses"
  on public.businesses for select
  using (true);

-- Authenticated admins can manage businesses (insert, update, delete)
create policy "Allow admin write access to businesses"
  on public.businesses for all
  using (auth.role() = 'authenticated');


-- 2. PRIVATE FEEDBACK TABLE
create table if nulls not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  name text,
  phone text,
  feedback text not null,
  category text not null check (category in ('service', 'staff', 'product', 'cleanliness', 'pricing', 'other')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for public.feedback
alter table public.feedback enable row level security;

-- Policies for public.feedback:
-- Customers can submit feedback (insert) without auth
create policy "Allow public inserts to feedback"
  on public.feedback for insert
  with check (true);

-- Only authenticated business owners / admins can view feedbacks
create policy "Allow admin read access to feedback"
  on public.feedback for select
  using (auth.role() = 'authenticated');


-- 3. REVIEW LOGS TABLE (For tracking direct clicks vs AI-generated, conversion tracking)
create table if nulls not exists public.review_logs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_type text not null check (review_type in ('ai', 'direct')),
  language text, -- e.g. en, hi, mr, hinglish
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for review_logs
alter table public.review_logs enable row level security;

-- Anyone can insert conversion logs
create policy "Allow public inserts to review_logs"
  on public.review_logs for insert
  with check (true);

-- Only authenticated admins can view review logs
create policy "Allow admin select review_logs"
  on public.review_logs for select
  using (auth.role() = 'authenticated');


-- 4. AI GENERATIONS TABLE (For auditing generated content, feedback fine-tuning)
create table if nulls not exists public.ai_generations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  prompt text not null,
  generated_text text not null,
  style text not null check (style in ('short', 'detailed', 'professional', 'friendly', 'local')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for ai_generations
alter table public.ai_generations enable row level security;

-- Anyone can log AI generations (triggered from secure edge API)
create policy "Allow public inserts to ai_generations"
  on public.ai_generations for insert
  with check (true);

-- Only admins can select
create policy "Allow admin select ai_generations"
  on public.ai_generations for select
  using (auth.role() = 'authenticated');


-- 5. AUDIT LOGS TABLE
create table if nulls not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for audit_logs
alter table public.audit_logs enable row level security;

-- Only authenticated admin can view or write audit logs
create policy "Allow admin full access to audit_logs"
  on public.audit_logs for all
  using (auth.role() = 'authenticated');


-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
create index idx_businesses_slug on public.businesses(slug);
create index idx_feedback_business_rating on public.feedback(business_id, rating);
create index idx_review_logs_business on public.review_logs(business_id);
create index idx_ai_generations_business on public.ai_generations(business_id);

-- AUTOMATIC UPDATED_AT TRIGGER FOR BUSINESSES
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_businesses_updated_at
  before update on public.businesses
  for each row
  execute function public.handle_updated_at();


-- SEED INITIAL PREMIUM DEMO DATA
insert into public.businesses (slug, name, logo_url, business_type, google_review_link, owner_email, owner_whatsapp, location, services)
values 
  (
    'royal-cafe', 
    'The Royal Cafe & Bistro', 
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=150&h=150&fit=crop&q=80', 
    'restaurant', 
    'https://g.page/r/example-royal-cafe/review', 
    'owner.royalcafe@example.com', 
    '+919876543210', 
    'Bandra West, Mumbai', 
    array['Specialty Coffee', 'Woodfired Pizzas', 'Artisanal Desserts', 'Continental Breakfast']
  ),
  (
    'abc-salon', 
    'ABC Hair & Beauty Salon', 
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&q=80', 
    'salon', 
    'https://g.page/r/example-abc-salon/review', 
    'owner.abcsalon@example.com', 
    '+919876543211', 
    'Jubilee Hills, Hyderabad', 
    array['Hair Styling', 'Balayage & Coloring', 'Luxury Facials', 'Bridal Makeover', 'Nail Art']
  ),
  (
    'fitzone-gym', 
    'FitZone Premium Gym', 
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&h=150&fit=crop&q=80', 
    'gym', 
    'https://g.page/r/example-fitzone-gym/review', 
    'owner.fitzone@example.com', 
    '+919876543212', 
    'Koramangala, Bangalore', 
    array['Personal Training', 'Group HIIT', 'Strength & Conditioning', 'Yoga Sessions']
  );
