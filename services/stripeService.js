import { StripeProvider as StripeProviderExpo, useStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import React, { useState, useEffect } from 'react';

// Stripe publishable key from environment
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Stripe Provider component
export const StripeProvider = ({ children }) => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('⚠️ Stripe publishable key not found in environment variables');
  }

  return (
    <StripeProviderExpo
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.yourcompany.mrktfy"
    >
      {children}
    </StripeProviderExpo>
  );
};

// Hook to initialize payment sheet
export const useStripePaymentSheet = () => {
  const { initPaymentSheet, presentPaymentSheet, loading } = usePaymentSheet();

  const initializePaymentSheet = async ({ paymentIntent, ephemeralKey, customer, applePayConfig }) => {
    // In development mode, skip payment sheet initialization entirely
    // and simulate successful initialization
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development' && paymentIntent.includes('test')) {
      console.log('🔧 Development mode: Skipping payment sheet initialization');
      
      // Simulate a brief delay to show loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true };
    }

    const { error } = await initPaymentSheet({
      paymentIntentClientSecret: paymentIntent,
      customer,
      ephemeralKey,
      merchantDisplayName: 'Mrktfy',
      allowsDelayedPaymentMethods: true,
      defaultBillingDetails: {
        name: 'Mrktfy User',
      },
      // Apple Pay configuration (dynamic)
      applePay: applePayConfig,
      // Enable Apple Pay and other payment methods
      paymentMethodTypes: ['card', 'apple_pay'],
      // Return URL for iOS redirects
      returnURL: 'mrktfy://stripe-redirect',
    });

    if (error) {
      console.error('❌ Payment sheet initialization error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const openPaymentSheet = async () => {
    // In development mode, simulate payment sheet presentation
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 Development mode: Simulating payment sheet presentation');
      
      // Simulate a brief delay to show the payment UI
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    }

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

    const response = await fetch(`${API_BASE_URL}/api/payments/create-payment-intent`, {
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

    const response = await fetch(`${API_BASE_URL}/api/payments/create-customer`, {
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

    const response = await fetch(`${API_BASE_URL}/api/payments/create-ephemeral-key`, {
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
  const price = tier?.prices?.[billingInterval];
  const amount = (price?.amount / 100).toFixed(2); // Convert from pence to pounds
  const interval = billingInterval === 'month' ? 'per month' : 'per year';
  
  return {
    merchantId: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID || 'merchant.com.mrktfy',
    merchantCountryCode: 'GB',
    currencyCode: 'GBP',
    paymentSummaryItems: [
      {
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
