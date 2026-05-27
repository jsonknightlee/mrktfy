import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

/**
 * Get the stored authentication token
 * @returns {Promise<string|null>} The token or null if not found
 */
export const getToken = async () => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    console.log('🔑 [AUTH] Token retrieved:', token ? 'Success' : 'No token found');
    return token;
  } catch (error) {
    console.error('❌ [AUTH] Error getting token:', error);
    return null;
  }
};

/**
 * Save the authentication token
 * @param {string} token - The token to save
 * @returns {Promise<boolean>} Success status
 */
export const saveToken = async (token) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    console.log('💾 [AUTH] Token saved successfully');
    return true;
  } catch (error) {
    console.error('❌ [AUTH] Error saving token:', error);
    return false;
  }
};

/**
 * Delete the authentication token
 * @returns {Promise<boolean>} Success status
 */
export const deleteToken = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    console.log('🗑️ [AUTH] Token deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ [AUTH] Error deleting token:', error);
    return false;
  }
};

/**
 * Check if user is authenticated (has valid token)
 * @returns {Promise<boolean>} Authentication status
 */
export const isAuthenticated = async () => {
  try {
    const token = await getToken();
    if (!token) {
      return false;
    }
    
    // You can add token validation logic here if needed
    // For now, just check if token exists
    return true;
  } catch (error) {
    console.error('❌ [AUTH] Error checking authentication:', error);
    return false;
  }
};

/**
 * Decode JWT token payload (without verification)
 * @param {string} token - The JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export const decodeToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('❌ [AUTH] Invalid token format');
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    console.log('🔑 [AUTH] Token decoded:', payload);
    return payload;
  } catch (error) {
    console.error('❌ [AUTH] Error decoding token:', error);
    return null;
  }
};

/**
 * Check if token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} True if token is expired or invalid
 */
export const isTokenExpired = (token) => {
  try {
    const payload = decodeToken(token);
    if (!payload) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp && payload.exp < now;
    
    console.log('⏰ [AUTH] Token expiration check:', {
      exp: payload.exp,
      now: now,
      isExpired: isExpired
    });
    
    return isExpired;
  } catch (error) {
    console.error('❌ [AUTH] Error checking token expiration:', error);
    return true;
  }
};

/**
 * Get user ID from token
 * @param {string} token - The JWT token
 * @returns {string|null} User ID or null if not found
 */
export const getUserIdFromToken = (token) => {
  try {
    const payload = decodeToken(token);
    return payload?.ID || payload?.userId || payload?.sub || null;
  } catch (error) {
    console.error('❌ [AUTH] Error getting user ID from token:', error);
    return null;
  }
};

export default {
  getToken,
  saveToken,
  deleteToken,
  isAuthenticated,
  decodeToken,
  isTokenExpired,
  getUserIdFromToken
};
