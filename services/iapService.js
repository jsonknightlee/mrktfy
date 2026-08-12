// services/iapService.js
// Native in-app purchase wrapper using react-native-iap.
// This replaces the Stripe payment sheet for subscription purchases on iOS/Android.

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  flushFailedPurchasesCachedAsPendingAndroid,
  getReceiptIOS,
} from 'react-native-iap';

const SUBSCRIPTION_PRODUCTS = {
  prospector: {
    month: {
      ios: process.env.EXPO_PUBLIC_IAP_PROSPECTOR_MONTH_IOS ?? 'com.mrktfy.subscription.buyer.monthly',
      android: process.env.EXPO_PUBLIC_IAP_PROSPECTOR_MONTH_ANDROID ?? 'com.mrktfy.subscription.buyer.monthly',
    },
    year: {
      ios: process.env.EXPO_PUBLIC_IAP_PROSPECTOR_YEAR_IOS ?? 'com.mrktfy.subscription.buyer.yearly',
      android: process.env.EXPO_PUBLIC_IAP_PROSPECTOR_YEAR_ANDROID ?? 'com.mrktfy.subscription.buyer.yearly',
    },
  },
  investor: {
    month: {
      ios: process.env.EXPO_PUBLIC_IAP_INVESTOR_MONTH_IOS ?? 'com.mrktfy.subscription.investor.monthly',
      android: process.env.EXPO_PUBLIC_IAP_INVESTOR_MONTH_ANDROID ?? 'com.mrktfy.subscription.investor.monthly',
    },
    year: {
      ios: process.env.EXPO_PUBLIC_IAP_INVESTOR_YEAR_IOS ?? 'com.mrktfy.subscription.investor.yearly',
      android: process.env.EXPO_PUBLIC_IAP_INVESTOR_YEAR_ANDROID ?? 'com.mrktfy.subscription.investor.yearly',
    },
  },
};

let iapConnectionActive = false;
let purchaseUpdatedSubscription = null;
let purchaseErrorSubscription = null;

const isIapNotAvailableError = (error) =>
  error?.code === 'E_IAP_NOT_AVAILABLE' ||
  /E_IAP_NOT_AVAILABLE/i.test(error?.message || '');

const isInvalidProductError = (error) =>
  error?.code === 'E_IAP_INVALID_PRODUCT_ID' ||
  error?.code === 'E_INVALID_PRODUCT_ID' ||
  /invalid product id|invalid product identifier|invalid sku/i.test(error?.message || '');

const mapIapError = (error) => {
  if (isIapNotAvailableError(error)) {
    return new Error(
      'In-app purchases are not available in this environment. IAP requires a physical iOS/Android device or a native build (not Expo Go or the iOS Simulator).'
    );
  }
  if (isInvalidProductError(error)) {
    return new Error(
      'This subscription product is not available in the App Store / Play Store. Please check that the product is configured, approved, and that you are signed in with a sandbox test account, then try again.'
    );
  }
  return error;
};

const getSku = (tier, billingInterval) => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const product = SUBSCRIPTION_PRODUCTS[tier]?.[billingInterval];
  if (!product) {
    throw new Error(`No IAP product configured for tier "${tier}" and interval "${billingInterval}"`);
  }
  return product[platform];
};

export const getIapProductIds = (tier, billingInterval) => {
  const product = SUBSCRIPTION_PRODUCTS[tier]?.[billingInterval];
  if (!product) return null;
  return { ios: product.ios, android: product.android };
};

export const getIapProductIdsForPlatform = () => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const ids = [];
  for (const tier of Object.values(SUBSCRIPTION_PRODUCTS)) {
    for (const interval of Object.values(tier)) {
      const id = interval[platform];
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
};

export const getIapProductMetadata = (productId) => {
  if (!productId) return null;

  for (const [tier, intervals] of Object.entries(SUBSCRIPTION_PRODUCTS)) {
    for (const [billingInterval, product] of Object.entries(intervals)) {
      if (product.ios === productId || product.android === productId) {
        return {
          tier,
          billingInterval,
          productId,
        };
      }
    }
  }

  return null;
};

export const initIapConnection = async () => {
  if (iapConnectionActive) return true;
  try {
    const connected = await initConnection();
    iapConnectionActive = connected;
    if (Platform.OS === 'android') {
      try {
        await flushFailedPurchasesCachedAsPendingAndroid();
      } catch (err) {
        console.warn('[IAP] Failed to flush pending Android purchases:', err?.message);
      }
    }
    return connected;
  } catch (error) {
    throw mapIapError(error);
  }
};

export const endIapConnection = async () => {
  if (!iapConnectionActive) return;
  cleanupIapListeners();
  await endConnection();
  iapConnectionActive = false;
};

export const fetchIapProducts = async (skus) => {
  await initIapConnection();
  const products = await getSubscriptions({ skus });
  return products;
};

export const setupIapListeners = ({
  onPurchaseUpdated,
  onPurchaseError,
}) => {
  cleanupIapListeners();
  purchaseUpdatedSubscription = purchaseUpdatedListener((purchase) => {
    onPurchaseUpdated?.(purchase);
  });
  purchaseErrorSubscription = purchaseErrorListener((error) => {
    onPurchaseError?.(error);
  });
};

export const cleanupIapListeners = () => {
  if (purchaseUpdatedSubscription) {
    purchaseUpdatedSubscription.remove();
    purchaseUpdatedSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
};

export const requestIapSubscription = async (tier, billingInterval, options = {}) => {
  try {
    await initIapConnection();
    const sku = getSku(tier, billingInterval);

    console.log('[IAP] Looking up subscription for SKU:', sku);
    const subscriptions = await getSubscriptions({ skus: [sku] });
    const product = subscriptions?.find((s) => s.productId === sku);
    if (!product) {
      throw new Error(
        `Product ID "${sku}" was not returned by the App Store / Play Store. Make sure the product is configured and approved, then try again.`
      );
    }

    console.log('[IAP] Requesting subscription for SKU:', sku);
    const request = {
      sku,
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
      ...(options.appAccountToken || options.userId ? { appAccountToken: options.appAccountToken || options.userId } : {}),
    };

    const purchase = await requestSubscription(request);
    return purchase;
  } catch (error) {
    throw mapIapError(error);
  }
};

export const completeIapTransaction = async (purchase) => {
  if (!purchase) return;
  await finishTransaction({ purchase, isConsumable: false });
};

export const extractReceipt = async (purchase) => {
  if (!purchase) return null;
  if (Platform.OS === 'ios') {
    try {
      const receipt = await getReceiptIOS({ forceRefresh: false });
      if (receipt) return receipt;
    } catch (error) {
      console.warn('[IAP] Failed to read cached iOS receipt, retrying with refresh:', error?.message);
    }

    try {
      const refreshedReceipt = await getReceiptIOS({ forceRefresh: true });
      if (refreshedReceipt) return refreshedReceipt;
    } catch (error) {
      console.warn('[IAP] Failed to refresh iOS receipt:', error?.message);
    }

    return purchase.transactionReceipt ?? null;
  }
  if (Platform.OS === 'android') {
    return (
      purchase.purchaseToken ??
      purchase.transactionReceipt ??
      null
    );
  }
  return null;
};

export const restoreIapPurchases = async () => {
  await initIapConnection();
  const purchases = await getAvailablePurchases();
  return purchases || [];
};
