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