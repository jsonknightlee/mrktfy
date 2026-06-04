import { StripeProvider as StripeProviderExpo, useStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import React, { useState, useEffect } from 'react';

// Stripe publishable key from environment
const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY ||
  '';
const APPLE_MERCHANT_ID =
  process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ||
  Constants.expoConfig?.extra?.APPLE_MERCHANT_ID ||
  '';
const ENABLE_APPLE_PAY =
  process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === 'true' ||
  Constants.expoConfig?.extra?.ENABLE_APPLE_PAY === true;

// Stripe Provider component
export const StripeProvider = ({ children }) => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('⚠️ Stripe publishable key not found in environment variables');
  }

  return (
    <StripeProviderExpo
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={APPLE_MERCHANT_ID || undefined}
    >
      {children}
    </StripeProviderExpo>
  );
};

// Hook to initialize payment sheet
export const useStripePaymentSheet = () => {
  const { initPaymentSheet, presentPaymentSheet, loading } = usePaymentSheet();

  const initializePaymentSheet = async ({ paymentIntent, setupIntent, ephemeralKey, customer, applePayConfig, primaryButtonLabel }) => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      return { success: false, error: 'Stripe publishable key is not configured' };
    }

    if (!paymentIntent && !setupIntent) {
      return { success: false, error: 'Missing Stripe intent client secret' };
    }

    const setupParams = {
      merchantDisplayName: 'Mrktfy',
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: {
        name: 'Mrktfy User',
      },
      returnURL: 'mrktfy://stripe-redirect',
      primaryButtonLabel,
    };

    if (ENABLE_APPLE_PAY && applePayConfig) {
      setupParams.applePay = applePayConfig;
    }

    if (paymentIntent) {
      setupParams.paymentIntentClientSecret = paymentIntent;
    } else {
      setupParams.setupIntentClientSecret = setupIntent;
    }

    if (customer) {
      setupParams.customerId = customer;
    }

    if (ephemeralKey) {
      setupParams.customerEphemeralKeySecret = ephemeralKey;
    }

    const { error } = await initPaymentSheet(setupParams);

    if (error) {
      console.error('❌ Payment sheet initialization error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();

    if (error) {
      console.error('❌ Payment sheet presentation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  return {
    initializePaymentSheet,
    openPaymentSheet,
    loading,
  };
};

// Service for creating payment intents (call your backend)
export const createPaymentIntent = async (amount, currency = 'gbp', metadata = {}) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        amount,
        currency,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment intent creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    throw error;
  }
};

// Service for creating customer (call your backend)
export const createCustomer = async (email, name) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        email,
        name,
      }),
    });

    if (!response.ok) {
      throw new Error(`Customer creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Customer creation error:', error);
    throw error;
  }
};

// Service for creating Ephemeral Key (call your backend)
export const createEphemeralKey = async (customerId) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-ephemeral-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        customerId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ephemeral key creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Ephemeral key creation error:', error);
    throw error;
  }
};

// Helper to format amount for Stripe (in cents/pence)
export const formatAmount = (amount) => {
  return Math.round(amount * 100);
};

// Helper to create Apple Pay configuration
export const createApplePayConfig = (tier, billingInterval) => {
  if (!ENABLE_APPLE_PAY || !APPLE_MERCHANT_ID) {
    return null;
  }

  const price = tier?.prices?.[billingInterval];
  const amount = (price?.amount / 100).toFixed(2); // Convert from pence to pounds
  const interval = billingInterval === 'month' ? 'per month' : 'per year';
  const intervalUnit = billingInterval === 'month' ? 'month' : 'year';
  
  return {
    merchantCountryCode: 'GB',
    currencyCode: 'GBP',
    cartItems: [
      {
        paymentType: 'Recurring',
        intervalUnit,
        intervalCount: 1,
        startDate: Math.floor(Date.now() / 1000),
        label: `${tier?.name} (${interval})`,
        amount: amount,
      },
    ],
  };
};

// Complete payment flow
export const processPayment = async (amount, currency, metadata) => {
  try {
    // 1. Create payment intent
    const paymentIntentResponse = await createPaymentIntent(
      formatAmount(amount),
      currency,
      metadata
    );

    return paymentIntentResponse;
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    throw error;
  }
};
