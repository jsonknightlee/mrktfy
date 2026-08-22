import React from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyNoticeModal = ({
  visible,
  loading = false,
  onContinue,
  privacyUrl,
  termsUrl,
}) => {
  const openLink = async (url) => {
    if (!url) return;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch (error) {
      console.error('Failed to open legal link:', error);
    }
  };

  const handleContinue = async () => {
    try {
      if (typeof onContinue === 'function') {
        await onContinue();
      }
    } catch (error) {
      console.error('Privacy notice continue failed:', error);
      Alert.alert('Could not continue', error?.response?.data?.error || error?.response?.data?.message || 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#107AB0" />
            </View>
            <Text style={styles.title}>Your privacy at Mrktfy</Text>
          </View>

          <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>
              Mrktfy uses your account information, preferences and property activity to provide and personalise the app.
            </Text>
            <Text style={styles.body}>
              With your permission, we use your location to help you discover relevant properties nearby.
            </Text>
            <Text style={styles.body}>
              Information you add to your workspace, including notes, photos, videos and voice recordings, is stored securely as part of your account.
            </Text>
            <Text style={styles.body}>
              We also use trusted service providers to operate features such as authentication, AI assistance, email delivery, data storage and subscriptions.
            </Text>
            <Text style={styles.body}>
              We do not sell your personal information.
            </Text>
            <Text style={styles.body}>
              You can learn more about what we collect, why we use it, how long we keep it and your privacy rights in our Privacy Policy.
            </Text>
            <Text style={styles.body}>
              By continuing, you acknowledge that you have read our Privacy Policy and agree to our Terms &amp; Conditions.
            </Text>

            <View style={styles.linkRow}>
              <TouchableOpacity style={styles.linkButton} onPress={() => openLink(privacyUrl)}>
                <Text style={styles.linkText}>Privacy Policy</Text>
                <Ionicons name="open-outline" size={14} color="#107AB0" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => openLink(termsUrl)}>
                <Text style={styles.linkText}>Terms &amp; Conditions</Text>
                <Ionicons name="open-outline" size={14} color="#107AB0" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  bodyContent: {
    paddingBottom: 8,
  },
  body: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  linkRow: {
    marginTop: 8,
    gap: 10,
  },
  linkButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  linkText: {
    color: '#107AB0',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#107AB0',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});

export default PrivacyNoticeModal;
