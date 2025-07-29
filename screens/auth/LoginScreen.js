import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { loginUser, fetchUserProfile } from '../../services/authApi';
import { saveToken } from '../../utils/tokenStorage';

export default function LoginScreen({ navigation }) {
  const [Username, setUsername] = useState('');
  const [Password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const token = await loginUser({ Username, Password });
      await saveToken(token);
      const user = await fetchUserProfile(token);
      Alert.alert('Welcome', `Hello ${user.Firstname}!`);
      navigation.navigate('Map');
    } catch (err) {
      console.log(JSON.stringify(err))
      Alert.alert('Login failed', err.response?.data?.error || 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back 👋</Text>

      <TextInput
        placeholder="Username"
        value={Username}
        onChangeText={setUsername}
        style={styles.input}
        placeholderTextColor="#999"
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={Password}
        onChangeText={setPassword}
        style={styles.input}
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Register here</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  link: { color: '#007AFF', textAlign: 'center', marginTop: 8 },
});
