import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const loadProfile = async () => {
      const token = await getToken();
      if (token) {
        const profile = await fetchUserProfile(token);
        setUser(profile);
      }
    };
    loadProfile();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      {user ? (
        <>
          <Text style={styles.label}>Name: {user.Firstname} {user.Lastname}</Text>
          <Text style={styles.label}>Email: {user.Username}</Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await deleteToken();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text>Loading profile...</Text>
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
