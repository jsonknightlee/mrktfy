// import { API_BASE_URL, API_KEY } from '../app.config'; // Try direct access instead
import axios from 'axios';

// Debug environment variables
console.log('🔧 Environment Debug - process.env.EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
console.log('🔧 Environment Debug - process.env.EXPO_PUBLIC_API_KEY:', process.env.EXPO_PUBLIC_API_KEY);
console.log('🔧 Environment Debug - All EXPO_PUBLIC_* vars:', Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC_')));

// Use process.env directly
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.74:3001';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e';

console.log('🔧 Final API_BASE_URL:', API_BASE_URL);
console.log('🔧 Final API_KEY:', API_KEY ? 'SET' : 'NOT SET');

// Database service for profiles and subscription management
class DatabaseService {
  constructor() {
    // Use environment variable first, fallback to localhost for development
    this.baseURL = API_BASE_URL || 'http://192.168.1.74:3001';
    this.apiKey = API_KEY || '804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e';
    
    console.log('🔧 DatabaseService Constructor - baseURL:', this.baseURL);
    console.log('🔧 DatabaseService Constructor - apiKey:', this.apiKey ? 'SET' : 'NOT SET');
    
    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: 10000, // 10 second timeout
    });
    
    console.log('🔧 DatabaseService - Axios instance created with baseURL:', this.baseURL);
  }

  // Generic API request helper using axios
  async apiRequest(endpoint, options = {}) {
    const fullUrl = `${this.baseURL}/${endpoint.replace(/^\//, '')}`;
    console.log('🌐 Database Service - Full URL:', fullUrl);
    console.log('🌐 Database Service - Base URL:', this.baseURL);
    console.log('🌐 Database Service - Endpoint:', endpoint);
    console.log('🌐 Database Service - This baseURL:', this.baseURL);
    console.log('🌐 Database Service - This apiKey:', this.apiKey ? 'SET' : 'NOT SET');
    
    try {
      console.log('🌐 Database Service - About to make axios request:', fullUrl);
      console.log('🌐 Database Service - Request config:', {
        method: options.method || 'GET',
        url: endpoint,
        data: options.body ? JSON.parse(options.body) : undefined,
        headers: this.axiosInstance.defaults.headers
      });
      
      // Log the exact request that will be sent
      const requestConfig = {
        url: endpoint,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        }
      };
      
      console.log('🌐 Database Service - EXACT REQUEST BEING SENT:');
      console.log('🌐 - URL:', `${this.baseURL}/${endpoint}`);
      console.log('🌐 - Method:', requestConfig.method);
      console.log('🌐 - Headers:', JSON.stringify(requestConfig.headers, null, 2));
      console.log('🌐 - Data:', requestConfig.data || 'None');
      console.log('🌐 - Full Axios Config:', JSON.stringify(requestConfig, null, 2));
      
      const response = await this.axiosInstance.request(requestConfig);

      console.log('🌐 Database Service - Response status:', response.status);
      console.log('🌐 Database Service - Response ok:', response.status >= 200 && response.status < 300);

      if (response.status < 200 || response.status >= 300) {
        console.error('🌐 Database Service - Error response:', response.data);
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const result = response.data;
      console.log('🌐 Database Service - Success, data length:', Array.isArray(result) ? result.length : 'N/A');
      return result;
    } catch (error) {
      console.error(`Database service error for ${endpoint}:`, error);
      console.error('🌐 Database Service - Error details:', {
        fullUrl,
        baseURL: this.baseURL,
        endpoint,
        apiKey: this.apiKey ? 'set' : 'not set',
        errorMessage: error.message,
        errorType: error.constructor.name,
        isNetworkError: error.message.includes('Network Error') || error.code === 'ERR_NETWORK',
        isTimeoutError: error.message.includes('timeout'),
        isCORS: error.message.includes('CORS'),
        isConnectionRefused: error.message.includes('connection refused'),
        axiosCode: error.code,
        axiosResponse: error.response?.status,
        axiosResponseData: error.response?.data
      });
      
      // Add network debugging info
      if (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
        console.error('🌐 Network Error - Possible causes:');
        console.error('  1. Backend server not running');
        console.error('  2. Wrong URL/IP address');
        console.error('  3. Firewall blocking connection');
        console.error('  4. CORS issues');
        console.error('  5. Tunnel mode not working with this URL');
        
        // Test if we can reach the URL at all
        try {
          console.log('🌐 Testing basic connectivity to:', this.baseURL);
          const testResponse = await this.axiosInstance.head('/');
          console.log('🌐 Basic connectivity test - Status:', testResponse.status);
        } catch (testError) {
          console.error('🌐 Basic connectivity test failed:', testError.message);
        }
      }
      
      throw error;
    }
  }

  // ===== SUBSCRIPTION LEVELS =====
  
  // Get all subscription levels
  async getSubscriptionLevels() {
    return this.apiRequest('/api/subscription-levels');
  }

  // Get subscription level by ID
  async getSubscriptionLevel(id) {
    return this.apiRequest(`/api/subscription-levels/${id}`);
  }

  // ===== PROFILES =====
  
  // Get user profile by user ID
  async getUserProfile(userId) {
    console.log('🗄️ [DB SERVICE] getUserProfile called with userId:', userId);
    
    // Get the JWT token to send in headers
    const { getToken } = await import('../services/authService');
    const token = await getToken();
    console.log('🗄️ [DB SERVICE] Token obtained:', token ? 'Yes (first 50 chars: ' + token.substring(0, 50) + '...)' : 'No token');
    
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('🗄️ [DB SERVICE] Authorization header set');
    } else {
      console.warn('⚠️ [DB SERVICE] No token available for Authorization header');
    }
    
    // Extract user ID from JWT token if userId is 'current-user'
    let actualUserId = userId;
    if (userId === 'current-user' && token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        actualUserId = tokenPayload.ID || tokenPayload.id || tokenPayload.UserId || tokenPayload.userId;
        console.log('🗄️ [DB SERVICE] Extracted user ID from token:', actualUserId);
      } catch (error) {
        console.error('🗄️ [DB SERVICE] Failed to extract user ID from token:', error);
      }
    }
    
    console.log('🗄️ [DB SERVICE] Using actual userId:', actualUserId);
    
    // Try different endpoints that might work
    const endpoints = [
      `/api/profiles/user/${actualUserId}`,
      `/api/profiles/me`,
      `/api/users/profile`,
      `/api/user/profile`,
      `/api/profile`
    ];
    
    console.log('🗄️ [DB SERVICE] Will try', endpoints.length, 'different endpoints');
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        console.log(`🔍 [DB SERVICE] Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);
        const result = await this.apiRequest(endpoint, { headers });
        console.log(`✅ [DB SERVICE] Success with endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);
        console.log(`🗄️ [DB SERVICE] Result data:`, JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.log(`❌ [DB SERVICE] Failed with endpoint ${i + 1}/${endpoints.length} (${endpoint}):`, error.message);
        console.log(`❌ [DB SERVICE] Error details:`, {
          message: error.message,
          status: error.message.includes('404') ? '404 Not Found' : error.message.includes('401') ? '401 Unauthorized' : 'Other',
          name: error.name
        });
        continue;
      }
    }
    
    // If all endpoints fail, return null
    console.error('❌ [DB SERVICE] All endpoints failed for getUserProfile');
    return null;
  }

  // Create or update user profile
  async upsertUserProfile(profileData) {
    return this.apiRequest('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  // Update user profile
  async updateUserProfile(userId, profileData) {
    console.log('🗄️ [DB SERVICE] updateUserProfile called with userId:', userId);
    
    // Get the JWT token
    const { getToken } = await import('../utils/tokenStorage');
    const token = await getToken();
    
    // Extract user ID from JWT token if userId is 'current-user'
    let actualUserId = userId;
    if (userId === 'current-user' && token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        actualUserId = tokenPayload.ID || tokenPayload.id || tokenPayload.UserId || tokenPayload.userId;
        console.log('🗄️ [DB SERVICE] Extracted user ID from token for profile update:', actualUserId);
      } catch (error) {
        console.error('🗄️ [DB SERVICE] Failed to extract user ID from token:', error);
      }
    }
    
    console.log('🗄️ [DB SERVICE] Using actual userId for profile update:', actualUserId);
    
    return this.apiRequest(`/api/profiles/${actualUserId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Update user subscription
  async updateUserSubscription(userId, subscriptionLevelId) {
    console.log('🗄️ [DB SERVICE] updateUserSubscription called with userId:', userId, 'subscriptionLevelId:', subscriptionLevelId);
    
    // Get the JWT token
    const { getToken } = await import('../utils/tokenStorage');
    const token = await getToken();
    
    // Extract user ID from JWT token if userId is 'current-user'
    let actualUserId = userId;
    if (userId === 'current-user' && token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        actualUserId = tokenPayload.ID || tokenPayload.id || tokenPayload.UserId || tokenPayload.userId;
        console.log('🗄️ [DB SERVICE] Extracted user ID from token for subscription update:', actualUserId);
      } catch (error) {
        console.error('🗄️ [DB SERVICE] Failed to extract user ID from token:', error);
      }
    }
    
    console.log('🗄️ [DB SERVICE] Using actual userId for subscription update:', actualUserId);
    
    return this.apiRequest(`api/profiles/${actualUserId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ subscriptionLevelId }),
    });
  }

  // ===== USER REGISTRATION =====
  
  // Register new user with profile
  async registerUserWithProfile(userData) {
    return this.apiRequest('api/auth/register-with-profile', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }
}

export const databaseService = new DatabaseService();
