import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Conditional AdMob import - only import if available
let InterstitialAd, AdEventType, TestIds;
try {
  const ads = require('react-native-google-mobile-ads');
  InterstitialAd = ads.InterstitialAd;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
} catch (error) {
  console.log('📱 AdMob not available, using placeholder ads');
}

// AdMob Ad Unit IDs (replace with your actual AdMob IDs)
const AD_UNIT_IDS = {
  // Test IDs for development
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224356516',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485310',
  },
};

// Production IDs (replace these with your actual AdMob IDs when ready)
const PRODUCTION_AD_UNIT_IDS = {
  android: {
    banner: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_BANNER_AD_UNIT_ID',
    interstitial: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_INTERSTITIAL_AD_UNIT_ID',
    rewarded: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_REWARDED_AD_UNIT_ID',
  },
  ios: {
    banner: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_BANNER_AD_UNIT_ID',
    interstitial: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_INTERSTITIAL_AD_UNIT_ID',
    rewarded: 'ca-app-pub-YOUR_PUBLISHER_ID/YOUR_REWARDED_AD_UNIT_ID',
  },
};

const isDevelopment = __DEV__;

const getAdUnitId = (adType) => {
  const platform = Platform.OS;
  const ids = isDevelopment ? AD_UNIT_IDS : PRODUCTION_AD_UNIT_IDS;
  return ids[platform][adType];
};

// Simple ad service with visual placeholder ads
export const useAdService = () => {
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [showAds, setShowAds] = useState(true);

  const loadBannerAd = () => {
    console.log('📱 Loading banner ad...');
    setTimeout(() => setIsAdLoaded(true), 1000);
  };

  const loadInterstitialAd = () => {
    console.log('📱 Loading interstitial ad...');
    setTimeout(() => setIsAdLoaded(true), 1000);
  };

  const showInterstitialAd = () => {
    if (showAds) {
      console.log('📱 Showing interstitial ad');
      // In a real implementation, this would show the actual ad
      // For now, we'll just simulate it with a delay
      return true;
    }
    return false;
  };

  const hideAds = () => {
    setShowAds(false);
  };

  const showAdsAgain = () => {
    setShowAds(true);
  };

  return {
    isAdLoaded,
    showAds,
    loadBannerAd,
    loadInterstitialAd,
    showInterstitialAd,
    hideAds,
    showAdsAgain,
    getAdUnitId,
  };
};

// Visual Ad Banner Component (placeholder that looks like a real ad)
export const AdBanner = ({ style }) => {
  const { showAds, getAdUnitId } = useAdService();

  if (!showAds) {
    return null;
  }

  return (
    <View style={[styles.adBanner, style]}>
      <View style={styles.adContent}>
        <Text style={styles.adLabel}>Ad</Text>
        <Text style={styles.adText}>Test Advertisement</Text>
        <Text style={styles.adSubtext}>Upgrade to remove ads</Text>
      </View>
    </View>
  );
};

// Interstitial Ad Hook with real AdMob
export const useInterstitialAd = (shouldLoad = true) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isAdMobAvailable, setIsAdMobAvailable] = useState(!!InterstitialAd);
  const interstitialRef = useRef(null);
  const explicitlyShowAdRef = useRef(false);

  // Load interstitial ad
  const loadAd = () => {
    if (!InterstitialAd) {
      console.log('📱 AdMob not available, skipping ad load');
      setIsAdMobAvailable(false);
      return () => {};
    }

    const adUnitId = getAdUnitId('interstitial');

    try {
      const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        keywords: ['real estate', 'property', 'homes', 'apartments'],
      });

      interstitialRef.current = interstitial;

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('📱 Interstitial ad loaded');
        setIsLoaded(true);
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('📱 Interstitial ad closed');
        setIsClosed(true);
        setIsLoaded(false);
        explicitlyShowAdRef.current = false;
        // Preload the next ad
        loadAd();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('📱 Interstitial ad error:', error);
        setIsLoaded(false);
      });

      interstitial.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };
    } catch (error) {
      console.error('📱 Failed to create interstitial ad:', error);
      console.log('📱 Falling back to placeholder ads (AdMob not available)');
      setIsAdMobAvailable(false);
      return () => {};
    }
  };

  useEffect(() => {
    if (!shouldLoad) {
      console.log('📱 Ad loading disabled (shouldLoad = false)');
      return () => {};
    }
    const cleanup = loadAd();
    return cleanup;
  }, [shouldLoad]);

  const showAd = () => {
    if (!isAdMobAvailable || !InterstitialAd) {
      console.log('📱 AdMob not available, using placeholder');
      return false;
    }

    if (interstitialRef.current && isLoaded) {
      console.log('📱 Showing interstitial ad');
      explicitlyShowAdRef.current = true;
      try {
        interstitialRef.current.show();
        return true;
      } catch (error) {
        console.error('📱 Failed to show interstitial ad:', error);
        return false;
      }
    } else {
      console.log('📱 Interstitial ad not ready or not loaded');
      return false;
    }
  };

  return { isLoaded, isClosed, showAd, loadAd, isAdMobAvailable };
};

const styles = StyleSheet.create({
  adBanner: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  adContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#6c757d',
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  adText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '600',
    marginBottom: 2,
  },
  adSubtext: {
    fontSize: 10,
    color: '#6c757d',
  },
});

export default {
  useAdService,
  AdBanner,
  useInterstitialAd,
  getAdUnitId,
};
