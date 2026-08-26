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
    console.log('🔐 [AUTHFLOW] user profile refresh starting');
    const token = await getToken();
    if (!token) {
      console.log('🔐 [AUTHFLOW] user profile refresh skipped - no token');
      setUserProfile(null);
      return null;
    }

    try {
      const profile = await fetchUserProfile(token);
      console.log('🔐 [AUTHFLOW] user profile loaded', {
        hasProfile: Boolean(profile),
        userId: profile?.ID ?? profile?.UserID ?? null,
        username: profile?.Username ?? null,
      });
      const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile || null);
      console.log('🔐 [AUTHFLOW] privacy state merged into profile', {
        requiresPrivacyNotice: mergedProfile?.requiresPrivacyNotice === true,
        privacyNoticeAcceptedDate: mergedProfile?.privacyNoticeAcceptedDate ?? null,
        termsAcceptedDate: mergedProfile?.termsAcceptedDate ?? null,
      });
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
        console.log('🔐 [AUTHFLOW] initial auth check - no token found');
        setUserProfile(null);
        return setIsLoggedIn(false);
      }
      try {
        console.log('🔐 [AUTHFLOW] initial auth check - token found, loading profile');
        const profile = await fetchUserProfile(token);
        console.log('🔐 [AUTHFLOW] user profile loaded', {
          hasProfile: Boolean(profile),
          userId: profile?.ID ?? profile?.UserID ?? null,
          username: profile?.Username ?? null,
        });
        const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile || null);
        console.log('🔐 [AUTHFLOW] privacy state merged into initial profile', {
          requiresPrivacyNotice: mergedProfile?.requiresPrivacyNotice === true,
          privacyNoticeAcceptedDate: mergedProfile?.privacyNoticeAcceptedDate ?? null,
          termsAcceptedDate: mergedProfile?.termsAcceptedDate ?? null,
        });
        setUserProfile(mergedProfile);
        setIsLoggedIn(true);
        console.log('🔐 [AUTHFLOW] login authenticated');
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
        console.log('🔐 [AUTHFLOW] user profile loaded', {
          hasProfile: true,
          userId: profile?.ID ?? profile?.UserID ?? null,
          username: profile?.Username ?? null,
        });
        const mergedProfile = await mergeProfileWithPrivacyNoticeState(profile);
        console.log('🔐 [AUTHFLOW] privacy state merged into signed-in profile', {
          requiresPrivacyNotice: mergedProfile?.requiresPrivacyNotice === true,
          privacyNoticeAcceptedDate: mergedProfile?.privacyNoticeAcceptedDate ?? null,
          termsAcceptedDate: mergedProfile?.termsAcceptedDate ?? null,
        });
        setUserProfile(mergedProfile);
      } else {
        try {
          const fetchedProfile = await fetchUserProfile(token);
          console.log('🔐 [AUTHFLOW] user profile loaded', {
            hasProfile: Boolean(fetchedProfile),
            userId: fetchedProfile?.ID ?? fetchedProfile?.UserID ?? null,
            username: fetchedProfile?.Username ?? null,
          });
          const mergedProfile = await mergeProfileWithPrivacyNoticeState(fetchedProfile || null);
          console.log('🔐 [AUTHFLOW] privacy state merged into signed-in profile', {
            requiresPrivacyNotice: mergedProfile?.requiresPrivacyNotice === true,
            privacyNoticeAcceptedDate: mergedProfile?.privacyNoticeAcceptedDate ?? null,
            termsAcceptedDate: mergedProfile?.termsAcceptedDate ?? null,
          });
          setUserProfile(mergedProfile);
        } catch (error) {
          console.error('❌ Auth: Failed to fetch profile during signIn:', error);
          setUserProfile(null);
        }
      }
      setIsLoggedIn(true);
      console.log('🔐 Auth: login success - app shell can mount');
      console.log('🔐 [AUTHFLOW] login authenticated');
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
