import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaymentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { tier, billingInterval = 'month' } = route.params || {};
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const price = tier?.prices?.[billingInterval];
  const isTrial = tier?.trial?.enabled;
  const trialDuration = tier?.trial?.durationDays;

  const handlePayment = async () => {
    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      Alert.alert('Error', 'Please fill in all payment fields');
      return;
    }

    setIsProcessing(true);
    
    try {
      // TODO: Integrate Stripe payment processing
      console.log('Processing payment for tier:', tier.key, 'interval:', billingInterval);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const successMessage = isTrial 
        ? `You've successfully started your ${trialDuration}-day free trial of ${tier.name}!`
        : `You've successfully subscribed to ${tier.name}!`;
      
      Alert.alert(
        isTrial ? 'Trial Started!' : 'Payment Successful!',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Map'),
          },
        ]
      );
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
        
        {/* Cardholder Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Cardholder Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            value={cardholderName}
            onChangeText={setCardholderName}
            autoCapitalize="words"
          />
        </View>

        {/* Card Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Card Number</Text>
          <TextInput
            style={styles.input}
            placeholder="1234 5678 9012 3456"
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="numeric"
            maxLength={19}
          />
        </View>

        {/* Expiry Date & CVV */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Expiry Date</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/YY"
              value={expiryDate}
              onChangeText={setExpiryDate}
              maxLength={5}
            />
          </View>
          
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>CVV</Text>
            <TextInput
              style={styles.input}
              placeholder="123"
              value={cvv}
              onChangeText={setCvv}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color="#666" />
          <Text style={styles.securityNoteText}>
            Your payment information is encrypted and secure. We never store your card details.
          </Text>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, { opacity: isProcessing ? 0.6 : 1 }]}
          onPress={handlePayment}
          disabled={isProcessing}
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
