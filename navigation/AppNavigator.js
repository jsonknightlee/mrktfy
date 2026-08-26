// navigation/AppNavigator.js
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Ionicons } from '@expo/vector-icons';

import MapScreen from '../screens/MapScreen';
import ARScreen from '../screens/ARScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PropertyDeckScreen from '../screens/PropertyDeckScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import DecisionBoardScreen from '../screens/DecisionBoardScreen';
import DecisionBoardListingScreen from '../screens/DecisionBoardListingScreen';
import DecisionBoardListScreen from '../screens/DecisionBoardListScreen';
import NotificationListingsScreen from '../screens/NotificationListingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import PaymentScreen from '../screens/PaymentScreen';
import BuyerPreferencesScreen from '../screens/BuyerPreferencesScreen';
import BuyerWorkspaceScreen from '../screens/BuyerWorkspaceScreen';
import ContactAgentScreen from '../screens/ContactAgentScreen';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';
import { acknowledgePrivacyNotice } from '../services/authApi';

import { AuthContext } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';

const PRIVACY_POLICY_URL = 'https://mrktfy.com/privacy-policy';
const TERMS_AND_CONDITIONS_URL = 'https://mrktfy.com/terms-and-conditions';

const getPrivacyNoticeRequirement = (profile = null) => {
  if (!profile) return false;

  const hasPrivacyCurrentVersion = profile.currentPrivacyNoticeVersion != null;
  const hasTermsCurrentVersion = profile.currentTermsVersion != null;
  const hasPrivacyAccepted = profile.privacyNoticeAcceptedDate != null;
  const hasTermsAccepted = profile.termsAcceptedDate != null;

  const privacyVersionMismatch = hasPrivacyCurrentVersion
    && profile.privacyNoticeVersion != null
    && profile.privacyNoticeVersion !== profile.currentPrivacyNoticeVersion;

  const termsVersionMismatch = hasTermsCurrentVersion
    && profile.termsVersion != null
    && profile.termsVersion !== profile.currentTermsVersion;

  return (
    (!hasPrivacyAccepted || !hasTermsAccepted) && profile.requiresPrivacyNotice === true ||
    !hasPrivacyAccepted ||
    privacyVersionMismatch ||
    !hasTermsAccepted ||
    termsVersionMismatch
  );
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BuyStackNavigator({ route }) {
  const nestedScreen = route?.params?.screen === 'BuyerJourney' ? 'BuyerJourney' : 'BuyerWorkspace';
  const nestedParams = route?.params?.params || (route?.params?.focusWorkspaceItemId ? { focusWorkspaceItemId: route.params.focusWorkspaceItemId } : undefined);
  const stackKey = nestedScreen === 'BuyerJourney'
    ? `buyer-journey:${nestedParams?.openDeckId || ''}:${nestedParams?.buyerWorkspaceContext?.buyerWorkspaceItemId || ''}`
    : `buyer-workspace:${nestedParams?.focusWorkspaceItemId || ''}`;

  return (
    <Stack.Navigator key={stackKey} screenOptions={{ headerShown: false }} initialRouteName={nestedScreen}>
      <Stack.Screen name="BuyerWorkspace" component={BuyerWorkspaceScreen} initialParams={nestedScreen === 'BuyerWorkspace' ? nestedParams : undefined} />
      <Stack.Screen name="BuyerJourney" component={PropertyDeckScreen} initialParams={nestedScreen === 'BuyerJourney' ? nestedParams : undefined} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  useEffect(() => {
    console.log('[AUTHFLOW] entering main app');
  }, []);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Deck"
        component={PropertyDeckScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Buy"
        component={BuyStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="AR"
        component={ARScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, userProfile, setUserProfile, refreshUserProfile, persistPrivacyNoticeAcknowledgement } = useContext(AuthContext);
  const { userProfile: subscriptionUserProfile } = useSubscription();
  const [privacyNoticeSubmitting, setPrivacyNoticeSubmitting] = useState(false);
  const effectiveUserProfile = subscriptionUserProfile || userProfile;

  const requiresPrivacyNotice = useMemo(
    () => getPrivacyNoticeRequirement(effectiveUserProfile),
    [effectiveUserProfile]
  );

  const privacyNoticePayload = useMemo(() => ({
    privacyNoticeVersion: effectiveUserProfile?.currentPrivacyNoticeVersion ?? effectiveUserProfile?.privacyNoticeVersion ?? '1.0',
    termsVersion: effectiveUserProfile?.currentTermsVersion ?? effectiveUserProfile?.termsVersion ?? '1.0',
  }), [effectiveUserProfile]);

  useEffect(() => {
    console.log('[AUTHFLOW] navigation state', {
      isLoggedIn,
      privacyRequired: requiresPrivacyNotice,
      privacyNoticeSubmitting,
      hasUserProfile: Boolean(userProfile),
      hasSubscriptionProfile: Boolean(subscriptionUserProfile),
      profileCompletionRequired: false,
    });
  }, [isLoggedIn, requiresPrivacyNotice, privacyNoticeSubmitting, userProfile, subscriptionUserProfile]);

  useEffect(() => {
    if (!isLoggedIn) return;
    console.log('[AUTHFLOW] login authenticated');
    console.log('[AUTHFLOW] privacy required =', Boolean(requiresPrivacyNotice));
    console.log('[AUTHFLOW] profile completion required =', false);
  }, [isLoggedIn, requiresPrivacyNotice]);

  const handlePrivacyNoticeContinue = async () => {
    if (privacyNoticeSubmitting) return;

    setPrivacyNoticeSubmitting(true);
    try {
      const response = await acknowledgePrivacyNotice(privacyNoticePayload);
      const acknowledgedAt = response?.acknowledgedAt || new Date().toISOString();

      const currentProfile = userProfile || {};
      const persistedProfile = typeof persistPrivacyNoticeAcknowledgement === 'function'
        ? await persistPrivacyNoticeAcknowledgement(currentProfile, {
            acknowledgedAt,
            privacyNoticeVersion: response?.privacyNoticeVersion ?? privacyNoticePayload.privacyNoticeVersion,
            termsVersion: response?.termsVersion ?? privacyNoticePayload.termsVersion,
          })
        : null;

      setUserProfile((prev) => ({
        ...(prev || {}),
        ...(persistedProfile || {}),
        requiresPrivacyNotice: false,
        privacyNoticeAcceptedDate: acknowledgedAt,
        privacyNoticeVersion: response?.privacyNoticeVersion ?? privacyNoticePayload.privacyNoticeVersion,
        termsAcceptedDate: acknowledgedAt,
        termsVersion: response?.termsVersion ?? privacyNoticePayload.termsVersion,
        privacyNoticeAcknowledgedAt: acknowledgedAt,
      }));

      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile().catch((error) => {
          console.error('Failed to refresh profile after privacy acknowledgement:', error);
        });
      }
    } catch (error) {
      console.error('Privacy notice acknowledgement failed:', error);
      throw error;
    } finally {
      setPrivacyNoticeSubmitting(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#107AB0" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer key={isLoggedIn ? 'app' : 'auth'}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            <>
              <Stack.Screen name="Tabs" component={MainTabs} />
              <Stack.Screen
                name="ListingDetail"
                component={ListingDetailScreen}
                options={{
                  presentation: 'modal',
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_bottom', // ✅ optional but nice
                }}
              />
              <Stack.Screen
                name="NotificationListings"
                component={NotificationListingsScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="DecisionBoard"
                component={DecisionBoardScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="DecisionBoardListing"
                component={DecisionBoardListingScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="DecisionBoards"
                component={DecisionBoardListScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Subscription"
                component={SubscriptionScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Payment"
                component={PaymentScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="BuyerPreferences"
                component={BuyerPreferencesScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="ContactAgent"
                component={ContactAgentScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: true,
                  animation: 'slide_from_right',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      <PrivacyNoticeModal
        visible={Boolean(isLoggedIn && requiresPrivacyNotice)}
        loading={privacyNoticeSubmitting}
        onContinue={handlePrivacyNoticeContinue}
        privacyUrl={PRIVACY_POLICY_URL}
        termsUrl={TERMS_AND_CONDITIONS_URL}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
  },
});
