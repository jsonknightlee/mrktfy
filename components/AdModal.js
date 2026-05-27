import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useInterstitialAd } from '../services/adService';

const { width, height } = Dimensions.get('window');

const AdModal = ({ visible, onClose, onUpgrade }) => {
  const { getAdConfig } = useSubscription();
  let adConfig;
  try {
    adConfig = getAdConfig();
  } catch (error) {
    console.error('📱 Error getting adConfig:', error);
    adConfig = null;
  }

  const { isLoaded, isAdMobAvailable, showAd } = useInterstitialAd(visible);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Ensure adMessage is always a string with fallback
  const adMessage = String(adConfig?.adMessage || 'Upgrade to Premium to remove ads and unlock more features!');
  // Ensure showUpgradePrompt is always a boolean with fallback
  const showUpgradePrompt = adConfig?.showUpgradePrompt !== false;

  const handleUpgrade = () => {
    onClose();
    if (onUpgrade && typeof onUpgrade === 'function') {
      onUpgrade();
    }
  };

  const handleClose = () => {
    onClose();
  };

  // Show interstitial ad when modal opens
  useEffect(() => {
    if (visible) {
      console.log('📱 AdModal opened, attempting to show interstitial ad');

      if (!isAdMobAvailable) {
        console.log('📱 AdMob not available, showing placeholder ad');
        setShowPlaceholder(true);
        return;
      }

      if (typeof showAd === 'function') {
        const adShown = showAd();
        if (adShown) {
          // If real ad was shown, hide the placeholder
          setShowPlaceholder(false);
        } else {
          // If ad wasn't ready, show the placeholder
          setShowPlaceholder(true);
        }
      } else {
        console.log('📱 showAd is not a function, showing placeholder');
        setShowPlaceholder(true);
      }
    }
  }, [visible, showAd, isAdMobAvailable]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {showPlaceholder ? (
          <View style={styles.adContainer}>
            {/* Ad Header */}
            <View style={styles.adHeader}>
              <Text style={styles.adTitle}>Sponsored Content</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Ad Content */}
            <View style={styles.adContent}>
              <View style={styles.adImagePlaceholder}>
                <Ionicons name="business" size={48} color="#007AFF" />
                <Text style={styles.adImageText}>Premium Property Listing</Text>
              </View>

              <Text style={styles.adHeadline}>
                Discover Luxury Living in Prime Locations
              </Text>

              <Text style={styles.adDescription}>
                Exclusive properties in London's most desirable neighborhoods.
                Premium amenities, breathtaking views, and unparalleled lifestyle.
              </Text>

              <View style={styles.adFeatures}>
                <Text style={styles.adFeature}>- 5-Star Amenities</Text>
                <Text style={styles.adFeature}>- Prime Locations</Text>
                <Text style={styles.adFeature}>- Investment Opportunity</Text>
              </View>
            </View>

            {/* Ad Footer */}
            <View style={styles.adFooter}>
              <TouchableOpacity style={styles.adButton} onPress={handleClose}>
                <Text style={styles.adButtonText}>Learn More</Text>
              </TouchableOpacity>

              {showUpgradePrompt && (
                <View style={styles.upgradeSection}>
                  <Text style={styles.adMessage}>
                    {adMessage}
                  </Text>
                  <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                    <Ionicons name="diamond" size={16} color="#fff" />
                    <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : (
          // When real interstitial ad is shown, just show the upgrade prompt
          <View style={styles.upgradeOnlyContainer}>
            {showUpgradePrompt && (
              <View style={styles.upgradeSection}>
                <Text style={styles.adMessage}>
                  {adMessage}
                </Text>
                <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                  <Ionicons name="diamond" size={16} color="#fff" />
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.closeButtonBig} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  adContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.9,
    maxWidth: 400,
    maxHeight: height * 0.8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  closeButton: {
    padding: 4,
  },
  adContent: {
    padding: 20,
  },
  adImagePlaceholder: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  adImageText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '500',
  },
  adHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  adDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  adFeatures: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  adFeature: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  adFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  adButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  adButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeSection: {
    alignItems: 'center',
  },
  adMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  upgradeOnlyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
  },
  closeButtonBig: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdModal;
