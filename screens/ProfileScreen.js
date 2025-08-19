// screens/ProfileScreen.js
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';
import { AuthContext } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { setIsLoggedIn } = useContext(AuthContext); // ✅ pull from context
  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setIsLoggedIn(false);
          return;
        }
        const profile = await fetchUserProfile(token);
        setUser(profile);
      } catch (e) {
        // If token is bad or request fails, treat as logged out
        await deleteToken();
        setIsLoggedIn(false);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, [setIsLoggedIn]);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await deleteToken();
      setIsLoggedIn(false); // ✅ triggers navigator switch
    } catch (e) {
      Alert.alert('Logout failed', 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      {loadingProfile ? (
        <ActivityIndicator />
      ) : user ? (
        <>
          <Text style={styles.label}>Name: {user.Firstname} {user.Lastname}</Text>
          <Text style={styles.label}>Email: {user.Username}</Text>

          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && { opacity: 0.6 }]}
            onPress={onLogout}
            disabled={loggingOut}
          >
            <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Logout'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text>Couldn’t load profile.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 8 },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#f33',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
