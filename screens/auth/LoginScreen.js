// screens/auth/LoginScreen.js
import React, { useContext, useEffect, useState } from 'react';
import { View, TextInput, Alert, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { loginUser, fetchUserProfile, loginWithGoogle, loginWithApple } from '../../services/authApi';
import { AuthContext } from '../../contexts/AuthContext';

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [Email, setEmail] = useState('');
  const [Password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const { signIn, setIsLoggedIn } = useContext(AuthContext);
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
    || '771793399175-22gdh9qseqj1k38ud849u2iqi820fabp.apps.googleusercontent.com';

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    expoClientId: googleClientId,
    iosClientId: googleClientId,
    androidClientId: googleClientId,
    webClientId: googleClientId,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    const completeGoogleSignIn = async () => {
      if (googleResponse?.type !== 'success') return;

      try {
        const accessToken = googleResponse.authentication?.accessToken;
        if (!accessToken) {
          throw new Error('Google did not return an access token.');
        }

        const token = await loginWithGoogle(accessToken);
        const user = await fetchUserProfile(token);
        Alert.alert('Welcome', `Hello ${user.Firstname || user.Name || 'there'}!`);

        if (typeof signIn === 'function') {
          await signIn(token);
        } else {
          setIsLoggedIn?.(true);
        }
      } catch (err) {
        console.error('❌ [GOOGLE] Sign-in failed:', err);
        const msg = err?.response?.data?.error || err?.message || 'Could not sign in with Google';
        Alert.alert('Google Sign-In Failed', msg);
      } finally {
        setOauthLoading('');
      }
    };

    completeGoogleSignIn();
  }, [googleResponse, signIn, setIsLoggedIn]);

  const handleLogin = async () => {
    if (submitting) return;
    const username = Email.trim();

    if (!username || !Password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);

    try {
      console.log('🔐 [LOGIN] Attempting login with:', { Username: username });

      const response = await loginUser({ Username: username, Password });
      const token = response.token;

      console.log('✅ [LOGIN] Login successful, token received');

      // Save token and fetch user profile
      const user = await fetchUserProfile(token);
      console.log('👤 [LOGIN] User profile fetched:', user);

      Alert.alert('Welcome', `Hello ${user.Firstname || user.Name}!`);

      // Update authentication state
      if (typeof signIn === 'function') {
        await signIn(token);
      } else {
        setIsLoggedIn?.(true);
      }
    } catch (err) {
      console.error('❌ [LOGIN] Error:', err);
      console.error('❌ [LOGIN] Error response:', err?.response?.data);
      console.error('❌ [LOGIN] Error status:', err?.response?.status);

      const msg = err?.response?.data?.error || err?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (oauthLoading) return;

    setOauthLoading('google');

    try {
      console.log('🔍 [GOOGLE] Starting sign-in...');

      if (!googleClientId) {
        throw new Error('Missing Google OAuth client ID.');
      }

      const result = await promptGoogleAsync();
      if (result.type !== 'success') setOauthLoading('');
    } catch (err) {
      console.error('❌ [GOOGLE] Unexpected error:', err);
      Alert.alert('Google Sign-In Error', err.message || 'An unexpected error occurred');
      setOauthLoading('');
    }
  };

  const handleAppleSignIn = async () => {
    if (oauthLoading) return;

    setOauthLoading('apple');

    try {
      console.log('🔍 [APPLE] Starting sign-in...');

      if (Platform.OS === 'ios') {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        console.log('✅ [APPLE] Credential received:', credential);

        if (!credential.identityToken) {
          throw new Error('Apple did not return an identity token.');
        }

        const token = await loginWithApple(credential.identityToken, credential.fullName);
        const user = await fetchUserProfile(token);
        Alert.alert('Welcome', `Hello ${user.Firstname || user.Name || 'there'}!`);

        // Update authentication state
        if (typeof signIn === 'function') {
          await signIn(token);
        } else {
          setIsLoggedIn?.(true);
        }
      } else {
        Alert.alert('Apple Sign-In Unavailable', 'Apple Sign-In is only available on iOS in this build.');
      }
    } catch (err) {
      console.error('❌ [APPLE] Sign-in error:', err);
      Alert.alert('Apple Sign-In Error', err.message || 'Could not sign in with Apple');
    } finally {
      setOauthLoading('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome to MRKTFY</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#999"
            value={Email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={Password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!submitting}
          />
        </View>

        <TouchableOpacity
          style={[styles.signInButton, submitting && styles.disabledButton]}
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtonsContainer}>
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={oauthLoading === 'google' || !googleRequest}
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator color="#666" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#666" />
                <Text style={styles.socialButtonText}>Google</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={oauthLoading === 'apple'}
            >
              {oauthLoading === 'apple' ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#000" />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.signUpText}>
            Don't have an account? <Text style={styles.signUpLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  signInButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 6,
  },
  googleButton: {
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  appleButton: {
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  signUpText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  signUpLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
