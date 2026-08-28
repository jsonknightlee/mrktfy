// services/iapService.js
// Native in-app purchase wrapper using react-native-iap.
// This replaces the Stripe payment sheet for subscription purchases on iOS/Android.

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  getReceiptDataIOS,
  requestReceiptRefreshIOS,
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

const getAndroidSubscriptionOfferCandidates = (product) => {
  if (!product || typeof product !== 'object') return [];

  const candidateFields = [
    product.subscriptionOffers,
    product.subscriptionOfferDetails,
    product.subscriptionOfferDetailsAndroid,
    product.offers,
  ];

  for (const field of candidateFields) {
    if (Array.isArray(field) && field.length > 0) {
      return field;
    }
  }

  return [];
};

const selectAndroidSubscriptionOffer = (product) => {
  const offers = getAndroidSubscriptionOfferCandidates(product);
  if (offers.length === 0) return null;

  const candidatePlanIds = new Set(
    [product?.basePlanId, product?.basePlanIdAndroid, product?.currentPlanId]
      .filter((value) => typeof value === 'string' && value.trim() !== '')
      .map((value) => value.trim())
  );

  const normalizedOffers = offers
    .map((offer, index) => {
      if (!offer || typeof offer !== 'object') return null;

      const offerToken =
        offer.offerToken ??
        offer.offerTokenAndroid ??
        offer.token ??
        null;

      if (typeof offerToken !== 'string' || offerToken.trim() === '') {
        return null;
      }

      const basePlanId =
        offer.basePlanId ??
        offer.basePlanIdAndroid ??
        offer.basePlan ??
        null;

      const normalizedBasePlanId =
        typeof basePlanId === 'string' && basePlanId.trim() !== ''
          ? basePlanId.trim()
          : null;

      return {
        sku: product.productId,
        offerToken: offerToken.trim(),
        isDefault: Boolean(offer.isDefault ?? offer.defaultOffer ?? offer.isSelected),
        hasMatchingBasePlan:
          normalizedBasePlanId != null && candidatePlanIds.has(normalizedBasePlanId),
        index,
      };
    })
    .filter(Boolean);

  if (normalizedOffers.length === 0) return null;

  normalizedOffers.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.hasMatchingBasePlan !== b.hasMatchingBasePlan) {
      return a.hasMatchingBasePlan ? -1 : 1;
    }
    return a.index - b.index;
  });

  return normalizedOffers[0];
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
  const products = await fetchProducts({ skus, type: 'subs' });
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
    const subscriptions = await fetchProducts({ skus: [sku], type: 'subs' });
    const product = subscriptions?.find((s) => s.productId === sku);
    if (!product) {
      throw new Error(
        `Product ID "${sku}" was not returned by the App Store / Play Store. Make sure the product is configured and approved, then try again.`
      );
    }

    let androidSubscriptionOffer = null;
    if (Platform.OS === 'android') {
      androidSubscriptionOffer = selectAndroidSubscriptionOffer(product);
      if (!androidSubscriptionOffer) {
        throw new Error(
          `No eligible Android subscription offer was returned for SKU "${sku}". Check the Play Console base plans and offers, then try again.`
        );
      }
    }

    console.log('[IAP] Requesting subscription for SKU:', sku);
    const purchase = await requestPurchase({
      type: 'subs',
      request: {
        apple: {
          sku,
          andDangerouslyFinishTransactionAutomatically: false,
          ...(options.appAccountToken || options.userId
            ? { appAccountToken: options.appAccountToken || options.userId }
            : {}),
        },
        google: {
          skus: [sku],
          ...(androidSubscriptionOffer
            ? { subscriptionOffers: [androidSubscriptionOffer] }
            : {}),
          ...(options.appAccountToken || options.userId
            ? {
                obfuscatedAccountId: options.appAccountToken || options.userId,
                obfuscatedProfileId: options.appAccountToken || options.userId,
              }
            : {}),
        },
      },
    });
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
      const receipt = await getReceiptDataIOS();
      if (receipt) return receipt;
    } catch (error) {
      console.warn('[IAP] Failed to read cached iOS receipt, retrying with refresh:', error?.message);
    }

    try {
      const refreshedReceipt = await requestReceiptRefreshIOS();
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
