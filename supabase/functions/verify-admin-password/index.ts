import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

async function verifyPassword(inputPassword: string): Promise<{ valid: boolean; method: string }> {
  // Check for bcrypt hash first (more secure)
  const adminPasswordHash = Deno.env.get('ADMIN_PASSWORD_HASH');
  if (adminPasswordHash) {
    try {
      const valid = await bcrypt.compare(inputPassword, adminPasswordHash);
      return { valid, method: 'hash' };
    } catch (error) {
      console.error('Error comparing bcrypt hash:', error);
      return { valid: false, method: 'hash' };
    }
  }
  
  // Fallback to plaintext comparison (legacy, less secure)
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  if (adminPassword) {
    return { valid: inputPassword === adminPassword, method: 'legacy' };
  }
  
  return { valid: false, method: 'none' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  
  // Create service role client for database operations
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Check rate limit using persistent database storage
    const { data: rateLimitCheck, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', { p_ip_address: clientIP });
    
    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    } else if (rateLimitCheck && rateLimitCheck[0]?.is_limited) {
      console.log(`Rate limited request from IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Too many failed attempts. Please try again in ${rateLimitCheck[0].retry_after_seconds} seconds.` 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitCheck[0].retry_after_seconds)
          } 
        }
      );
    }

    const { password } = await req.json();
    
    const hasHash = !!Deno.env.get('ADMIN_PASSWORD_HASH');
    const hasPlaintext = !!Deno.env.get('ADMIN_PASSWORD');

    console.log(`Admin password verification attempt from IP: ${clientIP}`);

    if (!hasHash && !hasPlaintext) {
      console.error('Admin password not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication service is temporarily unavailable.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { valid: isValid, method } = await verifyPassword(password);
    
    if (isValid) {
      // Clear rate limit on success
      await supabase.rpc('clear_rate_limit', { p_ip_address: clientIP });
      
      console.log(`Admin password verified successfully from IP: ${clientIP}`);
      
      // Log successful authentication
      await supabase.from('activity_logs').insert({
        action: 'admin_login',
        description: 'Admin password authentication successful',
        ip_address: clientIP,
        metadata: {}
      });
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Record failed attempt in persistent storage
      const { data: attemptResult, error: attemptError } = await supabase
        .rpc('record_failed_attempt', { p_ip_address: clientIP });
      
      if (attemptError) {
        console.error('Failed to record attempt:', attemptError);
      }
      
      const isLocked = attemptResult?.[0]?.is_locked || false;
      const attemptsRemaining = attemptResult?.[0]?.attempts_remaining ?? 0;
      
      console.log(`Admin password verification failed from IP: ${clientIP}. Attempts remaining: ${attemptsRemaining}`);
      
      // Log failed attempt
      await supabase.from('activity_logs').insert({
        action: 'admin_login_failed',
        description: isLocked 
          ? 'Admin login failed - account locked due to too many attempts' 
          : 'Admin password authentication failed',
        ip_address: clientIP,
        metadata: { 
          attempts_remaining: attemptsRemaining,
          locked: isLocked
        }
      });
      
      if (isLocked) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Too many failed attempts. Please try again later.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Incorrect password. Too many failed attempts will result in temporary lockout.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});