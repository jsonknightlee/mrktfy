// navigation/AppNavigator.js
import React, { useContext } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Ionicons } from '@expo/vector-icons';

import MapScreen from '../screens/MapScreen';
import ARScreen from '../screens/ARScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import NotificationListingsScreen from '../screens/NotificationListingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import PaymentScreen from '../screens/PaymentScreen';

import { AuthContext } from '../contexts/AuthContext';
import NotificationBadge from '../components/NotificationBadge';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="AR"
        component={ARScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ 
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name="notifications" size={size} color={color} />
              <NotificationBadge />
            </View>
          )
        }}
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
  const { isLoggedIn } = useContext(AuthContext);

  if (isLoggedIn === null) return null; // or a splash/loader

  return (
    // 🔑 This key forces a full remount when auth flips
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
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
