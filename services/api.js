// services/api.js
import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../services/authService';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
console.log('🔧 [API] Expo config extra:', extra);
console.log('🔧 [API] API_BASE_URL from config:', extra.API_BASE_URL);
console.log('🔧 [API] API_KEY from config:', extra.API_KEY ? 'SET' : 'NOT SET');
const API_BASE_URL = extra.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || '';
const API_KEY = extra.API_KEY || process.env.EXPO_PUBLIC_API_KEY || '';

const commonHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

console.log('🔧 [API] Final commonHeaders:', commonHeaders);

// App-wide API (non-auth routes)
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: commonHeaders,
  timeout: 15000,
});

// Auth-scoped API (/auth routes)
export const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: commonHeaders,
  timeout: 15000,
});

console.log('🔧 [API] Created API instances with baseURL:', API_BASE_URL);
console.log('🔧 [API] Auth API baseURL:', `${API_BASE_URL}/auth`);

// Add request interceptor to log exact requests
authApi.interceptors.request.use((config) => {
  console.log('🔐 [API] LOGIN REQUEST BEING SENT:');
  console.log('🔐 - Full URL:', `${config.baseURL}${config.url}`);
  console.log('🔐 - Method:', config.method?.toUpperCase());
  console.log('🔐 - Headers:', JSON.stringify(config.headers, null, 2));
  console.log('🔐 - Data:', config.data ? JSON.stringify(config.data, null, 2) : 'None');
  console.log('🔐 - Full Config:', JSON.stringify({
    method: config.method,
    url: config.url,
    baseURL: config.baseURL,
    headers: config.headers,
    data: config.data
  }, null, 2));
  return config;
});

// Add response interceptor to log responses
authApi.interceptors.response.use(
  (response) => {
    console.log('🔐 [API] LOGIN RESPONSE SUCCESS:');
    console.log('🔐 - Status:', response.status);
    console.log('🔐 - Headers:', JSON.stringify(response.headers, null, 2));
    console.log('🔐 - Data:', JSON.stringify(response.data, null, 2));
    return response;
  },
  (error) => {
    console.log('🔐 [API] LOGIN RESPONSE ERROR:');
    console.log('🔐 - Error:', error.message);
    console.log('🔐 - Code:', error.code);
    console.log('🔐 - Response:', error.response ? {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    } : 'No response');
    console.log('🔐 - Config:', error.config ? {
      method: error.config.method,
      url: error.config.url,
      baseURL: error.config.baseURL,
      headers: error.config.headers,
      data: error.config.data
    } : 'No config');
    return Promise.reject(error);
  }
);

// Attach Bearer token automatically (both clients)
const attachAuth = (instance) =>
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token && !['/login', '/register'].includes(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

attachAuth(api);
attachAuth(authApi);
