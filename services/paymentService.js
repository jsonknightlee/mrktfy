import { getToken } from '../utils/tokenStorage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requestIapSubscription, extractReceipt, completeIapTransaction, restoreIapPurchases, getIapProductMetadata } from './iapService';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

const getPurchaseTimestamp = (purchase) => {
  const rawTimestamp =
    purchase?.transactionDate ||
    purchase?.purchaseDate ||
    purchase?.date ||
    purchase?.transactionTime ||
    0;

  const parsed = Number(rawTimestamp);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getPaymentConfig = () => ({
  apiBaseUrl: extra.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL,
  apiBackupBaseUrl: extra.API_BACKUP_BASE_URL || process.env.EXPO_PUBLIC_API_BACKUP_BASE_URL,
  apiKey: extra.API_KEY || process.env.EXPO_PUBLIC_API_KEY,
});

const PAYMENT_BACKEND_TIMEOUT_MS = 8000;

const fetchWithTimeout = async (url, options, timeoutMs = PAYMENT_BACKEND_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

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
  const { apiBaseUrl, apiBackupBaseUrl } = getPaymentConfig();

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  }

  console.log('💳 [STRIPE] Backend request:', `${apiBaseUrl}${path}`);

  const requestOptions = {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  };

  let response;
  try {
    response = await fetchWithTimeout(`${apiBaseUrl}${path}`, requestOptions);
  } catch (error) {
    if (!apiBackupBaseUrl) throw error;
    console.log('💳 [STRIPE] Primary backend failed, retrying backup:', `${apiBackupBaseUrl}${path}`, error.message);
    response = await fetchWithTimeout(`${apiBackupBaseUrl}${path}`, requestOptions);
  }

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
    upgraded: Boolean(payload.upgraded || payload.subscriptionUpgraded || payload.planChanged),
  };
};

const isCompletedSubscriptionStatus = (status) => (
  ['active', 'trialing'].includes(String(status || '').toLowerCase())
);

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

const getProfileStripeSubscriptionId = (userProfile) => (
  userProfile?.StripeSubscriptionID ||
  userProfile?.stripeSubscriptionId ||
  userProfile?.subscriptionId ||
  null
);

const getProfileStripeCustomerId = (userProfile) => (
  userProfile?.StripeCustomerID ||
  userProfile?.stripeCustomerId ||
  userProfile?.customerId ||
  null
);

const IAP_CUSTOMER_TOKEN_PREFIX = 'iap_customer_token';

const isUuidLike = (value) => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value).trim());
};

const generateIapCustomerToken = () => {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  if (globalThis?.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const makeSafeStorageKeySegment = (value) => {
  const raw = toNonEmptyString(value) || 'current-user';
  let hash = 2166136261;

  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `u_${(hash >>> 0).toString(36)}`;
};

const getIapCustomerStorageKey = (userId) => `${IAP_CUSTOMER_TOKEN_PREFIX}_${makeSafeStorageKeySegment(userId)}`;

const resolveIapCustomerToken = async (userProfile = null, userId = null) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const profileToken = toNonEmptyString(
    userProfile?.IAPCustomerID ||
    userProfile?.iapCustomerId ||
    userProfile?.IAPCustomerId ||
    userProfile?.appAccountToken
  );

  if (isUuidLike(profileToken)) {
    const storageKey = getIapCustomerStorageKey(userId || getProfileUserId(userProfile) || await getTokenUserId());
    try {
      await SecureStore.setItemAsync(storageKey, profileToken);
    } catch (error) {
      console.warn('⚠️ Unable to cache backend IAP customer token:', error.message);
    }
    return profileToken;
  }

  const resolvedUserId = toNonEmptyString(userId || getProfileUserId(userProfile) || await getTokenUserId());
  if (!resolvedUserId) {
    return null;
  }

  const storageKey = getIapCustomerStorageKey(resolvedUserId);
  try {
    const storedToken = toNonEmptyString(await SecureStore.getItemAsync(storageKey));
    if (isUuidLike(storedToken)) {
      return storedToken;
    }

    const generatedToken = generateIapCustomerToken();
    await SecureStore.setItemAsync(storageKey, generatedToken);
    return generatedToken;
  } catch (error) {
    console.warn('⚠️ Unable to resolve IAP customer token from storage:', error.message);
    return generateIapCustomerToken();
  }
};

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

// Complete payment flow for subscription using native in-app purchases
export const processSubscriptionPayment = async (tier, billingInterval, userEmail, userName, userProfile = null, options = {}) => {
  try {
    const userId = toNonEmptyString(getProfileUserId(userProfile) || await getTokenUserId());
    const subscriptionLevelId = toNonEmptyString(tier.key);
    const interval = toNonEmptyString(billingInterval);
    const appAccountToken = await resolveIapCustomerToken(userProfile, userId);

    if (!userId) {
      throw new Error('Missing userId for in-app purchase. Please sign out and sign back in.');
    }

    if (!['prospector', 'investor'].includes(subscriptionLevelId)) {
      throw new Error(`IAP is not configured for tier "${subscriptionLevelId}"`);
    }

    const purchase = await requestIapSubscription(subscriptionLevelId, interval, { appAccountToken });
    if (!purchase) {
      throw new Error('No purchase returned from App Store / Play Store.');
    }

    const receipt = await extractReceipt(purchase);
    if (!receipt) {
      throw new Error('Purchase completed but no receipt/purchase token was returned.');
    }

    const validationResult = await requestPaymentJson('/api/iap/validate-purchase', {
      userId,
      tier: subscriptionLevelId,
      subscriptionLevelId,
      billingInterval: interval,
      platform: Platform.OS,
      receipt,
      productId: purchase.productId ?? null,
      transactionId: purchase.transactionId ?? null,
      appAccountToken,
      reactivate: !!options.reactivate,
    });

    const normalized = normalizeSubscriptionPayment(validationResult);
    if (!isCompletedSubscriptionStatus(normalized.status)) {
      throw new Error(
        validationResult?.error ||
        'Your payment could not be verified. Please try again or contact support.'
      );
    }

    await completeIapTransaction(purchase);

    return {
      success: true,
      requiresPaymentSheet: false,
      ...normalized,
    };
  } catch (error) {
    console.error('❌ In-app subscription processing error:', error);
    return { success: false, error: error.message };
  }
};

export const syncIapSubscriptionState = async (userProfile = null) => {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return { success: true, synced: false, skipped: true, reason: 'unsupported_platform' };
    }

    const userId = toNonEmptyString(getProfileUserId(userProfile) || await getTokenUserId());
    const appAccountToken = await resolveIapCustomerToken(userProfile, userId);
    if (!userId) {
      return { success: false, synced: false, skipped: true, error: 'Missing userId for IAP sync' };
    }

    const purchases = await restoreIapPurchases();
    const relevantPurchases = (purchases || [])
      .map((purchase) => ({
        purchase,
        metadata: getIapProductMetadata(purchase?.productId),
      }))
      .filter(({ metadata }) => Boolean(metadata));

    if (!relevantPurchases.length) {
      return { success: true, synced: false, purchases: [] };
    }

    const latest = relevantPurchases
      .sort((a, b) => getPurchaseTimestamp(b.purchase) - getPurchaseTimestamp(a.purchase))[0];

    const { purchase, metadata } = latest;
    const receipt = await extractReceipt(purchase);
    if (!receipt) {
      throw new Error('Unable to read the active App Store / Play Store receipt for subscription sync.');
    }

    const validationResult = await requestPaymentJson('/api/iap/validate-purchase', {
      userId,
      tier: metadata.tier,
      subscriptionLevelId: metadata.tier,
      billingInterval: metadata.billingInterval,
      platform: Platform.OS,
      receipt,
      productId: purchase.productId ?? null,
      transactionId: purchase.transactionId ?? null,
      appAccountToken,
      reactivate: false,
      source: 'iap-sync',
    });

    const normalized = normalizeSubscriptionPayment(validationResult);
    if (!isCompletedSubscriptionStatus(normalized.status)) {
      return {
        success: false,
        synced: false,
        error: validationResult?.error || 'IAP subscription sync could not be verified.',
      };
    }

    return {
      success: true,
      synced: true,
      purchase,
      metadata,
      ...normalized,
    };
  } catch (error) {
    console.error('❌ IAP subscription sync error:', error);
    return { success: false, synced: false, error: error.message };
  }
};

export const confirmSubscriptionPayment = async () => {
  // Legacy Stripe confirmation step; no longer used with in-app purchases.
  // Kept for backwards compatibility in case older call sites still import it.
  return { success: true, data: {} };
};

export const cancelStripeSubscription = async ({
  userId,
  subscriptionId,
  cancelAtPeriodEnd = true,
} = {}) => {
  try {
    const data = await requestPaymentJson('/api/subscriptions/cancel', {
      userId: toNonEmptyString(userId),
      subscriptionId: toNonEmptyString(subscriptionId),
      cancelAtPeriodEnd,
    });

    return { success: true, data };
  } catch (error) {
    console.error('❌ Subscription cancellation error:', error);
    return { success: false, error: error.message };
  }
};

export const reactivateStripeSubscription = async ({
  userId,
  subscriptionId,
} = {}) => {
  try {
    const data = await requestPaymentJson('/api/subscriptions/reactivate', {
      userId: toNonEmptyString(userId),
      subscriptionId: toNonEmptyString(subscriptionId),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Subscription reactivation error:', error);
    return { success: false, error: error.message };
  }
};
