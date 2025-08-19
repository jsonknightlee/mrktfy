// screens/auth/RegisterScreen.js
import React, { useState } from 'react';
import { View, TextInput, Alert, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { registerUser } from '../../services/authApi';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    Email: '',
    Password: '',
    Firstname: '',
    Lastname: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    if (submitting) return;

    const { Email, Password, Firstname, Lastname } = form;

    // ✅ Basic validation
    if (!Firstname || !Lastname || !Email || !Password) {
      Alert.alert('Missing details', 'Please fill out all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (Password.length < 6) {
      Alert.alert('Weak password', 'Password should be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await registerUser(form);
      Alert.alert('Success', 'Account created. Please log in.');
      navigation.navigate('Login');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to register';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account ✨</Text>

      <TextInput
        placeholder="First Name"
        value={form.Firstname}
        onChangeText={(v) => handleChange('Firstname', v)}
        style={styles.input}
        placeholderTextColor="#999"
        autoCapitalize="words"
        editable={!submitting}
      />
      <TextInput
        placeholder="Last Name"
        value={form.Lastname}
        onChangeText={(v) => handleChange('Lastname', v)}
        style={styles.input}
        placeholderTextColor="#999"
        autoCapitalize="words"
        editable={!submitting}
      />
      <TextInput
        placeholder="Email"
        value={form.Email}
        onChangeText={(v) => handleChange('Email', v)}
        style={styles.input}
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={form.Password}
        onChangeText={(v) => handleChange('Password', v)}
        style={styles.input}
        placeholderTextColor="#999"
        editable={!submitting}
      />

      <TouchableOpacity
        style={[styles.button, submitting && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Register</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => !submitting && navigation.navigate('Login')}>
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
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  link: { color: '#007AFF', textAlign: 'center', marginTop: 8 },
});
