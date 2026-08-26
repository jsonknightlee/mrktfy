// services/api.js
import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../utils/tokenStorage';
import { redactHeaders, redactRequestConfig, redactAuthPayload } from '../utils/logRedaction';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
const API_BASE_URL = extra.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || '';
const API_BACKUP_BASE_URL = extra.API_BACKUP_BASE_URL || process.env.EXPO_PUBLIC_API_BACKUP_BASE_URL || '';
const API_KEY = extra.API_KEY || process.env.EXPO_PUBLIC_API_KEY || '';

const VERBOSE_API_LOGS = __DEV__ && process.env.EXPO_PUBLIC_VERBOSE_API_LOGS === 'true';

if (VERBOSE_API_LOGS) {
  console.log('🔧 [API] Expo config extra:', redactAuthPayload(extra));
  console.log('🔧 [API] Resolved API_BASE_URL:', API_BASE_URL || 'NOT SET');
  console.log('🔧 [API] Resolved API_BACKUP_BASE_URL:', API_BACKUP_BASE_URL || 'NOT SET');
  console.log('🔧 [API] API_KEY from config:', API_KEY ? 'SET' : 'NOT SET');
}
if (!API_BASE_URL) {
  console.warn('⚠️ [API] API_BASE_URL is empty. Login and API calls will fail until a production backend URL is injected.');
}

const commonHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

if (VERBOSE_API_LOGS) {
  console.log('🔧 [API] Final commonHeaders:', redactHeaders(commonHeaders));
}

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

if (VERBOSE_API_LOGS) {
  console.log('🔧 [API] Created API instances with baseURL:', API_BASE_URL);
  console.log('🔧 [API] Auth API baseURL:', `${API_BASE_URL}/auth`);
  console.log('🔧 [API] Backup API baseURL:', API_BACKUP_BASE_URL || 'NOT SET');
}

const shouldRetryWithBackup = (error) => (
  API_BACKUP_BASE_URL &&
  error?.config &&
  !error.response &&
  !error.config.__usedBackupBaseUrl
);

const loggedBackupRetries = new Set();
const logBackupRetryOnce = (label, backupBaseURL) => {
  const key = `${label}:${backupBaseURL}`;
  if (loggedBackupRetries.has(key)) return;

  loggedBackupRetries.add(key);
  if (__DEV__ && process.env.EXPO_PUBLIC_VERBOSE_API_LOGS === 'true') {
    console.log(`🔁 [API] ${label} primary failed, retrying backup:`, backupBaseURL);
  }
};

const attachBackupRetry = (instance, backupBaseURL, label) =>
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!shouldRetryWithBackup(error)) {
        return Promise.reject(error);
      }

      const retryConfig = {
        ...error.config,
        baseURL: backupBaseURL,
        __usedBackupBaseUrl: true,
      };

      logBackupRetryOnce(label, backupBaseURL);
      return instance.request(retryConfig);
    }
  );

// Add request interceptor to log exact requests
authApi.interceptors.request.use((config) => {
  if (VERBOSE_API_LOGS) {
    console.log('🔐 [API] LOGIN REQUEST BEING SENT:', JSON.stringify(redactRequestConfig(config), null, 2));
  }
  return config;
});

// Add response interceptor to log responses
authApi.interceptors.response.use(
  (response) => {
    if (VERBOSE_API_LOGS) {
      console.log('🔐 [API] LOGIN RESPONSE SUCCESS:', JSON.stringify({
        status: response.status,
        headers: redactHeaders(response.headers),
        data: response.data,
      }, null, 2));
    }
    return response;
  },
  (error) => {
    if (VERBOSE_API_LOGS) {
      console.log('🔐 [API] LOGIN RESPONSE ERROR:', JSON.stringify({
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data,
          headers: redactHeaders(error.response.headers),
        } : 'No response',
        config: error.config ? redactRequestConfig(error.config) : 'No config',
      }, null, 2));
    }
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
attachBackupRetry(api, API_BACKUP_BASE_URL, 'API');
attachBackupRetry(authApi, API_BACKUP_BASE_URL ? `${API_BACKUP_BASE_URL}/auth` : '', 'AUTH');
