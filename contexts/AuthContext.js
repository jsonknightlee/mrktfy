// contexts/AuthContext.js
import React, { createContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, saveToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';

const PRIVACY_NOTICE_ACK_STORAGE_PREFIX = 'privacy_notice_ack';

const getPrivacyNoticeStorageKey = (profile) => {
  const userKey = profile?.ID ?? profile?.UserID ?? profile?.Username;
  return userKey == null ? null : `${PRIVACY_NOTICE_ACK_STORAGE_PREFIX}:${userKey}`;
};

const loadPrivacyNoticeAcknowledgement = async (profile) => {
  const storageKey = getPrivacyNoticeStorageKey(profile);
  if (!storageKey) return null;

  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('❌ Auth: Failed to load privacy notice acknowledgement:', error);
    return null;
  }
};

const mergeProfileWithPrivacyNoticeState = async (profile) => {
  if (!profile) return null;

  const acknowledgement = await loadPrivacyNoticeAcknowledgement(profile);
  if (!acknowledgement) return profile;

  return {
    ...profile,
    ...acknowledgement,
    requiresPrivacyNotice: false,
  };
};

const persistPrivacyNoticeAcknowledgement = async (profile, acknowledgement) => {
  const storageKey = getPrivacyNoticeStorageKey(profile);
  if (!storageKey) return null;

  const acknowledgedAt = acknowledgement?.acknowledgedAt || new Date().toISOString();
  const payload = {
    requiresPrivacyNotice: false,
    privacyNoticeAcceptedDate: acknowledgedAt,
    privacyNoticeVersion: acknowledgement?.privacyNoticeVersion ?? profile?.privacyNoticeVersion ?? profile?.currentPrivacyNoticeVersion ?? null,
    termsAcceptedDate: acknowledgedAt,
    termsVersion: acknowledgement?.termsVersion ?? profile?.termsVersion ?? profile?.currentTermsVersion ?? null,
  };

  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.error('❌ Auth: Failed to persist privacy notice acknowledgement:', error);
  }

  return {
    ...(profile || {}),
    ...payload,
  };
};

export const AuthContext = createContext({
  isLoggedIn: null,
  setIsLoggedIn: () => {},
  userProfile: null,
  setUserProfile: () => {},
  refreshUserProfile: async () => null,
  signIn: async () => {},
  signOut: async () => {},
});

export default function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking
  const [userProfile, setUserProfile] = useState(null);

  const refreshUserProfile = async () => {
    const token = await getToken();
    if (!token) {
      setUserProfile(null);
      return null;
    }

    try {
      const profile = await fetchUserProfile(token);
      const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile || null);
      setUserProfile(mergedProfile);
      return mergedProfile;
    } catch (error) {
      console.error('❌ Auth: Failed to refresh user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setUserProfile(null);
        return setIsLoggedIn(false);
      }
      try {
        const profile = await fetchUserProfile(token);
        const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile || null);
        setUserProfile(mergedProfile);
        setIsLoggedIn(true);
      } catch {
        await deleteToken();
        setUserProfile(null);
        setIsLoggedIn(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    isLoggedIn,
    setIsLoggedIn, // keep for now to avoid refactors
    userProfile,
    setUserProfile,
    refreshUserProfile,
    persistPrivacyNoticeAcknowledgement,
    signIn: async (token, profile = null) => {
      console.log('🔐 Auth: signIn called with token');
      await saveToken(token);
      console.log('🔐 Auth: Token saved');
      if (profile) {
        const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile);
        setUserProfile(mergedProfile);
      } else {
        try {
          const fetchedProfile = await fetchUserProfile(token);
          const mergedProfile = await mergeProfileWithPrivacyNoticeState(fetchedProfile || null);
          setUserProfile(mergedProfile);
        } catch (error) {
          console.error('❌ Auth: Failed to fetch profile during signIn:', error);
          setUserProfile(null);
        }
      }
      setIsLoggedIn(true);
      console.log('🔐 Auth: setIsLoggedIn(true) called');
      console.log('🔐 Auth: signIn completed');
    },
    signOut: async () => {
      await deleteToken();
      setUserProfile(null);
      setIsLoggedIn(false);
    },
  }), [isLoggedIn, userProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
