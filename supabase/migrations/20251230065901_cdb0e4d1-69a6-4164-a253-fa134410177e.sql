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