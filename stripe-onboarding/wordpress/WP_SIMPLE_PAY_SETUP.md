# WP Simple Pay Configuration for BowlsTrack

## Overview
WP Simple Pay handles the checkout form on the WordPress site. After payment, Stripe sends a webhook to our Supabase Edge Function which creates the organisation and user.

## Setup Steps

### 1. Install WP Simple Pay
- Install and activate WP Simple Pay Pro (or Lite for basic)
- Connect to your Stripe account in WP Simple Pay → Settings → Stripe

### 2. Create Payment Forms

Create one form per plan:

#### Personal Plan
- **Title**: BowlsTrack Personal
- **Type**: Subscription
- **Price**: Set your monthly/yearly price
- **Custom Fields**:
  - Organisation Name (text field, required)
  - Email (built-in)
- **Metadata** (under Form → Stripe → Metadata):
  - Key: `org_name` → Value: `{organisation-name-field}`

#### Club Plan
- **Title**: BowlsTrack Club
- **Type**: Subscription
- **Price**: Set your monthly/yearly price
- **Custom Fields**: Same as Personal
- **Metadata**: Same as Personal

#### Elite Plan
- **Title**: BowlsTrack Elite
- **Type**: Subscription
- **Price**: Set your monthly/yearly price
- **Custom Fields**: Same as Personal
- **Metadata**: Same as Personal

### 3. Configure Success Page
Set the success/thank you page to display:
```
Thank you for subscribing to BowlsTrack!
Check your email for a magic link to access your account.
```

### 4. Stripe Product IDs
After creating forms, note the Stripe Price IDs from Stripe Dashboard → Products:
- Personal: `price_xxx`
- Club: `price_xxx`
- Elite: `price_xxx`

Update these in the `stripe-webhook/index.ts` `PRICE_TO_PLAN` mapping.

## Custom Fields Setup

WP Simple Pay supports custom fields that get passed to Stripe as metadata.
The webhook reads metadata to get the organisation name.

### Option A: Using Metadata (Recommended)
In the form settings → Stripe → Checkout → Metadata:
```
org_name = {form-field:organisation_name}
```

### Option B: Using Custom Fields
Stripe Checkout custom_fields can also be used. The webhook checks both:
1. `session.metadata.org_name`
2. `session.custom_fields` with key `organisationname` or `org_name` or `club_name`

## Testing
1. Switch WP Simple Pay to Test Mode (Settings → Stripe → Test Mode)
2. Use test card: `4242 4242 4242 4242`
3. Verify webhook fires and org is created in Supabase
