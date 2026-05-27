// screens/auth/RegisterScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, Alert, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { registerUser, loginWithGoogle, loginWithApple, fetchUserProfile } from '../../services/authApi';
import { saveToken } from '../../utils/tokenStorage';
import { AuthContext } from '../../contexts/AuthContext';

import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    Email: '',
    Password: '',
    Firstname: '',
    Lastname: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { signIn, setIsLoggedIn } = React.useContext(AuthContext);

  // --- Google Auth ---
  const redirectUri = makeRedirectUri({ scheme: 'mrktfy' });
  console.log('🔐 [GOOGLE] Redirect URI:', redirectUri);
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '771793399175-2ga58d94bhfieu0e9ks3bd7f68u0p1p1.apps.googleusercontent.com',
    iosClientId:  '771793399175-22gdh9qseqj1k38ud849u2iqi820fabp.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId:  '771793399175-2ga58d94bhfieu0e9ks3bd7f68u0p1p1.apps.googleusercontent.com',
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    const handleGoogleLogin = async () => {
      if (response?.type !== 'success') return;
      try {
        const { authentication } = response;
        const token = await loginWithGoogle(authentication.accessToken);
        await saveToken(token);
        const user = await fetchUserProfile(token);
        Alert.alert('Welcome', `Hello ${user.Firstname}!`);
        if (typeof signIn === 'function') await signIn(token);
        else setIsLoggedIn?.(true);
      } catch (err) {
        console.error(err);
        Alert.alert('Google Sign Up Failed', 'Could not sign up with Google');
      }
    };
    handleGoogleLogin();
  }, [response, signIn, setIsLoggedIn]);

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const token = await loginWithApple(credential.identityToken);
      await saveToken(token);
      const user = await fetchUserProfile(token);
      Alert.alert('Welcome', `Hello ${user.Firstname}!`);
      if (typeof signIn === 'function') await signIn(token);
      else setIsLoggedIn?.(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Apple Sign Up Failed', 'Could not sign up with Apple');
    }
  };

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

      <View style={styles.divider} />

      <TouchableOpacity style={styles.oauthBtn} onPress={() => !submitting && promptAsync()}>
        <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.oauthText}>Sign up with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={6}
          style={{ width: '100%', height: 44, marginTop: 12 }}
          onPress={() => !submitting && handleAppleLogin()}
        />
      )}
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
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  oauthBtn: {
    backgroundColor: '#DB4437',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oauthText: { color: '#fff', fontWeight: 'bold' },
});
