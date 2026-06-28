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