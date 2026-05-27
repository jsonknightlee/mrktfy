# Stripe Integration Setup Guide

## 📋 Overview
Your app is now set up to use Stripe for payment processing with the Payment Sheet API. Here's what's been implemented:

### ✅ What's Done
- Stripe React Native SDK installed and configured
- PaymentScreen updated to use Stripe Payment Sheet
- Mock payment service for development
- Backend API examples for real Stripe integration
- Environment variables configured

### 🔧 What You Need to Do

## 1. Get Your Stripe Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Developers** → **API keys**
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Copy your **Secret key** (starts with `sk_test_`)

## 2. Update Environment Variables

Edit your `.env` file:

```bash
# Replace with your actual Stripe publishable key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
```

## 3. Set Up Backend (Optional for Testing)

For development, the app uses mock responses. To use real Stripe payments:

1. Install Stripe in your Node.js backend:
```bash
npm install stripe
```

2. Copy the API endpoints from `backend-examples/stripe-api.js` to your server

3. Update the backend with your Stripe secret key:
```javascript
const stripe = Stripe('sk_test_your_actual_secret_key_here');
```

## 4. Test the Payment Flow

### Development Mode (Mock)
The app currently runs in development mode with mock responses:
- No real charges are made
- Payment sheet shows with test data
- Subscription updates work locally

### Production Mode (Real Payments)
To enable real payments:
1. Set `EXPO_PUBLIC_APP_ENV=production` in your environment
2. Ensure your backend API endpoints are running
3. Use real Stripe keys

## 🚀 Testing with Stripe

### Test Card Numbers
Use these test cards in the Stripe Payment Sheet:

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Visa (successful payment) |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |

### Test Expiry/CVV
- Any future expiry date
- Any 3-digit CVV

## 📱 How It Works

1. **User selects a plan** → Navigates to PaymentScreen
2. **Payment initialization** → Creates payment intent via backend
3. **Stripe Payment Sheet** → Native payment UI appears
4. **User completes payment** → Stripe processes securely
5. **Success** → Subscription updated in app

## 🔧 Configuration Options

### Payment Sheet Customization
In `stripeService.js`, you can customize:
- Merchant display name
- Default billing details
- Payment method types
- Appearance

### Backend Setup
For production, you'll need:
1. Stripe webhook endpoint for payment notifications
2. Database updates for subscription status
3. Email notifications for receipts

## 🐛 Troubleshooting

### Common Issues

1. **"Stripe publishable key not found"**
   - Check `.env` file has the key
   - Restart the app after changing environment variables

2. **"Payment sheet initialization failed"**
   - Check backend API is running
   - Verify API keys are correct
   - Check network connectivity

3. **"Payment failed"**
   - Use test card numbers
   - Check Stripe dashboard for payment attempts
   - Verify webhook configuration

### Debug Mode
Enable debug logging by setting:
```javascript
console.log('Payment debug:', paymentData);
```

## 📚 Next Steps

1. **Webhooks**: Set up Stripe webhooks for real-time payment notifications
2. **Subscriptions**: Implement recurring billing with Stripe Subscriptions
3. **Receipts**: Add email receipt functionality
4. **Analytics**: Track payment events and conversion rates

## 🛡️ Security Notes

- Never expose your Stripe secret key in the app
- Always use HTTPS for API calls
- Implement proper webhook signature verification
- Store customer IDs securely in your database

## 📞 Support

- Stripe Documentation: https://stripe.com/docs
- React Native SDK: https://stripe.com/docs/stripe-js/react-native
- Test your integration: https://stripe.com/docs/testing
