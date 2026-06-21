import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { submitAgentEnquiry } from '../services/AgentEnquiryService';

const SITUATION_OPTIONS = [
  'First-time buyer',
  'Property to sell',
  'No chain',
  'Investor',
  'Mortgage agreed',
  'Cash buyer',
  'Just looking',
  'Other',
];

const DEFAULT_MESSAGE = 'I would like to view this property.';

const getListingId = (listing = {}) => (
  listing.ID ??
  listing.id ??
  listing.ListingID ??
  listing.listingId ??
  ''
);

const normalizeString = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  const nextValue = String(value).trim();
  return nextValue || fallback;
};

const getZooplaContactUrl = (listing = {}) => {
  const zooplaId = normalizeString(listing.ZooplaID ?? listing.zooplaId);
  if (zooplaId) {
    return `https://www.zoopla.co.uk/for-sale/details/contact/${encodeURIComponent(zooplaId)}`;
  }
  return normalizeString(listing.EmailLink ?? listing.emailLink ?? listing.ListingURL ?? listing.listingUrl);
};

export default function ContactAgentScreen({ route, navigation }) {
  const listing = route.params?.listing || {};
  const zooplaContactUrl = useMemo(() => getZooplaContactUrl(listing), [listing]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    postcode: normalizeString(listing.Postcode ?? listing.postcode),
    situation: 'First-time buyer',
    message: DEFAULT_MESSAGE,
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (submitting) return;

    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const message = form.message.trim();

    if (!fullName || !email || !phone || !message) {
      Alert.alert('Missing details', 'Full name, email, phone and message are required.');
      return;
    }

    setSubmitting(true);
    try {
      const enquiry = await submitAgentEnquiry({
        listingId: getListingId(listing),
        zooplaId: listing.ZooplaID ?? listing.zooplaId,
        zooplaContactUrl,
        listingTitle: listing.Title ?? listing.title,
        listingPrice: listing.Price ?? listing.price,
        listingPostcode: listing.Postcode ?? listing.postcode,
        listingUrl: listing.ListingURL ?? listing.listingUrl,
        agentName: listing.AgentName ?? listing.agentName,
        agentPhone: listing.AgentPhone ?? listing.agentPhone,
        fullName,
        email,
        phone,
        postcode: form.postcode.trim(),
        situation: form.situation,
        message,
      });

      Alert.alert(
        'Enquiry saved',
        'This enquiry is now in the manual Zoopla send queue.',
        [
          zooplaContactUrl
            ? { text: 'Open Zoopla', onPress: () => Linking.openURL(zooplaContactUrl) }
            : null,
          { text: 'Done', onPress: () => navigation.goBack() },
        ].filter(Boolean)
      );
    } catch (error) {
      Alert.alert('Enquiry not saved', error?.response?.data?.error || error?.message || 'Could not save this enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Contact agent</Text>
          <Text style={styles.headerSubtitle}>Send your viewing or property enquiry.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.propertyCard}>
          <Text style={styles.propertyTitle}>{normalizeString(listing.Title ?? listing.title, 'Property enquiry')}</Text>
          <Text style={styles.propertyMeta}>
            {[listing.Price ?? listing.price, listing.Postcode ?? listing.postcode, listing.AgentName ?? listing.agentName]
              .filter(Boolean)
              .map((item) => String(item))
              .join(' · ')}
          </Text>
        </View>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={form.fullName} onChangeText={(value) => updateField('fullName', value)} placeholder="Your full name" placeholderTextColor="#94A3B8" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(value) => updateField('email', value)} placeholder="you@example.com" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={form.phone} onChangeText={(value) => updateField('phone', value)} placeholder="Best contact number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />

        <Text style={styles.label}>Postcode</Text>
        <TextInput style={styles.input} value={form.postcode} onChangeText={(value) => updateField('postcode', value)} placeholder="Your postcode" placeholderTextColor="#94A3B8" autoCapitalize="characters" />

        <Text style={styles.label}>Buying position</Text>
        <View style={styles.optionsGrid}>
          {SITUATION_OPTIONS.map((option) => {
            const selected = form.situation === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.optionPill, selected && styles.optionPillSelected]}
                onPress={() => updateField('situation', option)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={form.message}
          onChangeText={(value) => updateField('message', value)}
          placeholder="Message to the agent"
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          <Text style={styles.submitButtonText}>{submitting ? 'Sending enquiry...' : 'Send enquiry'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  propertyTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  propertyMeta: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  messageInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionPillSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  optionText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#fff',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
});
