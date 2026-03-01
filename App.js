import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation/AppNavigator';
import AuthProvider from './contexts/AuthContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FavoritesProvider>
          <SubscriptionProvider>
            <SafeAreaProvider>
              <AppNavigator />
            </SafeAreaProvider>
          </SubscriptionProvider>
        </FavoritesProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
