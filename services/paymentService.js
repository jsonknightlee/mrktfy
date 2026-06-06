import { getToken } from '../utils/tokenStorage';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

const getPaymentConfig = () => ({
  apiBaseUrl: extra.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL,
  apiKey: extra.API_KEY || process.env.EXPO_PUBLIC_API_KEY,
});

const buildHeaders = async () => {
  const { apiKey } = getPaymentConfig();
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!response.ok) {
    let errorBody = text;
    try {
      errorBody = JSON.parse(text);
    } catch {
      // Keep the raw response text.
    }

    const message =
      typeof errorBody === 'object'
        ? errorBody.error || errorBody.message || JSON.stringify(errorBody)
        : errorBody || response.statusText;

    throw new Error(`Stripe backend request failed (${response.status}): ${message}`);
  }

  if (!text) {
    return {};
  }

  return JSON.parse(text);
};

const requestPaymentJson = async (path, body) => {
  const { apiBaseUrl } = getPaymentConfig();

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  }

  console.log('💳 [STRIPE] Backend request:', `${apiBaseUrl}${path}`);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
};

const getNestedValue = (value, keys) => {
  for (const key of keys) {
    if (value?.[key] != null) {
      return value[key];
    }
  }

  return null;
};

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  return atob(padded);
};

const getTokenUserId = async () => {
  try {
    const token = await getToken();
    const payload = token?.split('.')?.[1];
    if (!payload) return null;

    const decoded = JSON.parse(decodeBase64Url(payload));
    return decoded.ID || decoded.id || decoded.userId || decoded.UserID || decoded.sub || null;
  } catch (error) {
    console.warn('⚠️ Unable to read userId from auth token:', error.message);
    return null;
  }
};

const normalizeSubscriptionPayment = (data) => {
  const payload = data?.data ?? data;
  const customerValue = getNestedValue(payload, ['customer', 'customerId']);
  const ephemeralValue = getNestedValue(payload, ['ephemeralKey', 'ephemeralKeySecret', 'customerEphemeralKeySecret']);
  const nestedInvoicePaymentIntent = payload.subscription?.latest_invoice?.payment_intent;
  const nestedSetupIntent = payload.subscription?.pending_setup_intent;
  const paymentIntentValue =
    getNestedValue(payload, ['paymentIntent', 'paymentIntentClientSecret', 'clientSecret']) ||
    nestedInvoicePaymentIntent ||
    payload.latest_invoice?.payment_intent;
  const setupIntentValue =
    getNestedValue(payload, ['setupIntent', 'setupIntentClientSecret']) ||
    nestedSetupIntent ||
    payload.pending_setup_intent;

  return {
    paymentIntent:
      typeof paymentIntentValue === 'string'
        ? paymentIntentValue
        : paymentIntentValue?.client_secret || paymentIntentValue?.clientSecret || null,
    setupIntent:
      typeof setupIntentValue === 'string'
        ? setupIntentValue
        : setupIntentValue?.client_secret || setupIntentValue?.clientSecret || null,
    ephemeralKey:
      typeof ephemeralValue === 'string'
        ? ephemeralValue
        : ephemeralValue?.secret || ephemeralValue?.clientSecret || null,
    customer:
      typeof customerValue === 'string'
        ? customerValue
        : customerValue?.id || null,
    subscriptionId: payload.subscriptionId || payload.subscription?.id || null,
    paymentIntentId: payload.paymentIntentId || payload.paymentIntent?.id || paymentIntentValue?.id || nestedInvoicePaymentIntent?.id || null,
    setupIntentId: payload.setupIntentId || payload.setupIntent?.id || setupIntentValue?.id || nestedSetupIntent?.id || null,
    status: payload.status || payload.subscription?.status || null,
  };
};

const getProfileUserId = (userProfile) => (
  userProfile?.userId ||
  userProfile?.UserID ||
  userProfile?.UserId ||
  userProfile?.user?.id ||
  userProfile?.User?.ID ||
  userProfile?.authUserId ||
  userProfile?.AuthUserID ||
  userProfile?.id ||
  userProfile?.ID ||
  userProfile?.ProfileID ||
  null
);

const toNonEmptyString = (value) => {
  if (value == null) return null;

  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
};

// Create payment intent (call your backend)
export const createPaymentIntent = async (amount, currency = 'gbp', metadata = {}) => {
  try {
    const data = await requestPaymentJson('/api/stripe/create-payment-intent', {
      amount,
      currency,
      metadata,
      userId: metadata.userId,
      subscriptionLevelId: metadata.subscriptionLevelId || metadata.tier,
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    return { success: false, error: error.message };
  }
};

// Create customer (call your backend)
export const createCustomer = async (email, name) => {
  try {
    const data = await requestPaymentJson('/api/stripe/create-customer', {
      email,
      name,
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Customer creation error:', error);
    return { success: false, error: error.message };
  }
};

// Create ephemeral key (call your backend)
export const createEphemeralKey = async (customerId) => {
  try {
    const data = await requestPaymentJson('/api/stripe/create-ephemeral-key', {
      customerId,
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Ephemeral key creation error:', error);
    return { success: false, error: error.message };
  }
};

// Complete payment flow for subscription
export const processSubscriptionPayment = async (tier, billingInterval, userEmail, userName, userProfile = null) => {
  try {
    const userId = toNonEmptyString(getProfileUserId(userProfile) || await getTokenUserId());
    const subscriptionLevelId = toNonEmptyString(tier.key);
    const interval = toNonEmptyString(billingInterval);

    if (!userId) {
      throw new Error('Missing userId for Stripe payment. Please sign out and sign back in.');
    }

    const subscriptionResult = await requestPaymentJson('/api/stripe/create-subscription', {
      tier: subscriptionLevelId,
      subscriptionLevelId,
      billingInterval: interval,
      userId,
      amount: tier.prices[billingInterval].amount / 100,
      currency: 'gbp',
      customer: {
        email: userEmail,
        name: userName,
      },
      metadata: {
        userId,
        subscriptionLevelId,
        billingInterval: interval,
      },
      trialDays: tier.trial?.enabled ? tier.trial.durationDays : 0,
      collectPaymentMethodForTrial: !!tier.trial?.enabled,
    });

    const normalized = normalizeSubscriptionPayment(subscriptionResult);

    if (!normalized.paymentIntent && !normalized.setupIntent) {
      const missingSecretMessage = tier.trial?.enabled
        ? 'Stripe backend created the trial but did not return a setupIntent client secret for card collection'
        : 'Stripe backend did not return a paymentIntent client secret';
      throw new Error(missingSecretMessage);
    }

    return {
      success: true,
      requiresPaymentSheet: true,
      ...normalized,
    };
  } catch (error) {
    console.error('❌ Subscription payment processing error:', error);
    return { success: false, error: error.message };
  }
};

// Webhooks are the source of truth for Stripe subscription updates.
export const confirmSubscriptionPayment = async (paymentIntentId, tier, billingInterval) => {
  return {
    success: true,
    data: { paymentIntentId, tier, billingInterval, handledByWebhook: true },
  };
};

export const cancelStripeSubscription = async ({
  userId,
  subscriptionId,
  cancelAtPeriodEnd = true,
} = {}) => {
  try {
    const data = await requestPaymentJson('/api/stripe/cancel-subscription', {
      userId: toNonEmptyString(userId),
      subscriptionId: toNonEmptyString(subscriptionId),
      cancelAtPeriodEnd,
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Stripe subscription cancellation error:', error);
    return { success: false, error: error.message };
  }
};
