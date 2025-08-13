import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation/AppNavigator';
import AuthProvider from './contexts/AuthContext';
import { FavoritesProvider } from './contexts/FavoritesContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FavoritesProvider>
        <SafeAreaProvider>
          <AppNavigator />
        </SafeAreaProvider>
        </FavoritesProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
