# Apple Pay Setup Guide

## 🍎 Apple Pay Integration Complete

Your app now supports Apple Pay payments through Stripe! Here's what's been implemented:

### ✅ What's Done
- Apple Pay enabled in Stripe Payment Sheet
- Dynamic Apple Pay configuration based on subscription tier
- iOS capabilities configured
- Payment summary items dynamically generated

## 🔧 What You Need to Do

### 1. Apple Developer Account Setup

1. **Log in to** [Apple Developer Portal](https://developer.apple.com/)
2. **Go to** Certificates, Identifiers & Profiles
3. **Select your App ID** (com.mrktfy.mrktfy)
4. **Enable "Apple Pay Payment Processing"** capability
5. **Create a Merchant ID**:
   - Click "Identifiers" → "+"
   - Choose "Merchant IDs"
   - Enter description: "Mrktfy Merchant ID"
   - Enter identifier: "merchant.com.yourcompany.mrktfy"

### 2. Stripe Dashboard Setup

1. **Go to** [Stripe Dashboard](https://dashboard.stripe.com/)
2. **Settings** → **Payment methods** → **Apple Pay**
3. **Click "Set up"** for Apple Pay
4. **Upload your Apple Pay certificate**:
   - Download the certificate from Apple Developer Portal
   - Upload to Stripe
5. **Register your domain** (if you have a website)

### 3. Update Environment Variables

Add your Apple Merchant ID to `.env`:

```bash
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
EXPO_PUBLIC_APPLE_MERCHANT_ID=merchant.com.yourcompany.mrktfy
```

### 4. Update Stripe Service (Optional)

Update the merchant ID in `stripeService.js`:

```javascript
applePay: {
  merchantId: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID || 'merchant.com.yourcompany.mrktfy',
  // ...
}
```

## 📱 How Apple Pay Works in Your App

### User Experience:
1. **User selects subscription plan**
2. **Payment Sheet appears** with:
   - Credit/Debit card option
   - **Apple Pay button** (if available on device)
3. **User taps Apple Pay**
4. **Face ID/Touch ID** authentication
5. **Payment processed instantly**

### Payment Summary Display:
- **Prospector (per month)** - £9.99
- **Prospector (per year)** - £99.99
- **Investor (per month)** - £29.99
- Etc.

## 🧪 Testing Apple Pay

### On Device:
1. **Use a real iOS device** (Apple Pay doesn't work in simulator)
2. **Add a test card** to Wallet app:
   - Card number: 4242 4242 4242 4242
   - Expiry: Any future date
   - CVV: Any 3 digits
3. **Run the app** and test payment flow

### Test Cards:
| Card Type | Number | Result |
|-----------|---------|--------|
| Visa | 4242 4242 4242 4242 | Success |
| Declined | 4000 0000 0000 0002 | Decline |
| Insufficient Funds | 4000 0000 0000 9995 | Insufficient |

## 🔄 Payment Flow with Apple Pay

```javascript
// 1. User selects plan
// 2. PaymentScreen initializes
const applePayConfig = createApplePayConfig(tier, billingInterval);

// 3. Payment Sheet shows with Apple Pay option
const { success } = await initializePaymentSheet({
  paymentIntent,
  applePayConfig, // ← Apple Pay configuration
});

// 4. User pays with Apple Pay
const { success: paymentSuccess } = await openPaymentSheet();

// 5. Success! Update subscription
await updateSubscription(tier.key);
```

## 🛡️ Security Benefits

- **Biometric authentication** (Face ID/Touch ID)
- **No card details stored** in app
- **Tokenized payments** via Stripe
- **PCI compliant** by default

## 📋 Requirements Checklist

### ✅ Code Requirements:
- [x] Stripe React Native SDK installed
- [x] Payment Sheet configured for Apple Pay
- [x] Dynamic payment summary items
- [x] iOS capabilities added

### 🔧 External Requirements:
- [ ] Apple Developer account
- [ ] Apple Pay enabled in App ID
- [ ] Merchant ID created
- [ ] Stripe Apple Pay certificate uploaded
- [ ] Domain registered (if applicable)

## 🚨 Troubleshooting

### Apple Pay button not showing:
1. **Check device compatibility** (iPhone 6+ with iOS 10+)
2. **Verify Apple Pay is enabled** in Settings
3. **Ensure merchant ID matches** between Apple and Stripe
4. **Check bundle identifier** matches App ID

### Payment fails:
1. **Verify Stripe Apple Pay setup**
2. **Check certificate is valid**
3. **Ensure test card added to Wallet**
4. **Check network connection**

### Development issues:
1. **Use real device** (not simulator)
2. **Clear app cache** if needed
3. **Restart app** after configuration changes

## 📊 Analytics (Optional)

Track Apple Pay usage:
```javascript
// In payment success callback
if (paymentSuccess) {
  analytics.track('Payment Completed', {
    method: 'apple_pay', // or 'card'
    tier: tier.key,
    amount: price.amount,
  });
}
```

## 🎯 Next Steps

1. **Complete Apple Developer setup**
2. **Configure Stripe Apple Pay**
3. **Test on real device**
4. **Monitor payment success rates**
5. **Consider Google Pay for Android**

Your app is ready for Apple Pay! 🍎💳
