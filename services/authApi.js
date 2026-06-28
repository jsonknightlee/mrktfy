// services/authApi.js
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
