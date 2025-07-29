import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import AuthProvider from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
    </AuthProvider>
  );
}
