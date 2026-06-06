import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripePaymentSheet, createApplePayConfig } from '../services/stripeService';
import { useSubscription } from '../contexts/SubscriptionContext';
import { processSubscriptionPayment, confirmSubscriptionPayment } from '../services/paymentService';

export default function PaymentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { tier, billingInterval = 'month' } = route.params || {};
  const { reloadSubscriptionData, userProfile } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [stripeIntentId, setStripeIntentId] = useState(null);
  const initializationStartedRef = useRef(false);
  const paymentCompletedRef = useRef(false);

  const { initializePaymentSheet, openPaymentSheet, loading: sheetLoading } = useStripePaymentSheet();

  const price = tier?.prices?.[billingInterval];
  const isTrial = tier?.trial?.enabled;
  const trialDuration = tier?.trial?.durationDays;

  const completeSubscriptionFlow = async (intentId = stripeIntentId) => {
    if (paymentCompletedRef.current) return;
    paymentCompletedRef.current = true;

    if (intentId) {
      const confirmation = await confirmSubscriptionPayment(intentId, tier.key, billingInterval);
      if (!confirmation.success) {
        console.warn('Subscription confirmation failed after Stripe success:', confirmation.error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    await reloadSubscriptionData();

    const successMessage = isTrial
      ? `You've successfully started your ${trialDuration}-day free trial of ${tier.name}!`
      : `You've successfully subscribed to ${tier.name}!`;

    Alert.alert(
      isTrial ? 'Trial Started!' : 'Payment Successful!',
      successMessage,
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Tabs', { screen: 'Map' }),
        },
      ]
    );
  };

  // Initialize payment sheet when component mounts
  useEffect(() => {
    if (initializationStartedRef.current) return;
    initializationStartedRef.current = true;
    initializePayment();
  }, []);

  const initializePayment = async () => {
    setIsProcessing(true);
    try {
      const userEmail = userProfile?.email || userProfile?.Email || 'customer@mrktfy.app';
      const userName = userProfile?.name || userProfile?.Name || userProfile?.fullName || 'Mrktfy User';

      // Process subscription payment
      const paymentResult = await processSubscriptionPayment(tier, billingInterval, userEmail, userName, userProfile);

      if (!paymentResult.success) {
        throw new Error(paymentResult.error);
      }

      // Create Apple Pay configuration
      const applePayConfig = createApplePayConfig(tier, billingInterval);
      const intentId = paymentResult.paymentIntentId || paymentResult.setupIntentId || paymentResult.subscriptionId || null;
      setStripeIntentId(intentId);

      // Initialize payment sheet with the payment intent and Apple Pay config
      const { success } = await initializePaymentSheet({
        paymentIntent: paymentResult.paymentIntent,
        setupIntent: paymentResult.setupIntent,
        ephemeralKey: paymentResult.ephemeralKey,
        customer: paymentResult.customer,
        applePayConfig,
        primaryButtonLabel: isTrial ? `Start ${trialDuration}-day Trial` : `Pay ${price?.display}`,
      });

      if (success) {
        setIsReady(true);
      } else {
        throw new Error('Failed to initialize payment sheet');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', error.message || 'Failed to initialize payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Open Stripe Payment Sheet
      const { success: paymentSuccess } = await openPaymentSheet();

      if (!paymentSuccess) {
        // User cancelled or payment failed
        return;
      }

      await completeSubscriptionFlow();
    } catch (error) {
      Alert.alert('Payment Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Plan Summary */}
      <View style={styles.planSummary}>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{tier.name}</Text>
          <View style={styles.planPricing}>
            <Text style={styles.planPrice}>{price?.display}</Text>
            <Text style={styles.planPeriod}>
              {billingInterval === 'month' ? '/month' : '/year'}
            </Text>
            {price?.subtext && (
              <Text style={styles.planSubtext}>{price.subtext}</Text>
            )}
          </View>
        </View>
        <Text style={styles.planDescription}>{tier.tagline}</Text>
        {isTrial && (
          <Text style={styles.trialNote}>
            {trialDuration}-day free trial, then {price?.display}/{billingInterval}
          </Text>
        )}
      </View>

      {/* Payment Form */}
      <View style={styles.paymentForm}>
        <Text style={styles.sectionTitle}>Payment Information</Text>
        
        <Text style={styles.paymentDescription}>
          You'll be redirected to a secure payment form powered by Stripe.
        </Text>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color="#666" />
          <Text style={styles.securityNoteText}>
            Your payment information is encrypted and secure. We never store your card details.
          </Text>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, { opacity: (isProcessing || !isReady) ? 0.6 : 1 }]}
          onPress={handlePayment}
          disabled={isProcessing || !isReady}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color="#fff" />
              <Text style={styles.payButtonText}>
                {isTrial ? `Start ${trialDuration}-day Trial` : `Pay ${price?.display}${billingInterval === 'month' ? '/month' : '/year'}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Powered by Stripe */}
      <View style={styles.footer}>
        <View style={styles.poweredBy}>
          <Ionicons name="card" size={16} color="#666" />
          <Text style={styles.poweredByText}>Powered by Stripe</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
  },
  headerSpacer: {
    flex: 1,
  },
  planSummary: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  planPricing: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  planPeriod: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  trialNote: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 8,
    fontStyle: 'italic',
  },
  paymentForm: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  paymentDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  securityNoteText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  payButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poweredByText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});
