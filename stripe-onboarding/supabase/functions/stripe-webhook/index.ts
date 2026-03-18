import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1ABC123...": "personal", // Replace with actual Personal plan price ID
  "price_1DEF456...": "club", // Replace with actual Club plan price ID
  "price_1GHI789...": "elite", // Replace with actual Elite plan price ID
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const parts = signature.split(",");
  const timestamp = parts
    .find((p) => p.startsWith("t="))
    ?.substring(2);
  const sig = parts
    .find((p) => p.startsWith("v1="))
    ?.substring(3);

  if (!timestamp || !sig) return false;

  // Reject timestamps older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === sig;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing Stripe environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid Stripe signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(body);
    console.log(`Received Stripe event: ${event.type} (${event.id})`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(supabase, event.data.object, stripeSecretKey);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(supabase, event.data.object);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(supabase, event.data.object);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Webhook handler failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Record<string, unknown>,
  stripeSecretKey: string
) {
  console.log("Processing checkout.session.completed");

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email as string || session.customer_details?.email as string;
  const orgName =
    (session.metadata as Record<string, string>)?.org_name ||
    (session.custom_fields as Array<{ key: string; text: { value: string } }>)?.find(
      (f) => f.key === "organisationname" || f.key === "org_name" || f.key === "club_name"
    )?.text?.value ||
    `Organisation`;

  if (!customerEmail) {
    console.error("No customer email found in session");
    return;
  }

  // Fetch subscription details from Stripe to get price ID
  const subResponse = await fetch(
    `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
    {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    }
  );
  const subscription = await subResponse.json();
  const priceId = subscription.items?.data?.[0]?.price?.id || "";
  const plan = PRICE_TO_PLAN[priceId] || "personal";

  console.log(`Customer: ${customerEmail}, Org: ${orgName}, Plan: ${plan}`);

  // Create or get user in Supabase Auth
  let userId: string;

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u: { email?: string }) => u.email === customerEmail
  );

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Found existing user: ${userId}`);
  } else {
    // Create new user with a random password (they'll use magic link)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      console.error("Failed to create user:", createError);
      return;
    }
    userId = newUser.user.id;
    console.log(`Created new user: ${userId}`);
  }

  // Create organisation using database function
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data, error } = await supabase.rpc("create_organisation_for_customer", {
    p_name: orgName,
    p_slug: slug,
    p_plan: plan,
    p_owner_id: userId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_stripe_price_id: priceId,
  });

  if (error) {
    console.error("Failed to create organisation:", error);
    return;
  }

  console.log("Organisation created:", data);

  // Send magic link email
  const { error: magicLinkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: customerEmail,
    options: {
      redirectTo: `https://bowlstrack.co.uk/welcome?org=${slug}`,
    },
  });

  if (magicLinkError) {
    console.error("Failed to send magic link:", magicLinkError);
  } else {
    console.log(`Magic link sent to ${customerEmail}`);
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
) {
  console.log("Processing customer.subscription.updated");

  const subscriptionId = subscription.id as string;
  const status = subscription.status as string;
  const priceId =
    (subscription.items as { data: Array<{ price: { id: string } }> })?.data?.[0]?.price?.id || "";
  const plan = PRICE_TO_PLAN[priceId] || "personal";
  const currentPeriodEnd = subscription.current_period_end as number;

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      plan,
      stripe_price_id: priceId,
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Failed to update subscription:", error);
  } else {
    console.log(`Subscription ${subscriptionId} updated to ${status} (${plan})`);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
) {
  console.log("Processing customer.subscription.deleted");

  const subscriptionId = subscription.id as string;

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Failed to cancel subscription:", error);
  } else {
    console.log(`Subscription ${subscriptionId} cancelled`);
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Record<string, unknown>
) {
  console.log("Processing invoice.payment_failed");

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("Failed to update subscription status:", error);
  } else {
    console.log(`Subscription ${subscriptionId} marked as past_due`);
  }
}
