import React, { useContext, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './navigation/AppNavigator';
import AuthProvider, { AuthContext } from './contexts/AuthContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { StripeProvider } from './services/stripeService';
import NotificationService from './services/NotificationService';

const NOTIFICATIONS_OPT_IN_KEY = 'mrktfy_notifications_enabled';

function NotificationBootstrapper() {
  const { isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      if (isLoggedIn !== true) return;

      const enabled = await AsyncStorage.getItem(NOTIFICATIONS_OPT_IN_KEY);
      if (enabled !== 'true') return;

      const initialized = await NotificationService.initialize();
      if (!mounted || !initialized) return;

      NotificationService.setupListeners(
        (notification) => {
          console.log('📨 Notification received:', notification?.request?.content?.title);
        },
        (response) => {
          console.log('👆 Notification opened:', response?.notification?.request?.content?.data);
        }
      );
    };

    initializeNotifications();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider>
        <AuthProvider>
          <NotificationBootstrapper />
          <FavoritesProvider>
            <SubscriptionProvider>
              <SafeAreaProvider>
                <AppNavigator />
              </SafeAreaProvider>
            </SubscriptionProvider>
          </FavoritesProvider>
        </AuthProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
