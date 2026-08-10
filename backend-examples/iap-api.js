// Example In-App Purchase (IAP) API endpoints for your Node.js backend
// This replaces the Stripe subscription creation/confirm flow with native
// App Store (StoreKit) and Google Play Billing validation.
//
// Endpoints:
//   POST /api/iap/validate-purchase
//   POST /api/subscriptions/cancel
//   POST /api/subscriptions/reactivate

const express = require('express');
const { google } = require('googleapis'); // npm install googleapis

const router = express.Router();

// -------------------------------------------------------------------------
// Configuration - replace with your real credentials
// -------------------------------------------------------------------------

const APPLE_CONFIG = {
  // App Store shared secret from App Store Connect > App > App Information
  sharedSecret: process.env.APPLE_SHARED_SECRET || '',
  bundleId: 'com.mrktfy.mrktfy',
  // Use sandbox for TestFlight/dev, production for App Store builds
  verifyUrl: process.env.APPLE_VERIFY_URL || 'https://sandbox.itunes.apple.com/verifyReceipt',
};

const GOOGLE_CONFIG = {
  // Path to the service account JSON from Google Play Console
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account.json',
  packageName: 'com.mrktfy.mrktfy',
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

const db = {
  // Replace this with your actual SQL Server / mssql query wrapper
  query: async (sql, params) => {
    throw new Error('Replace db.query with your real database driver implementation');
  },
};

const tierFromProductId = (productId) => {
  if (productId.includes('prospector') || productId.includes('buyer')) return 'prospector';
  if (productId.includes('investor')) return 'investor';
  return null;
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const computeEndDate = ({ platform, tier, billingInterval, isTrial }) => {
  const now = new Date();
  const trialDays = !isTrial ? 0 : 3;
  const intervalMonths = billingInterval === 'year' ? 12 : 1;
  // For StoreKit/Play the first paid period starts after any trial.
  const periodEnd = addMonths(addDays(now, trialDays), intervalMonths);
  return periodEnd;
};

// -------------------------------------------------------------------------
// Apple receipt validation
// -------------------------------------------------------------------------

const validateAppleReceipt = async (receipt) => {
  const response = await fetch(APPLE_CONFIG.verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receipt,
      password: APPLE_CONFIG.sharedSecret,
      'exclude-old-transactions': true,
    }),
  });

  const data = await response.json();

  if (data.status !== 0) {
    throw new Error(`Apple receipt validation failed with status ${data.status}`);
  }

  if (data.receipt.bundle_id !== APPLE_CONFIG.bundleId) {
    throw new Error('Apple receipt bundle_id mismatch');
  }

  // Find the latest in-app subscription transaction in the receipt
  const transactions = data.receipt.in_app || [];
  const latest = transactions
    .filter((tx) => tx.product_id && tx.product_id.includes('subscription'))
    .sort((a, b) => parseInt(b.original_transaction_id, 10) - parseInt(a.original_transaction_id, 10))[0];

  if (!latest) {
    throw new Error('No subscription transaction found in Apple receipt');
  }

  const isTrial = latest.is_trial_period === 'true';
  const productId = latest.product_id;

  return {
    productId,
    transactionId: latest.original_transaction_id || latest.transaction_id,
    isTrial,
    valid: true,
  };
};

// -------------------------------------------------------------------------
// Google Play validation
// -------------------------------------------------------------------------

const validateGooglePurchase = async ({ productId, purchaseToken }) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_CONFIG.keyFile,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  const { data } = await androidpublisher.purchases.subscriptions.get({
    packageName: GOOGLE_CONFIG.packageName,
    subscriptionId: productId,
    token: purchaseToken,
  });

  if (data.paymentState !== 1 && data.paymentState !== 2) {
    throw new Error('Google subscription payment state is not paid or pending');
  }

  const isTrial = data.startTimeMillis === data.expiryTimeMillis; // crude trial heuristic

  return {
    productId,
    transactionId: purchaseToken,
    isTrial,
    valid: true,
  };
};

// -------------------------------------------------------------------------
// Endpoint: Validate in-app purchase and activate subscription
// -------------------------------------------------------------------------

router.post('/api/iap/validate-purchase', async (req, res) => {
  try {
    const {
      userId,
      tier,
      billingInterval,
      platform,
      receipt,
      productId,
      transactionId,
      reactivate,
    } = req.body;

    if (!userId || !tier || !billingInterval || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let validation;

    if (platform === 'ios') {
      // `receipt` for iOS is the base64 App Store receipt or a StoreKit 2 JWS.
      // This example uses the legacy /verifyReceipt endpoint, which works for
      // base64 receipts. For StoreKit 2 JWTs, use App Store Server API V2.
      validation = await validateAppleReceipt(receipt);
    } else if (platform === 'android') {
      if (!productId || !receipt) {
        return res.status(400).json({ error: 'Missing productId or purchaseToken for Android' });
      }
      validation = await validateGooglePurchase({ productId, purchaseToken: receipt });
    } else {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const validatedProductId = validation.productId || productId;
    const validatedTier = tierFromProductId(validatedProductId) || tier;

    const isTrial = !reactivate && validation.isTrial;
    const endDate = computeEndDate({ platform, tier: validatedTier, billingInterval, isTrial });

    // Update the user profile with the new subscription.
    // Adjust the SQL to match your actual database columns and driver.
    await db.query(
      `UPDATE Profile
       SET SubscriptionLevelID = @tier,
           SubscriptionStartDate = GETDATE(),
           SubscriptionEndDate = @endDate,
           IsSubscriptionActive = 1,
           UpdatedAt = GETDATE()
       WHERE UserID = @userId`,
      [
        { name: 'tier', value: validatedTier },
        { name: 'endDate', value: endDate },
        { name: 'userId', value: userId },
      ]
    );

    // Return the same normalized shape the Stripe flow used so the app
    // can continue with its existing success path.
    res.json({
      success: true,
      subscription: {
        id: validation.transactionId || transactionId,
        status: isTrial ? 'trialing' : 'active',
      },
      subscriptionId: validation.transactionId || transactionId,
      status: isTrial ? 'trialing' : 'active',
    });
  } catch (error) {
    console.error('IAP validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------------
// Endpoint: Cancel subscription
// -------------------------------------------------------------------------

router.post('/api/subscriptions/cancel', async (req, res) => {
  try {
    const { userId, cancelAtPeriodEnd = true } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Note: Apple does not allow cancelling a subscription from the app.
    // Users must cancel in iOS Settings. This endpoint records the intent
    // and stops auto-renew / marks the profile in the database.
    const endDate = cancelAtPeriodEnd
      ? '(SELECT SubscriptionEndDate FROM Profile WHERE UserID = @userId)'
      : 'GETDATE()';

    await db.query(
      `UPDATE Profile
       SET IsSubscriptionActive = 0,
           SubscriptionEndDate = ${endDate},
           UpdatedAt = GETDATE()
       WHERE UserID = @userId`,
      [{ name: 'userId', value: userId }]
    );

    res.json({ success: true, cancelled: true });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------------------
// Endpoint: Reactivate subscription
// -------------------------------------------------------------------------

router.post('/api/subscriptions/reactivate', async (req, res) => {
  try {
    const { userId, subscriptionId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // This only flips the database flag. Reactivation must also still be valid
    // in the App Store / Play Store. The backend should ideally re-validate the
    // latest receipt or token before extending SubscriptionEndDate.
    await db.query(
      `UPDATE Profile
       SET IsSubscriptionActive = 1,
           UpdatedAt = GETDATE()
       WHERE UserID = @userId`,
      [{ name: 'userId', value: userId }]
    );

    res.json({
      success: true,
      reactivated: true,
      subscription: {
        id: subscriptionId,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Subscription reactivate error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
