// services/api.js
import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../utils/tokenStorage';

const { API_BASE_URL, API_KEY } = Constants.expoConfig.extra;

const commonHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

// App-wide API (non-auth routes)
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: commonHeaders,
});

// Auth-scoped API (/auth routes)
export const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: commonHeaders,
});

// Attach Bearer token automatically (both clients)
const attachAuth = (instance) =>
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

attachAuth(api);
attachAuth(authApi);
