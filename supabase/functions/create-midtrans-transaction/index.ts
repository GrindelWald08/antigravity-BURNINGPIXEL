import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTransactionRequest {
  packageId: string;
  packageName: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // SECURITY: Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please log in to make a purchase." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's auth token to validate authentication
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate the JWT and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseWithAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("Authentication error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication. Please log in again." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { packageId, packageName, amount, customerName, customerEmail, customerPhone }: CreateTransactionRequest = await req.json();

    // SECURITY: Validate required fields including packageId
    if (!packageId || !packageName || !amount || !customerName || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // SECURITY: Server-side price validation - fetch package from database
    const { data: pkg, error: pkgError } = await supabase
      .from("pricing_packages")
      .select("id, name, price, discount_percentage")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkg) {
      console.error("Package lookup error:", pkgError);
      return new Response(
        JSON.stringify({ error: "Invalid package selected" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate expected price with discount
    const expectedPrice = pkg.discount_percentage && pkg.discount_percentage > 0
      ? Number(pkg.price) * (1 - Number(pkg.discount_percentage) / 100)
      : Number(pkg.price);

    // SECURITY: Validate that the amount matches the expected price (allow 1 IDR tolerance for rounding)
    if (Math.abs(Number(amount) - expectedPrice) > 1) {
      console.error(`Price mismatch detected: expected ${expectedPrice}, received ${amount}`);
      
      // Log suspicious activity
      await supabase.from("activity_logs").insert({
        action: "payment_amount_mismatch",
        description: `Price manipulation attempt detected for package ${pkg.name}`,
        user_id: userId,
        user_email: userEmail,
        metadata: {
          package_id: packageId,
          package_name: pkg.name,
          expected_amount: expectedPrice,
          provided_amount: amount,
        },
      });

      return new Response(
        JSON.stringify({ 
          error: "Amount does not match package price. Please refresh and try again.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the server-validated price for the transaction
    const validatedAmount = Math.round(expectedPrice);

    // Create order in database with authenticated user ID
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        package_id: packageId,
        package_name: pkg.name,
        amount: validatedAmount,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      throw new Error("Failed to create order");
    }

    // Create Midtrans Snap transaction with server-validated amount
    const transactionPayload = {
      transaction_details: {
        order_id: order.id,
        gross_amount: validatedAmount,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone || "",
      },
      item_details: [
        {
          id: packageId,
          price: validatedAmount,
          quantity: 1,
          name: pkg.name.substring(0, 50), // Midtrans has 50 char limit
        },
      ],
      callbacks: {
        finish: `${req.headers.get("origin")}/payment/success?order_id=${order.id}`,
        error: `${req.headers.get("origin")}/payment/failed?order_id=${order.id}`,
        pending: `${req.headers.get("origin")}/payment/success?order_id=${order.id}`,
      },
    };

    // Production URL for live payments
    const midtransUrl = "https://app.midtrans.com/snap/v1/transactions";
    
    const midtransResponse = await fetch(midtransUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${btoa(serverKey + ":")}`,
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!midtransResponse.ok) {
      const errorData = await midtransResponse.text();
      console.error("Midtrans API error:", errorData);
      
      // Update order status to failed
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);

      throw new Error("Failed to create Midtrans transaction");
    }

    const midtransResult = await midtransResponse.json();

    // Update order with Midtrans details
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        xendit_invoice_id: midtransResult.token,
        xendit_invoice_url: midtransResult.redirect_url,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Order update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        orderId: order.id,
        token: midtransResult.token,
        redirectUrl: midtransResult.redirect_url,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in create-midtrans-transaction:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred while processing your payment. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
