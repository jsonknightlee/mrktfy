import React, { useContext, useState, useEffect } from 'react';
import { View, TextInput, Alert, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { loginUser, fetchUserProfile, loginWithGoogle, loginWithApple } from '../../services/authApi';
import { saveToken } from '../../utils/tokenStorage';
import { AuthContext } from '../../contexts/AuthContext';

import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [Username, setUsername] = useState('');
  const [Password, setPassword] = useState('');
  const { setIsLoggedIn } = useContext(AuthContext);

  const [request, response, promptAsync] = Google.useAuthRequest({
       expoClientId: '771793399175-2ga58d94bhfieu0e9ks3bd7f68u0p1p1.apps.googleusercontent.com',
    iosClientId: '771793399175-22gdh9qseqj1k38ud849u2iqi820fabp.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: '771793399175-2ga58d94bhfieu0e9ks3bd7f68u0p1p1.apps.googleusercontent.com',
     redirectUri: 'https://auth.expo.io/@mrktfy/mrktfy',
  scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
  console.log('Google login response:', request);

  if (response?.type === 'success') {
    const { authentication } = response;
    console.log('Access token:', authentication.accessToken);
    // send to backend
  }
}, [response]);

  useEffect(() => {
    const handleGoogleLogin = async () => {
      if (response?.type === 'success') {
        try {
          const { authentication } = response;
           console.log('Google login response:', response);
          const token = await loginWithGoogle(authentication.accessToken);
          await saveToken(token);
          const user = await fetchUserProfile(token);
          Alert.alert('Welcome', `Hello ${user.Firstname}!`);
          setIsLoggedIn(true);
        } catch (err) {
          console.error(err);
          Alert.alert('Google Login Failed', 'Could not log in with Google');
        }
      }
    };
    handleGoogleLogin();
  }, [response]);

  const handleLogin = async () => {
    try {
      const token = await loginUser({ Username, Password });
      await saveToken(token);
      const user = await fetchUserProfile(token);
      Alert.alert('Welcome', `Hello ${user.Firstname}!`);
      setIsLoggedIn(true);
    } catch (err) {
      console.log(JSON.stringify(err));
      Alert.alert('Login failed', err.response?.data?.error || 'Unknown error');
    }
  };

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
      setIsLoggedIn(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Apple Login Failed', 'Could not log in with Apple');
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

      <TouchableOpacity style={styles.button} onPress={() => handleLogin()}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Register here</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* <TouchableOpacity style={styles.oauthBtn} onPress={() => promptAsync()}>
        <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.oauthText}>Sign in with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={6}
          style={{ width: '100%', height: 44, marginTop: 12 }}
          onPress={handleAppleLogin}
        />
      )} */}
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
  linkBtn: { marginBottom: 24 },
  link: { color: '#007AFF', textAlign: 'center' },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  oauthBtn: {
    backgroundColor: '#DB4437',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oauthText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
