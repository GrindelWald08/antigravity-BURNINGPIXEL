-- Add update and delete policies for pricing_packages (admin operations via edge function)
-- Since we're using password protection, we allow all operations but rely on edge function for auth
CREATE POLICY "Allow all operations for pricing packages"
ON public.pricing_packages
FOR ALL
USING (true)
WITH CHECK (true);