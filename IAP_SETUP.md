# In-App Purchase (IAP) Setup Guide

This app now uses `react-native-iap` for subscription purchases on iOS and Android instead of Stripe. The UI and plan logic are unchanged; only the payment transaction layer has been swapped.

## What changed in the app

- `services/iapService.js` — new wrapper around `react-native-iap` for product loading and purchases
- `services/paymentService.js` — `processSubscriptionPayment` now triggers the App Store / Play Store native purchase, then sends the receipt to the backend
- `screens/PaymentScreen.js` — user taps the pay button to start the native in-app purchase

## Products to create in App Store Connect

Create **auto-renewable subscriptions** in a single subscription group (e.g. `mrktfy_subscriptions`):

| Plan | Monthly product ID | Yearly product ID |
|------|--------------------|-------------------|
| Buyer / Prospector | `com.mrktfy.subscription.buyer.monthly` | `com.mrktfy.subscription.buyer.yearly` |
| Investor | `com.mrktfy.subscription.investor.monthly` | `com.mrktfy.subscription.investor.yearly` |

- Configure pricing and territories.
- Set up the 3-day free trial as an introductory offer on the monthly/yearly products.
- Configure upgrade/downgrade behavior within the subscription group.

## Products to create in Google Play Console

Create **subscriptions** under **Monetize → Subscriptions**:

| Plan | Monthly product ID | Yearly product ID |
|------|--------------------|-------------------|
| Buyer / Prospector | `com.mrktfy.subscription.buyer.monthly` | `com.mrktfy.subscription.buyer.yearly` |
| Investor | `com.mrktfy.subscription.investor.monthly` | `com.mrktfy.subscription.investor.yearly` |

- Set base plans and any introductory offers.
- Enable real-time developer notifications (RTDN).

## Backend endpoints to implement

The app now calls these endpoints instead of the old Stripe ones:

### `POST /api/iap/validate-purchase`

Called after a successful in-app purchase. The backend must:
1. Validate the receipt with Apple (App Store Server API V2) or Google (Play Developer API).
2. Determine the subscription tier and status.
3. Activate the user’s subscription in the database.
4. Return the same shape the old Stripe `create-subscription` endpoint returned so the app can update the user profile.

Example body sent by the app:

```json
{
  "userId": "...",
  "tier": "prospector",
  "subscriptionLevelId": "prospector",
  "billingInterval": "month",
  "platform": "ios",
  "receipt": "...",
  "productId": "com.mrktfy.subscription.buyer.monthly",
  "transactionId": "...",
  "reactivate": false
}
```

### `POST /api/subscriptions/cancel`

Marks the user’s subscription to cancel at the end of the current period.

### `POST /api/subscriptions/reactivate`

Re-enables an existing subscription that was set to cancel.

### Server-to-server notifications

- **iOS:** App Store Server Notifications V2
- **Android:** Google Play Real-time Developer Notifications (RTDN)

Your backend should consume these to keep subscription state in sync when users cancel, renew, refund, or have billing issues outside the app.

## Optional environment variables

The product IDs in `services/iapService.js` have hardcoded defaults. If you want to override them per environment, set these in `.env.production` or `.env.development`:

```bash
EXPO_PUBLIC_IAP_PROSPECTOR_MONTH_IOS=com.mrktfy.subscription.buyer.monthly
EXPO_PUBLIC_IAP_PROSPECTOR_YEAR_IOS=com.mrktfy.subscription.buyer.yearly
EXPO_PUBLIC_IAP_INVESTOR_MONTH_IOS=com.mrktfy.subscription.investor.monthly
EXPO_PUBLIC_IAP_INVESTOR_YEAR_IOS=com.mrktfy.subscription.investor.yearly

EXPO_PUBLIC_IAP_PROSPECTOR_MONTH_ANDROID=com.mrktfy.subscription.buyer.monthly
EXPO_PUBLIC_IAP_PROSPECTOR_YEAR_ANDROID=com.mrktfy.subscription.buyer.yearly
EXPO_PUBLIC_IAP_INVESTOR_MONTH_ANDROID=com.mrktfy.subscription.investor.monthly
EXPO_PUBLIC_IAP_INVESTOR_YEAR_ANDROID=com.mrktfy.subscription.investor.yearly
```

## Build notes

- `react-native-iap` is a native module. The next EAS build or `expo prebuild` will pull it into the iOS and Android projects.
- Do not run `expo prebuild --clean` without checking your existing `ios/` and `android/` customizations first.
- For local iOS development, run `npx pod install` in the `ios/` directory after installing the package.

## Testing the flow

1. Create the products in App Store Connect and Play Console first.
2. Create a sandbox test user in both stores.
3. Sign in with the sandbox account on your test device.
4. Select a paid plan in the app and complete the purchase.
5. Verify the receipt reaches the backend and the user’s tier updates.
