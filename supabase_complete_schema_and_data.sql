-- ==========================================
-- BURNING PIXEL COMPLETE DATABASE SETUP (IDEMPOTENT)
-- Generated: 2026-06-28T05:47:04.804Z
-- ==========================================

-- MIGRATION: 20251224141559_1876b551-3e8d-43a0-9575-1ea3a57785fc.sql
------------------------------------------
-- Create pricing_packages table to store all pricing data
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT '/project',
  description TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_popular BOOLEAN NOT NULL DEFAULT false,
  discount_percentage NUMERIC DEFAULT 0,
  discount_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Allow public read access for pricing display
CREATE POLICY "Anyone can view pricing packages" 
ON public.pricing_packages 
FOR SELECT 
USING (true);

-- Insert default pricing data
INSERT INTO public.pricing_packages (name, price, period, description, features, is_popular, sort_order) VALUES
('Basic', 1500000, '/project', 'Cocok untuk bisnis kecil yang baru mulai', ARRAY['1 Halaman', 'Desain Responsif', 'Hosting 1 Tahun', 'Domain .com', 'SSL Gratis', 'Revisi 2x'], false, 1),
('Professional', 3500000, '/project', 'Ideal untuk bisnis yang ingin berkembang', ARRAY['5 Halaman', 'Desain Premium', 'Hosting 1 Tahun', 'Domain .com', 'SSL Gratis', 'SEO Basic', 'Revisi 5x', 'WhatsApp Integration'], true, 2),
('Enterprise', 7500000, '/project', 'Solusi lengkap untuk bisnis besar', ARRAY['Unlimited Halaman', 'Desain Custom', 'Hosting 2 Tahun', 'Domain .com', 'SSL Gratis', 'SEO Advanced', 'Revisi Unlimited', 'Admin Dashboard', 'Maintenance 6 Bulan'], false, 3);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_pricing_packages_updated_at ON public.pricing_packages;
CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON public.pricing_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- MIGRATION: 20251224141857_ef58d175-aa7d-4117-b20a-231a11cb6101.sql
------------------------------------------
-- Add update and delete policies for pricing_packages (admin operations via edge function)
-- Since we're using password protection, we allow all operations but rely on edge function for auth
CREATE POLICY "Allow all operations for pricing packages"
ON public.pricing_packages
FOR ALL
USING (true)
WITH CHECK (true);

-- MIGRATION: 20251224142259_e3e514be-c74b-4f0e-af2f-678ff136287b.sql
------------------------------------------
-- Create storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true);

-- Create portfolio_items table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view portfolio items" 
ON public.portfolio_items 
FOR SELECT 
USING (is_visible = true);

-- Allow all operations (admin via password protection)
CREATE POLICY "Allow all operations for portfolio items"
ON public.portfolio_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Storage policies for portfolio bucket
CREATE POLICY "Anyone can view portfolio images"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Allow upload to portfolio bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio');

CREATE POLICY "Allow update portfolio images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio');

CREATE POLICY "Allow delete portfolio images"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio');

-- Insert default portfolio data
INSERT INTO public.portfolio_items (title, category, description, image_url, link_url, sort_order) VALUES
('Tech Startup Website', 'Landing Page', 'Modern landing page for a tech startup', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop', NULL, 1),
('Fashion E-Commerce', 'Toko Online', 'Full-featured online store for fashion brand', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop', NULL, 2),
('Corporate Company', 'Company Profile', 'Professional company profile website', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop', NULL, 3),
('Restaurant Website', 'Landing Page', 'Elegant restaurant website with menu', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop', NULL, 4),
('Real Estate Platform', 'Toko Online', 'Property listing platform', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop', NULL, 5),
('Digital Agency', 'Company Profile', 'Creative agency portfolio website', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop', NULL, 6);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- MIGRATION: 20251225233652_2076273e-b2c0-450a-971d-b714331d3113.sql
------------------------------------------
-- Create app role enum
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END;
$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MIGRATION: 20251225234655_287a0a28-696f-4e0a-9dc3-22978b42760f.sql
------------------------------------------
-- Create invitations table to track sent invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role app_role NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email, status)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can view invitations
CREATE POLICY "Admins can view all invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can create invitations
CREATE POLICY "Admins can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update invitations
CREATE POLICY "Admins can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- MIGRATION: 20251226001439_7dc58946-0a7a-40cb-a0ab-f6369912153a.sql
------------------------------------------
-- Create activity_logs table to track user actions
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role to insert logs (for edge functions)
CREATE POLICY "Service role can insert logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

-- MIGRATION: 20251230065901_cdb0e4d1-69a6-4164-a253-fa134410177e.sql
------------------------------------------
-- Fix 1: Remove overly permissive portfolio_items policy and add admin-only modifications
DROP POLICY IF EXISTS "Allow all operations for portfolio items" ON public.portfolio_items;

CREATE POLICY "Admins can insert portfolio items" 
ON public.portfolio_items 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update portfolio items" 
ON public.portfolio_items 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete portfolio items" 
ON public.portfolio_items 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Remove overly permissive pricing_packages policy and add admin-only modifications
DROP POLICY IF EXISTS "Allow all operations for pricing packages" ON public.pricing_packages;

CREATE POLICY "Admins can insert pricing packages" 
ON public.pricing_packages 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing packages" 
ON public.pricing_packages 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing packages" 
ON public.pricing_packages 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Replace overly permissive storage policies with admin-only access
DROP POLICY IF EXISTS "Allow upload to portfolio bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update portfolio images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete portfolio images" ON storage.objects;

CREATE POLICY "Admins can upload portfolio images" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update portfolio images" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'portfolio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete portfolio images" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'portfolio' AND has_role(auth.uid(), 'admin'::app_role));

-- MIGRATION: 20260102040514_2c00de9a-5933-47c4-9539-f7d08d8da261.sql
------------------------------------------
-- Fix profiles table RLS policy - users can only see their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix activity_logs INSERT policy - restrict to service_role only
DROP POLICY IF EXISTS "Service role can insert logs" ON public.activity_logs;

CREATE POLICY "Service role can insert logs"
ON public.activity_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Create persistent rate limiting table for admin password verification
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  failed_attempts INT DEFAULT 0,
  first_attempt TIMESTAMPTZ DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ip_address)
);

-- Enable RLS on rate_limits (only service_role should access)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_rate_limits_updated_at
BEFORE UPDATE ON public.rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip_address TEXT,
  p_max_attempts INT DEFAULT 5,
  p_lockout_minutes INT DEFAULT 15
)
RETURNS TABLE (
  is_limited BOOLEAN,
  retry_after_seconds INT,
  attempts_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_record FROM rate_limits WHERE ip_address = p_ip_address;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, p_max_attempts;
    RETURN;
  END IF;
  
  -- Check if locked
  IF v_record.locked_until IS NOT NULL AND v_now < v_record.locked_until THEN
    RETURN QUERY SELECT 
      true, 
      EXTRACT(EPOCH FROM (v_record.locked_until - v_now))::INT,
      0;
    RETURN;
  END IF;
  
  -- Clear if lockout expired
  IF v_record.locked_until IS NOT NULL AND v_now >= v_record.locked_until THEN
    DELETE FROM rate_limits WHERE ip_address = p_ip_address;
    RETURN QUERY SELECT false, 0, p_max_attempts;
    RETURN;
  END IF;
  
  -- Check if window expired (reset after lockout duration)
  IF v_now - v_record.first_attempt > (p_lockout_minutes || ' minutes')::INTERVAL THEN
    DELETE FROM rate_limits WHERE ip_address = p_ip_address;
    RETURN QUERY SELECT false, 0, p_max_attempts;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT false, 0, GREATEST(0, p_max_attempts - v_record.failed_attempts);
END;
$$;

-- Function to record failed attempt
CREATE OR REPLACE FUNCTION public.record_failed_attempt(
  p_ip_address TEXT,
  p_max_attempts INT DEFAULT 5,
  p_lockout_minutes INT DEFAULT 15
)
RETURNS TABLE (
  is_locked BOOLEAN,
  attempts_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_new_count INT;
BEGIN
  SELECT * INTO v_record FROM rate_limits WHERE ip_address = p_ip_address FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO rate_limits (ip_address, failed_attempts, first_attempt)
    VALUES (p_ip_address, 1, v_now);
    RETURN QUERY SELECT false, p_max_attempts - 1;
    RETURN;
  END IF;
  
  -- Check if window expired
  IF v_now - v_record.first_attempt > (p_lockout_minutes || ' minutes')::INTERVAL THEN
    UPDATE rate_limits 
    SET failed_attempts = 1, first_attempt = v_now, locked_until = NULL, updated_at = v_now
    WHERE ip_address = p_ip_address;
    RETURN QUERY SELECT false, p_max_attempts - 1;
    RETURN;
  END IF;
  
  v_new_count := v_record.failed_attempts + 1;
  
  IF v_new_count >= p_max_attempts THEN
    UPDATE rate_limits 
    SET failed_attempts = v_new_count, 
        locked_until = v_now + (p_lockout_minutes || ' minutes')::INTERVAL,
        updated_at = v_now
    WHERE ip_address = p_ip_address;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;
  
  UPDATE rate_limits 
  SET failed_attempts = v_new_count, updated_at = v_now
  WHERE ip_address = p_ip_address;
  
  RETURN QUERY SELECT false, p_max_attempts - v_new_count;
END;
$$;

-- Function to clear attempts on success
CREATE OR REPLACE FUNCTION public.clear_rate_limit(p_ip_address TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits WHERE ip_address = p_ip_address;
END;
$$;

-- MIGRATION: 20260109074700_46ca1847-e109-4a7a-8c8a-4ae3519e4f7a.sql
------------------------------------------
-- Create orders table for tracking payments
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  package_id UUID REFERENCES public.pricing_packages(id),
  package_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  xendit_invoice_id TEXT,
  xendit_invoice_url TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
USING (user_id = auth.uid() OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update orders"
ON public.orders
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_xendit_invoice_id ON public.orders(xendit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- MIGRATION: 20260111080811_37edfc53-4b34-4f1b-b564-7fb7fad37b04.sql
------------------------------------------
-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Create PERMISSIVE SELECT policies (so they work as OR)
CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- MIGRATION: 20260206113112_42b34479-646f-453d-8791-c4a861502bdb.sql
------------------------------------------
-- SECURITY FIX: Require authentication for order creation
-- This prevents anonymous order spam and email enumeration attacks

-- Drop the insecure anonymous order creation policy
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Create a secure policy requiring authentication
-- Users can only create orders for themselves (user_id must match auth.uid())
CREATE POLICY "Authenticated users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Drop the email-based SELECT policy that enables enumeration
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Create a more secure SELECT policy based on user_id only
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- MIGRATION: 20260215120142_2c526d70-a42f-4fd1-bc2c-694c2874df41.sql
------------------------------------------
-- Block anonymous access to orders table
CREATE POLICY "Block anonymous access to orders"
ON public.orders
FOR SELECT
TO anon
USING (false);


-- MIGRATION: 20260628114000_admin_features.sql
------------------------------------------
-- Add role column to profiles if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END;
$$;

-- Create policies for admin managing profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Modify handle_new_user to make yuanaditya94@gmail.com an admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := 'user';
BEGIN
  IF new.email = 'yuanaditya94@gmail.com' THEN
    v_role := 'admin';
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', v_role)
  ON CONFLICT (user_id) DO UPDATE 
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = v_role;

  -- Insert into user_roles if table exists and user is admin
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, v_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Promote yuanaditya94@gmail.com if they are already registered
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yuanaditya94@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Ensure they have a profile
    INSERT INTO public.profiles (user_id, email, role)
    VALUES (v_user_id, 'yuanaditya94@gmail.com', 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    -- Ensure they have the admin role in user_roles
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END;
$$;


-- MIGRATION: 20260628124000_add_package_category.sql
------------------------------------------
-- Alter table pricing_packages to add category column
ALTER TABLE public.pricing_packages ADD COLUMN IF NOT EXISTS category TEXT;

-- Clear old default pricing packages
DELETE FROM public.pricing_packages;

-- Insert the 12 default packages with category column
INSERT INTO public.pricing_packages (id, name, category, price, period, description, features, is_popular, discount_percentage, discount_label, sort_order) VALUES
('2743cc35-4f90-4730-810c-dacacf0103a8', 'Landing Page - Starter', 'Landing Page', 1500000, '/project', 'Cocok untuk bisnis UMKM baru yang ingin langsung tampil online dengan landing page elegan.', ARRAY['Free Domain .com (1 Tahun)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '1 GB Disk Storage', 'Free SSL', '1x Revisi Gratis', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 1),
('88344df3-69a8-4d8d-b863-8f405ead5510', 'Landing Page - Growth', 'Landing Page', 2750000, '/project', 'Buat kamu yang pengen tampil lebih profesional dan punya kontrol lebih atas fitur & brand.', ARRAY['Semua fitur Starter', 'Desain Visual Lebih Kompleks (CTA, Form, Galeri)', 'Direct WhatsApp Chat', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Free SSL', 'SEO On-Page Basic', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 2),
('88a55c11-bf5a-4c87-82f1-9d839f3041b6', 'Landing Page - Ultimate', 'Landing Page', 3750000, '/project', 'Solusi landing page all-in-one buat bisnis digital yang pengen konversi tinggi + tampil premium.', ARRAY['Semua fitur Growth', 'Up to 2 Halaman Tambahan (About / FAQ / Blog Preview)', 'Request Fitur Khusus (Popup, Accordion, Pricing Table, dll)', 'Desain Interaktif (Animated Scroll, Parallax, dll)', 'Speed Optimization (Lazy Load + Caching Tools)', '3x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 3),

('416e844a-60f7-4837-9b82-20aabfd23db5', 'Company Profile - Starter', 'Company Profile', 2500000, '/project', 'Untuk bisnis yang baru go digital dan butuh online presence yang rapi.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '3 Halaman Utama (Home, About, Contact)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'Form Kontak Langsung ke WhatsApp', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 4),
('50e6c5ef-7eea-45cf-b546-8f287eb64c26', 'Company Profile - Growth', 'Company Profile', 4000000, '/project', 'Untuk bisnis yang ingin tampil lebih profesional dan dipercaya oleh calon klien.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–6 Halaman (Home, About, Services, Portfolio/Clients, Contact, FAQ)', '2 Email Bisnis', 'Desain Premium dan Clean', '10 GB Disk Storage', 'Galeri Foto / Testimoni', 'SEO On-Page Dasar', '2x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 5),
('d5aeb797-45d8-4bc0-9757-fd2cf615078a', 'Company Profile - Executive', 'Company Profile', 6500000, '/project', 'Untuk perusahaan yang ingin tampil profesional, punya fitur lengkap, dan siap scale ke digital marketing.', ARRAY['Semua fitur Growth', '8–10 Halaman (termasuk Career, Blog, atau Request Khusus)', 'Request Fitur Tambahan (Popup, Accordion, Pricing Table, dll)', 'Integrasi Instagram Feed / YouTube Embed', 'Speed Optimization (Lazy Load + Caching Tools)', 'Desain Interaktif (Parallax, Scroll Animasi)', '3 Email Bisnis', '3x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 6),

('6d2f9c9d-6540-4114-98d5-f385b687b268', 'Travel & Tour - Starter', 'Travel & Tour', 2500000, '/project', 'Landing page simpel tapi powerful, fokus langsung ke penawaran paket tour dan WhatsApp booking.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'CTA Booking via WhatsApp per paket', 'Section Detail untuk Tour Packages', 'Harga / Durasi Paket', 'Garansi Maintenance 15 Hari'], false, 25, 'New Year Sale', 7),
('f47987ff-b270-4949-86b3-f00cb37b3d1d', 'Travel & Tour - Growth', 'Travel & Tour', 5000000, '/project', 'Website lengkap seperti travel agent profesional dan UX yang mendukung eksplorasi wisata.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–7 Halaman Utama (Home, About Us, Tour Packages, Gallery, Blog, Contact, Testimonial)', 'Page Individual untuk Setiap Paket', 'Fitur Search / Filter Paket Tour', 'CTA WhatsApp di setiap halaman paket', 'SEO On-Page Basic', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 30, 'BEST SELLER', 8),
('417dfc56-cf70-4e2e-8845-d52b9ddbabb6', 'Travel & Tour - Ultimate', 'Travel & Tour', 12000000, '/project', 'Website profesional + fitur pembayaran langsung di website! Cocok untuk agensi atau bisnis travel skala nasional/internasional.', ARRAY['Semua fitur Growth', 'Integrasi Payment Gateway (Midtrans / Tripay / Xendit / Stripe)', 'Tombol Book & Bayar Sekarang di setiap halaman paket', 'Form Booking Otomatis (Nama, Jadwal, Jumlah Orang, dll)', 'Email Notifikasi Otomatis (ke admin & customer)', 'Fitur Kalender Jadwal Ketersediaan (optional)', 'Desain Interaktif (Parallax, Scroll Animasi)', 'Speed Optimization', '3 Email Bisnis', '5x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 9),

('778cc8b4-f79a-4ce0-aa01-4c5e6cb06996', 'Toko Online - Starter', 'Toko Online', 2500000, '/project', 'Cocok untuk brand yang baru mulai jualan online dan butuh halaman jualan simpel tapi langsung bisa closing via WhatsApp.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'Gambar Produk, Harga, Deskripsi Singkat', 'Tombol Beli Sekarang → Direct ke WhatsApp', 'Section Testimoni / FAQ / Promo', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 10),
('88ff9c7a-36ec-4e7c-8e52-9a744362eeab', 'Toko Online - Growth', 'Toko Online', 6000000, '/project', 'Toko online profesional dengan katalog produk, galeri, dan sistem pemesanan via WhatsApp otomatis.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–7 Halaman (Home, Shop, About Us, Contact, FAQ, Testimoni, Promo)', 'Katalog Produk Dinamis (20–100 produk)', 'Fitur Search / Filter Produk', 'Tombol Tambah ke Keranjang → Checkout via WhatsApp', 'Desain Custom Kategori Produk', 'SEO On-Page Basic', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 11),
('8e5448d2-1524-45b5-bb7d-8bb981750496', 'Toko Online - Ultimate', 'Toko Online', 12000000, '/project', 'Toko online full fitur dengan cart system & pembayaran otomatis. Cocok untuk brand yang serius jualan dan siap scaling.', ARRAY['Semua fitur Growth', 'Sistem Keranjang Belanja Otomatis', 'Integrasi Payment Gateway (Midtrans / Tripay / Xendit / Stripe)', 'Metode Pembayaran: Transfer, QRIS, e-Wallet, Credit Card', 'Dashboard Admin (Order, Produk, Stok, Diskon, User, dll)', 'Checkout Otomatis + Email Notifikasi', 'Ongkir Otomatis (via plugin ekspedisi)', 'Mobile Friendly Cart Experience', 'Speed Optimization', '3 Email Bisnis', '5x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, '', 12);


-- ==========================================
-- TABLE DUMP DATA
-- ==========================================

-- Data for table pricing_packages (12 rows)
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('416e844a-60f7-4837-9b82-20aabfd23db5', 'Company Profile - Starter', 2500000, '/project', 'Untuk bisnis yang baru go digital dan butuh online presence yang rapi.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '3 Halaman Utama (Home, About, Contact)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'Form Kontak Langsung ke WhatsApp', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 4, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:34:59.770199+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('50e6c5ef-7eea-45cf-b546-8f287eb64c26', 'Company Profile - Growth', 4000000, '/project', 'Untuk bisnis yang ingin tampil lebih profesional dan dipercaya oleh calon klien.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–6 Halaman (Home, About, Services, Portfolio/Clients, Contact, FAQ)', '2 Email Bisnis', 'Desain Premium dan Clean', '10 GB Disk Storage', 'Galeri Foto / Testimoni', 'SEO On-Page Dasar', '2x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 5, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:35:34.380106+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('88344df3-69a8-4d8d-b863-8f405ead5510', 'Landing Page - Growth', 2750000, '/project', 'Buat kamu yang pengen tampil lebih profesional dan punya kontrol lebih atas fitur & brand.', ARRAY['Semua fitur Starter', 'Desain Visual Lebih Kompleks (CTA, Form, Galeri)', 'Direct WhatsApp Chat', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Free SSL', 'SEO On-Page Basic', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 2, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:33:39.221104+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('88a55c11-bf5a-4c87-82f1-9d839f3041b6', 'Landing Page - Ultimate', 3750000, '/project', 'Solusi landing page all-in-one buat bisnis digital yang pengen konversi tinggi + tampil premium.', ARRAY['Semua fitur Growth', 'Up to 2 Halaman Tambahan (About / FAQ / Blog Preview)', 'Request Fitur Khusus (Popup, Accordion, Pricing Table, dll)', 'Desain Interaktif (Animated Scroll, Parallax, dll)', 'Speed Optimization (Lazy Load + Caching Tools)', '3x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 3, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:33:54.145555+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('d5aeb797-45d8-4bc0-9757-fd2cf615078a', 'Company Profile - Executive', 6500000, '/project', 'Untuk perusahaan yang ingin tampil profesional, punya fitur lengkap, dan siap scale ke digital marketing.', ARRAY['Semua fitur Growth', '8–10 Halaman (termasuk Career, Blog, atau Request Khusus)', 'Request Fitur Tambahan (Popup, Accordion, Pricing Table, dll)', 'Integrasi Instagram Feed / YouTube Embed', 'Speed Optimization (Lazy Load + Caching Tools)', 'Desain Interaktif (Parallax, Scroll Animasi)', '3 Email Bisnis', '3x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 6, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:36:00.019403+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('6d2f9c9d-6540-4114-98d5-f385b687b268', 'Travel & Tour - Starter', 2500000, '/project', 'Landing page simpel tapi powerful, fokus langsung ke penawaran paket tour dan WhatsApp booking.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'CTA Booking via WhatsApp per paket', 'Section Detail untuk Tour Packages', 'Harga / Durasi Paket', 'Garansi Maintenance 15 Hari'], false, 25, 'New Year Sale', 7, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:36:53.759865+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('f47987ff-b270-4949-86b3-f00cb37b3d1d', 'Travel & Tour - Growth', 5000000, '/project', 'Website lengkap seperti travel agent profesional  dan UX yang mendukung eksplorasi wisata.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–7 Halaman Utama (Home, About Us, Tour Packages, Gallery, Blog, Contact, Testimonial)', 'Page Individual untuk Setiap Paket', 'Fitur Search / Filter Paket Tour', 'CTA WhatsApp di setiap halaman paket', 'SEO On-Page Basic', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 30, 'BEST SELLER', 8, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:37:53.197051+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('417dfc56-cf70-4e2e-8845-d52b9ddbabb6', 'Travel & Tour - Ultimate', 12000000, '/project', 'Website profesional + fitur pembayaran langsung di website! Cocok untuk agensi atau bisnis travel skala nasional/internasional.', ARRAY['Semua fitur Growth', 'Integrasi Payment Gateway (Midtrans / Tripay / Xendit / Stripe)', 'Tombol Book & Bayar Sekarang di setiap halaman paket', 'Form Booking Otomatis (Nama, Jadwal, Jumlah Orang, dll)', 'Email Notifikasi Otomatis (ke admin & customer)', 'Fitur Kalender Jadwal Ketersediaan (optional)', 'Desain Interaktif (Parallax, Scroll Animasi)', 'Speed Optimization', '3 Email Bisnis', '5x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, 'New Year Sale', 9, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:38:43.053392+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('2743cc35-4f90-4730-810c-dacacf0103a8', 'Landing Page - Starter', 1500000, '/project', 'Cocok untuk bisnis UMKM baru yang ingin langsung tampil online dengan landing page elegan.', ARRAY['Free Domain .com (1 Tahun)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '1 GB Disk Storage', 'Free SSL', '1x Revisi Gratis', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 1, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:41:01.439115+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('778cc8b4-f79a-4ce0-aa01-4c5e6cb06996', 'Toko Online - Starter', 2500000, '/project', 'Cocok untuk brand yang baru mulai jualan online dan butuh halaman jualan simpel tapi langsung bisa closing via WhatsApp.', ARRAY['Free Domain (.com)', 'Shared Hosting (1 Tahun)', 'Desain Responsif (Mobile & Desktop)', '1 Halaman Landing Page (scroll panjang)', '1 Email Bisnis', '2 GB Disk Storage', '2x Revisi Gratis', 'Free SSL', 'Gambar Produk, Harga, Deskripsi Singkat', 'Tombol Beli Sekarang → Direct ke WhatsApp', 'Section Testimoni / FAQ / Promo', 'Garansi Maintenance 15 Hari'], false, 20, 'New Year Sale', 10, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:39:35.699933+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('88ff9c7a-36ec-4e7c-8e52-9a744362eeab', 'Toko Online - Growth', 6000000, '/project', 'Toko online profesional dengan katalog produk, galeri, dan sistem pemesanan via WhatsApp otomatis.', ARRAY['Semua fitur Starter', 'Hosting 1 Tahun', '5–7 Halaman (Home, Shop, About Us, Contact, FAQ, Testimoni, Promo)', 'Katalog Produk Dinamis (20–100 produk)', 'Fitur Search / Filter Produk', 'Tombol Tambah ke Keranjang → Checkout via WhatsApp', 'Desain Custom Kategori Produk', 'SEO On-Page Basic', '2 Email Bisnis', '10 GB Disk Storage', '3x Revisi Gratis', 'Garansi Maintenance 1 Bulan'], true, 25, 'BEST SELLER', 11, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:39:56.156876+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.pricing_packages ("id", "name", "price", "period", "description", "features", "is_popular", "discount_percentage", "discount_label", "sort_order", "created_at", "updated_at") VALUES ('8e5448d2-1524-45b5-bb7d-8bb981750496', 'Toko Online - Ultimate', 12000000, '/project', 'Toko online full fitur dengan cart system & pembayaran otomatis. Cocok untuk brand yang serius jualan dan siap scaling.', ARRAY['Semua fitur Growth', 'Sistem Keranjang Belanja Otomatis', 'Integrasi Payment Gateway (Midtrans / Tripay / Xendit / Stripe)', 'Metode Pembayaran: Transfer, QRIS, e-Wallet, Credit Card', 'Dashboard Admin (Order, Produk, Stok, Diskon, User, dll)', 'Checkout Otomatis + Email Notifikasi', 'Ongkir Otomatis (via plugin ekspedisi)', 'Mobile Friendly Cart Experience', 'Speed Optimization', '3 Email Bisnis', '5x Revisi Gratis', 'Garansi Maintenance 1,5 Bulan'], false, 30, '', 12, '2025-12-24T14:50:57.402153+00:00', '2025-12-29T06:40:14.464873+00:00') ON CONFLICT DO NOTHING;

-- Data for table portfolio_items (3 rows)
INSERT INTO public.portfolio_items ("id", "title", "category", "description", "image_url", "link_url", "sort_order", "is_visible", "created_at", "updated_at") VALUES ('745e949c-0d9d-4fe4-a552-9bf7b3187b84', 'Corporate Company', 'Company Profile', 'Professional company profile website', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop', NULL, 3, true, '2025-12-24T14:22:58.587849+00:00', '2025-12-24T14:22:58.587849+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.portfolio_items ("id", "title", "category", "description", "image_url", "link_url", "sort_order", "is_visible", "created_at", "updated_at") VALUES ('456856e5-b42c-4892-9410-a2d6e2c4b85a', 'Real Estate Platform', 'Toko Online', 'Property listing platform', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop', NULL, 5, true, '2025-12-24T14:22:58.587849+00:00', '2025-12-24T14:22:58.587849+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.portfolio_items ("id", "title", "category", "description", "image_url", "link_url", "sort_order", "is_visible", "created_at", "updated_at") VALUES ('2faa960c-f609-4e53-bb87-dfb0f3fadab1', 'Website Umrah dan Haji', 'Landing Page', 'Website dengan fitur lengkap untuk membantu bisnismu berkembang dan menjangkau lebih banyak orang.', 'https://uwsjhtfwxdizxqunplcw.supabase.co/storage/v1/object/public/portfolio/9fec5966-ceaa-438c-9605-0ed0c66ffdca.png', 'https://barokah-journey-website.vercel.app/', 4, true, '2025-12-24T14:22:58.587849+00:00', '2025-12-24T14:41:48.60091+00:00') ON CONFLICT DO NOTHING;

-- Table profiles has 0 rows
-- Table orders has 0 rows
-- Table user_roles has 0 rows
-- Table activity_logs has 0 rows
-- Table invitations has 0 rows
