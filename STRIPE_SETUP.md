# Stripe Integration Setup for Canvas Website

This document outlines the setup process for integrating Stripe payments into the canvas website, specifically for subscription plans.

## Overview

The Stripe integration allows users to create subscription payment forms directly on the canvas. Users can select from predefined subscription plans and complete their subscription using Stripe's secure payment processing.

## Features

- **Subscription Plans**: Three predefined plans (Basic, Pro, Enterprise)
- **Interactive UI**: Plan selection with feature comparison
- **Secure Payments**: Stripe Elements integration
- **Webhook Support**: Real-time subscription event handling
- **Customer Management**: Automatic customer creation and management

## Setup Instructions

### 1. Install Stripe CLI

First, install the Stripe CLI on your system:

```bash
# For Ubuntu/Debian
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe

# For macOS
brew install stripe/stripe-cli/stripe

# For Windows
# Download from https://github.com/stripe/stripe-cli/releases
```

### 2. Login to Stripe

```bash
stripe login
```

This will open your browser to authenticate with your Stripe account.

### 3. Get Your API Keys

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** > **API keys**
3. Copy your **Publishable key** and **Secret key**

### 4. Set Environment Variables

Create or update your `.dev.vars` file with the following variables:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 5. Set Up Webhooks

Run the following command to start listening for webhook events:

```bash
stripe listen --forward-to localhost:8787/api/stripe/webhook
```

This will output a webhook secret. Copy this secret and add it to your `.dev.vars` file as `STRIPE_WEBHOOK_SECRET`.

### 6. Create Subscription Products and Prices

You'll need to create the subscription products and prices in your Stripe dashboard that correspond to the plans defined in the code:

#### Basic Plan
- Product Name: "Basic Plan"
- Price: $9.99/month
- Price ID: Use this ID in the code (currently set to 'basic')

#### Pro Plan
- Product Name: "Pro Plan" 
- Price: $19.99/month
- Price ID: Use this ID in the code (currently set to 'pro')

#### Enterprise Plan
- Product Name: "Enterprise Plan"
- Price: $49.99/month
- Price ID: Use this ID in the code (currently set to 'enterprise')

### 7. Update Price IDs

After creating the products and prices in Stripe, update the `SUBSCRIPTION_PLANS` array in `src/shapes/stripe/StripePaymentShapeUtil.tsx` with the actual Stripe price IDs:

```typescript
const SUBSCRIPTION_PLANS = [
  {
    id: 'price_actual_stripe_price_id_here', // Replace with actual Stripe price ID
    name: 'Basic Plan',
    price: 999,
    interval: 'month',
    description: 'Perfect for individuals',
    features: ['Basic features', 'Email support', '1GB storage']
  },
  // ... update other plans similarly
];
```

## API Endpoints

The integration provides the following API endpoints:

- `POST /api/stripe/create-subscription` - Creates a new subscription
- `POST /api/stripe/create-payment-intent` - Creates a payment intent (for one-time payments)
- `POST /api/stripe/webhook` - Handles Stripe webhook events

## Webhook Events

The webhook handler processes the following events:

- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription deleted
- `invoice.payment_succeeded` - Invoice payment successful
- `invoice.payment_failed` - Invoice payment failed
- `payment_intent.succeeded` - Payment intent successful
- `payment_intent.payment_failed` - Payment intent failed

## Usage

### Adding a Subscription Form to Canvas

1. Use the Stripe tool from the toolbar (shortcut: `Alt+Shift+P`)
2. Select a subscription plan from the available options
3. Enter customer email (optional)
4. Choose theme preference
5. Click "Subscribe" to initialize the payment form
6. Complete payment details using Stripe Elements

### Keyboard Shortcuts

- `Alt+Shift+P` - Add Stripe subscription form
- `Alt+Shift+S` - Quick action to add subscription form

### Context Menu

Right-click on the canvas to access the "Add Stripe Subscription" option.

## Testing

### Test Cards

Use these test card numbers for testing:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

### Test Mode

The integration runs in test mode by default. All transactions are test transactions and won't result in actual charges.

## Security Considerations

- Never expose your Stripe secret key in client-side code
- Always verify webhook signatures
- Use HTTPS in production
- Implement proper error handling
- Validate all input data

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**: Ensure the webhook endpoint is accessible and the secret is correct
2. **Payment form not loading**: Check that the publishable key is correct
3. **Subscription creation fails**: Verify the price IDs exist in your Stripe account
4. **CORS errors**: Ensure the worker is properly configured for CORS

### Debug Mode

Enable debug logging by setting the appropriate environment variables or checking the browser console and worker logs.

## Production Deployment

When deploying to production:

1. Switch to live API keys
2. Update webhook endpoints to production URLs
3. Configure proper CORS settings
4. Set up monitoring and alerting
5. Test the complete subscription flow

## Support

For issues related to:
- **Stripe API**: Check [Stripe Documentation](https://stripe.com/docs)
- **Integration**: Review this setup guide and check the code comments
- **Canvas Website**: Refer to the main project documentation 