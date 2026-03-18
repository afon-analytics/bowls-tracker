# BowlsTrack Stripe Onboarding

Automated customer onboarding flow: Stripe payment → organisation creation → magic link authentication.

## Architecture

```
WordPress (WP Simple Pay)
  → Stripe Checkout
    → Stripe Webhook
      → Supabase Edge Function (stripe-webhook)
        → Create organisation (DB function)
        → Create/find user (Supabase Auth)
        → Send magic link email
          → User clicks link → Welcome page → Dashboard
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Edge Function | `supabase/functions/stripe-webhook/` | Receives Stripe webhooks, orchestrates onboarding |
| DB Migration | `supabase/migrations/002_enhanced_org_functions.sql` | Database functions for org/subscription management |
| Welcome Page | `pwa/Welcome.jsx` | Post-authentication landing page |
| WP Setup Guide | `wordpress/WP_SIMPLE_PAY_SETUP.md` | WordPress payment form configuration |

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create org, user, subscription; send magic link |
| `customer.subscription.updated` | Update plan/status in subscriptions table |
| `customer.subscription.deleted` | Mark subscription as cancelled |
| `invoice.payment_failed` | Mark subscription as past_due |

## Plans

| Plan | Features |
|------|----------|
| Personal | Individual bowler tracking |
| Club | Team management, multiple members |
| Elite | Full competition & league management |

## Deployment

See the deployment instructions in the project task description, or run:

```bash
# 1. Apply database migration
# Use Supabase Dashboard SQL editor or CLI

# 2. Deploy edge function
cd supabase/functions
supabase functions deploy stripe-webhook --project-ref jgwpvmasqtvkzfzhlgot

# 3. Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref jgwpvmasqtvkzfzhlgot
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --project-ref jgwpvmasqtvkzfzhlgot
```

## Security

- Webhook signatures are verified using HMAC-SHA256
- Timestamps are validated (5-minute tolerance)
- Database functions use `SECURITY DEFINER` with explicit `search_path`
- JWT verification is disabled for the webhook endpoint (Stripe can't send JWTs)
- Service role key is only used server-side in the edge function
