// Payment service for handling Stripe payments
// This service would typically call your backend API

import { formatAmount } from './stripeService';

// Mock backend responses for development
const mockResponses = {
  paymentIntent: {
    paymentIntent: 'pi_test_1234567890_secret_test_1234567890abcdefghijklmnopqrstuvwxyz',
    ephemeralKey: 'ephkey_mock_12345',
    customer: 'cus_mock_12345',
  },
  customer: {
    id: 'cus_mock_12345',
    email: 'test@example.com',
  },
};

// Create payment intent (call your backend)
export const createPaymentIntent = async (amount, currency = 'gbp', metadata = {}) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    // For development, return mock data
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 Development mode: Using mock payment intent');
      return {
        success: true,
        data: {
          clientSecret: mockResponses.paymentIntent.paymentIntent,
          paymentIntentId: 'pi_mock_12345',
        },
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        amount: formatAmount(amount),
        currency,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment intent creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    return { success: false, error: error.message };
  }
};

// Create customer (call your backend)
export const createCustomer = async (email, name) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    // For development, return mock data
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 Development mode: Using mock customer');
      return {
        success: true,
        data: mockResponses.customer,
      };
    }

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
    return { success: true, data };
  } catch (error) {
    console.error('❌ Customer creation error:', error);
    return { success: false, error: error.message };
  }
};

// Create ephemeral key (call your backend)
export const createEphemeralKey = async (customerId) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    // For development, return mock data
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 Development mode: Using mock ephemeral key');
      return {
        success: true,
        data: mockResponses.paymentIntent.ephemeralKey,
      };
    }

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
    return { success: true, data };
  } catch (error) {
    console.error('❌ Ephemeral key creation error:', error);
    return { success: false, error: error.message };
  }
};

// Complete payment flow for subscription
export const processSubscriptionPayment = async (tier, billingInterval, userEmail, userName) => {
  try {
    // 1. Create customer
    const customerResult = await createCustomer(userEmail, userName);
    if (!customerResult.success) {
      throw new Error(customerResult.error);
    }

    // 2. Create payment intent
    const amount = tier.prices[billingInterval].amount / 100; // Convert from pence to pounds
    const paymentIntentResult = await createPaymentIntent(amount, 'gbp', {
      tier: tier.key,
      billingInterval,
      customer: customerResult.data.id,
    });

    if (!paymentIntentResult.success) {
      throw new Error(paymentIntentResult.error);
    }

    // 3. Create ephemeral key
    const ephemeralKeyResult = await createEphemeralKey(customerResult.data.id);
    if (!ephemeralKeyResult.success) {
      throw new Error(ephemeralKeyResult.error);
    }

    return {
      success: true,
      paymentIntent: paymentIntentResult.data.clientSecret,
      ephemeralKey: ephemeralKeyResult.data,
      customer: customerResult.data.id,
    };
  } catch (error) {
    console.error('❌ Subscription payment processing error:', error);
    return { success: false, error: error.message };
  }
};

// Confirm payment and update subscription
export const confirmSubscriptionPayment = async (paymentIntentId, tier, billingInterval) => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
    const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

    // For development, just return success
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 Development mode: Mock payment confirmation');
      return { success: true };
    }

    const response = await fetch(`${API_BASE_URL}/api/payments/confirm-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        paymentIntentId,
        tier,
        billingInterval,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment confirmation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('❌ Payment confirmation error:', error);
    return { success: false, error: error.message };
  }
};
