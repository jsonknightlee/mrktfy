import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getBuyerPreferences,
  saveBuyerPreferences,
  skipBuyerPreferences,
} from '../services/BuyerPreferencesService';
import { recalculateShortlistRankings } from '../services/PropertyDeckService';

const APP_PURPLE = '#6366F1';

const emptyForm = {
  maxBudget: '',
  minBedrooms: '',
  minBathrooms: '',
  preferredAreasJson: '',
  maxCommuteMinutes: '',
  commuteDestination: '',
  schoolImportance: '3',
  parkingImportance: '3',
  gardenImportance: '3',
  quietAreaImportance: '3',
  renovationTolerance: '2',
  propertyTypesJson: '',
  mustHaveJson: '',
  niceToHaveJson: '',
};

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');
const textToList = (value) => String(value || '').split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
const numberText = (value) => (value === null || value === undefined ? '' : String(value));

const buildForm = (preference) => ({
  maxBudget: numberText(preference?.maxBudget),
  minBedrooms: numberText(preference?.minBedrooms),
  minBathrooms: numberText(preference?.minBathrooms),
  preferredAreasJson: listToText(preference?.preferredAreasJson),
  maxCommuteMinutes: numberText(preference?.maxCommuteMinutes),
  commuteDestination: preference?.commuteDestination || '',
  schoolImportance: numberText(preference?.schoolImportance || 3),
  parkingImportance: numberText(preference?.parkingImportance || 3),
  gardenImportance: numberText(preference?.gardenImportance || 3),
  quietAreaImportance: numberText(preference?.quietAreaImportance || 3),
  renovationTolerance: numberText(preference?.renovationTolerance || 2),
  propertyTypesJson: listToText(preference?.propertyTypesJson),
  mustHaveJson: listToText(preference?.mustHaveJson),
  niceToHaveJson: listToText(preference?.niceToHaveJson),
});

const toNullableNumber = (value) => {
  const trimmed = String(value || '').replace(/[£,\s]/g, '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function BuyerPreferencesScreen({ navigation, route }) {
  const scope = route?.params?.scope || 'default';
  const propertyDeckId = route?.params?.propertyDeckId || route?.params?.deckId || null;
  const deckName = route?.params?.deckName || 'this Property Deck';
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState('NotStarted');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDeckScoped = scope === 'deck';

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const preference = await getBuyerPreferences(propertyDeckId);
      if (preference) {
        setForm(buildForm(preference));
        setStatus(preference.onboardingStatus || 'NotStarted');
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        setForm(emptyForm);
        setStatus('NotStarted');
        return;
      }
      Alert.alert('Could not load preferences', error?.response?.data?.error || error.message || 'Try again later.');
    } finally {
      setLoading(false);
    }
  }, [propertyDeckId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const maxBudget = toNullableNumber(form.maxBudget);
    if (form.maxBudget.trim() && maxBudget === null) {
      Alert.alert('Check maximum budget', 'Enter your budget as a number, for example 365000 or £365,000.');
      return;
    }

    setSaving(true);
    try {
      const preference = await saveBuyerPreferences({
        propertyDeckId,
        maxBudget,
        minBedrooms: toNullableNumber(form.minBedrooms),
        minBathrooms: toNullableNumber(form.minBathrooms),
        preferredAreasJson: textToList(form.preferredAreasJson),
        maxCommuteMinutes: toNullableNumber(form.maxCommuteMinutes),
        commuteDestination: form.commuteDestination.trim() || null,
        schoolImportance: toNullableNumber(form.schoolImportance),
        parkingImportance: toNullableNumber(form.parkingImportance),
        gardenImportance: toNullableNumber(form.gardenImportance),
        quietAreaImportance: toNullableNumber(form.quietAreaImportance),
        renovationTolerance: toNullableNumber(form.renovationTolerance),
        propertyTypesJson: textToList(form.propertyTypesJson),
        mustHaveJson: textToList(form.mustHaveJson),
        niceToHaveJson: textToList(form.niceToHaveJson),
      });

      if (propertyDeckId) {
        await recalculateShortlistRankings(propertyDeckId, 'Buyer');
      }

      setStatus(preference?.onboardingStatus || 'Completed');
      Alert.alert(
        'Preferences saved',
        isDeckScoped ? 'This deck can now use these buyer fit signals.' : 'Your default buyer preferences were saved.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Could not save preferences', error?.response?.data?.error || error.message || 'Try again later.');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      const preference = await skipBuyerPreferences(propertyDeckId);
      setStatus(preference?.onboardingStatus || 'Skipped');
      Alert.alert(
        'Preferences skipped',
        'Mrktfy will show property ranking without personal fit ranking.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Could not skip preferences', error?.response?.data?.error || error.message || 'Try again later.');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (label, key, props = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={form[key]}
        onChangeText={(value) => updateField(key, value)}
        placeholder={props.placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={props.keyboardType || 'default'}
        multiline={props.multiline}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={APP_PURPLE} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Buyer Preferences</Text>
          <Text style={styles.subtitle}>
            {isDeckScoped ? `Used for ${deckName}` : 'Default profile preferences'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{status}</Text>
          <Text style={styles.statusCopy}>
            Completed preferences unlock personal fit ranking. Skipped preferences only show property ranking.
          </Text>
        </View>

        {renderInput('Maximum budget', 'maxBudget', { keyboardType: 'numeric', placeholder: '450000' })}
        <View style={styles.row}>
          <View style={styles.rowItem}>{renderInput('Bedrooms', 'minBedrooms', { keyboardType: 'numeric', placeholder: '3' })}</View>
          <View style={styles.rowItem}>{renderInput('Bathrooms', 'minBathrooms', { keyboardType: 'numeric', placeholder: '1' })}</View>
        </View>
        {renderInput('Preferred areas', 'preferredAreasJson', { placeholder: 'Bristol, Bath, Clifton' })}
        {renderInput('Commute destination', 'commuteDestination', { placeholder: 'Bristol Temple Meads' })}
        {renderInput('Max commute minutes', 'maxCommuteMinutes', { keyboardType: 'numeric', placeholder: '45' })}

        <Text style={styles.sectionTitle}>Importance, 0 to 5</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>{renderInput('Schools', 'schoolImportance', { keyboardType: 'numeric' })}</View>
          <View style={styles.rowItem}>{renderInput('Parking', 'parkingImportance', { keyboardType: 'numeric' })}</View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>{renderInput('Garden', 'gardenImportance', { keyboardType: 'numeric' })}</View>
          <View style={styles.rowItem}>{renderInput('Quiet area', 'quietAreaImportance', { keyboardType: 'numeric' })}</View>
        </View>
        {renderInput('Renovation tolerance, 0 to 5', 'renovationTolerance', { keyboardType: 'numeric' })}

        {renderInput('Property types', 'propertyTypesJson', { placeholder: 'Detached, Semi-detached' })}
        {renderInput('Must haves', 'mustHaveJson', { placeholder: 'Garden, Parking, Office', multiline: true })}
        {renderInput('Nice to haves', 'niceToHaveJson', { placeholder: 'Near park, Utility room', multiline: true })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={skip} disabled={saving}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save preferences'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 20,
    paddingBottom: 120,
  },
  container: {
    backgroundColor: '#F7F8FB',
    flex: 1,
  },
  field: {
    marginBottom: 14,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#F7F8FB',
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
  },
  skipButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13,
  },
  skipButtonText: {
    color: APP_PURPLE,
    fontSize: 15,
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  statusCopy: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  statusLabel: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
});
