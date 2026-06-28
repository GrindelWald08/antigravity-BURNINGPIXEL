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
