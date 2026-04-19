import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// ─── Price ID → Tier mapping ───────────────────────────────────────────────
// Update this map if new prices are added in Stripe
const PRICE_TIER_MAP: Record<string, { tier: string; maxSeats: number }> = {
  "price_1TMuoVD3rGwRS4aVnW37CGUp": { tier: "personal", maxSeats: 1 },  // Personal Yearly £35
  "price_1TMuvAD3rGwRS4aVFaIBcyXi": { tier: "personal", maxSeats: 1 },  // Personal Monthly £3.99
  "price_1TNu6aD3rGwRS4aV9EVcayew": { tier: "personal", maxSeats: 1 },  // Personal Founder Yearly £29
  "price_1TMuppD3rGwRS4aV6VYqyx1w": { tier: "club",     maxSeats: 20 }, // Club Yearly £400
  "price_1TMuppD3rGwRS4aV5TGf5cK6": { tier: "club",     maxSeats: 20 }, // Club Monthly £39.99
  "price_1TMurzD3rGwRS4aVafCVXXCB": { tier: "elite",    maxSeats: 50 }, // Elite Yearly £500
  "price_1TMurzD3rGwRS4aVhyvXAP5c": { tier: "elite",    maxSeats: 50 }, // Elite Monthly £49.99
};

function getTierFromPriceId(priceId: string): { tier: string; maxSeats: number } {
  return PRICE_TIER_MAP[priceId] ?? { tier: "personal", maxSeats: 1 };
}

// ─── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ─── checkout.session.completed ────────────────────────────────────────────
// Fired when a user completes payment via a Stripe Payment Link.
// Uses client_reference_id to link the Supabase user to the subscription.
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("Processing checkout:", session.id);

  const supabaseUserId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;

  if (!supabaseUserId) {
    console.error("No client_reference_id on session — cannot link user. Email:", customerEmail);
    // Still log to console so Laura can manually link if needed
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0].price.id;
  const { tier, maxSeats } = getTierFromPriceId(priceId);

  console.log(`User: ${supabaseUserId}, Tier: ${tier}, Max seats: ${maxSeats}`);

  // Find the user's existing organisation
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("org_id")
    .eq("id", supabaseUserId)
    .single();

  if (userError || !user?.org_id) {
    console.error("Could not find org for user:", supabaseUserId, userError);
    return;
  }

  const orgId = user.org_id;

  // Update organisation plan and stripe_customer_id
  await supabaseAdmin
    .from("organisations")
    .update({
      plan: tier,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  // Upsert subscription record
  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      org_id: orgId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: "active",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      seat_count: 1,
      max_seats: maxSeats,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });

  console.log(`Upgraded org ${orgId} to ${tier}`);
}

// ─── customer.subscription.updated ────────────────────────────────────────
// Fired on renewals, plan changes, and status changes.
// Updates BOTH the subscriptions table AND organisations.plan.
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`Subscription updated: ${subscription.id}`);

  const priceId = subscription.items.data[0].price.id;
  const { tier, maxSeats } = getTierFromPriceId(priceId);

  const status = mapStripeStatus(subscription.status);

  // Update subscriptions table
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status,
      stripe_price_id: priceId,
      max_seats: maxSeats,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .select("org_id")
    .single();

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }

  // Also update organisations.plan to reflect new tier
  if (sub?.org_id) {
    const newPlan = status === "active" ? tier : "essential";
    await supabaseAdmin
      .from("organisations")
      .update({ plan: newPlan, updated_at: new Date().toISOString() })
      .eq("id", sub.org_id);

    console.log(`Updated org ${sub.org_id} plan to ${newPlan}`);
  }
}

// ─── customer.subscription.deleted ────────────────────────────────────────
// Fired when a subscription is fully cancelled.
// Downgrades the organisation to essential.
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`Subscription cancelled: ${subscription.id}`);

  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .select("org_id")
    .single();

  if (error) {
    console.error("Error marking subscription canceled:", error);
    throw error;
  }

  if (sub?.org_id) {
    await supabaseAdmin
      .from("organisations")
      .update({ plan: "essential", updated_at: new Date().toISOString() })
      .eq("id", sub.org_id);

    console.log(`Downgraded org ${sub.org_id} to essential`);
  }
}

// ─── invoice.payment_failed ────────────────────────────────────────────────
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`Payment failed for invoice: ${invoice.id}`);
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: "active",
    trialing: "active",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    unpaid: "past_due",
  };
  return map[stripeStatus] ?? "active";
}
