// services/authApi.js
import Constants from 'expo-constants';
import { authApi } from './api';

export const fetchUserProfile = async (token) => {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;
  const { data } = await authApi.get('/me', config);
  return data;
};

export const registerUser = async (payload) => {
  const { data } = await authApi.post('/register', payload);
  return data;
};

export const deleteAccount = async () => {
  const { data } = await authApi.delete('/delete-account');
  return data;
};

export const acknowledgePrivacyNotice = async (payload) => {
  const { data } = await authApi.post('/privacy-notice/acknowledge', payload);
  return data;
};

export const requestPasswordReset = async (email) => {
  const { data } = await authApi.post('/forgot-password', { email });
  return data;
};

export const loginUser = async (payload) => {
  const { data } = await authApi.post('/login', payload);
  return data; // expect token, etc.
};

export const loginWithGoogle = async (accessToken) => {
  const { data } = await authApi.post('/google', { accessToken });
  return data.token ?? data;
};

export const loginWithApple = async (identityToken, fullName) => {
  const { data } = await authApi.post('/apple', { identityToken, fullName });
  return data.token ?? data;
};

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

export const isTestLoginEnabled = () => Boolean(extra.ENABLE_TEST_LOGIN && extra.TEST_LOGIN_SECRET);

// Dev-only bypass: backend must gate /auth/test-login behind the same shared
// secret and refuse to serve it outside development.
export const loginAsTestUser = async () => {
  const { data } = await authApi.post(
    '/test-login',
    {},
    { headers: { 'x-test-login-secret': extra.TEST_LOGIN_SECRET } }
  );
  return data.token ?? data;
};
