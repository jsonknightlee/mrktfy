import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { registerUser } from '../../services/authApi';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    Username: '',
    Password: '',
    Firstname: '',
    Lastname: '',
  });

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleRegister = async () => {
    try {
      await registerUser(form);
      Alert.alert('Success', 'Account created. Please log in.');
      navigation.navigate('Login');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to register');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account ✨</Text>

      <TextInput
        placeholder="First Name"
        onChangeText={(v) => handleChange('Firstname', v)}
        style={styles.input}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Last Name"
        onChangeText={(v) => handleChange('Lastname', v)}
        style={styles.input}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Username"
        onChangeText={(v) => handleChange('Username', v)}
        style={styles.input}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={(v) => handleChange('Password', v)}
        style={styles.input}
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
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
