// services/authApi.js
import { authApi } from './api';

export const fetchUserProfile = async () => {
  const { data } = await authApi.get('/me');
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

export const loginWithApple = async (identityToken) => {
  const { data } = await authApi.post('/apple', { identityToken });
  return data.token ?? data;
};
