import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to create SHA512 hash
async function sha512(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-512", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Midtrans webhook received:", JSON.stringify(payload));

    const { 
      order_id: orderId,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      payment_type: paymentType,
      transaction_time: transactionTime,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
    } = payload;

    if (!orderId) {
      console.error("Missing order ID in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing order ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify signature
    const expectedSignature = await sha512(orderId + statusCode + grossAmount + serverKey);
    if (signatureKey !== expectedSignature) {
      console.error("Invalid signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Map Midtrans status to our status
    let orderStatus: string;
    switch (transactionStatus) {
      case "capture":
        // For credit card, check fraud status
        orderStatus = fraudStatus === "accept" ? "paid" : "pending";
        break;
      case "settlement":
        orderStatus = "paid";
        break;
      case "pending":
        orderStatus = "pending";
        break;
      case "deny":
      case "cancel":
        orderStatus = "cancelled";
        break;
      case "expire":
        orderStatus = "expired";
        break;
      case "refund":
        orderStatus = "refunded";
        break;
      default:
        orderStatus = transactionStatus;
    }

    // Update order in database
    const updateData: { status: string; payment_method: string | null; paid_at?: string } = {
      status: orderStatus,
      payment_method: paymentType || null,
    };

    if (orderStatus === "paid" && transactionTime) {
      updateData.paid_at = transactionTime;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("Order update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Order ${orderId} updated to status: ${orderStatus}`);

    // Log activity for paid orders
    if (orderStatus === "paid") {
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (order) {
        await supabase.from("activity_logs").insert({
          action: "payment_received",
          description: `Payment received for ${order.package_name}`,
          user_email: order.customer_email,
          metadata: {
            order_id: orderId,
            amount: order.amount,
            payment_method: paymentType,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in midtrans-webhook:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing the webhook." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
