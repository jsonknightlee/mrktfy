import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { saveToken, deleteToken, getUserIdFromToken } from './authService';
import { authApi } from './api';
import { saveUserProfile, getUserProfile } from './databaseService';

// OAuth Configuration
const GOOGLE_CLIENT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'your-ios-client-id.apps.googleusercontent.com',
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'your-android-client-id.apps.googleusercontent.com',
  web: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'your-web-client-id.apps.googleusercontent.com',
});

const APPLE_CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 'com.mrktfy.mrktfy';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In with OAuth
 * @returns {Promise<Object>} User profile and authentication data
 */
export const signInWithGoogle = async () => {
  try {
    console.log('🔍 [GOOGLE] Starting Google OAuth flow...');
    
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'mrktfy',
        path: 'oauth/google',
      }),
      responseType: AuthSession.ResponseType.Token,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    console.log('🔍 [GOOGLE] Auth request created:', request);
    
    const result = await request.promptAsync(discovery);
    
    if (result.type === 'success') {
      console.log('✅ [GOOGLE] OAuth successful');
      
      const { accessToken } = result.params;
      
      // Get user profile from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const userProfile = await userInfoResponse.json();
      
      console.log('👤 [GOOGLE] User profile:', userProfile);
      
      // Create unified user data
      const userData = {
        email: userProfile.email,
        name: userProfile.name,
        profilePicture: userProfile.picture,
        provider: 'google',
        providerId: userProfile.id,
        accessToken: accessToken,
      };
      
      // Save to backend and get JWT token
      const authResponse = await authenticateWithBackend(userData);
      
      return {
        success: true,
        user: userData,
        token: authResponse.token,
        profile: authResponse.profile,
      };
    } else {
      console.log('❌ [GOOGLE] OAuth cancelled or failed:', result);
      return { success: false, error: 'OAuth cancelled' };
    }
  } catch (error) {
    console.error('❌ [GOOGLE] OAuth error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Apple Sign-In with OAuth
 * @returns {Promise<Object>} User profile and authentication data
 */
export const signInWithApple = async () => {
  try {
    console.log('🔍 [APPLE] Starting Apple OAuth flow...');
    
    const request = new AuthSession.AuthRequest({
      clientId: APPLE_CLIENT_ID,
      scopes: ['name', 'email'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'mrktfy',
        path: 'oauth/apple',
      }),
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });

    console.log('🔍 [APPLE] Auth request created:', request);
    
    const result = await request.promptAsync();
    
    if (result.type === 'success') {
      console.log('✅ [APPLE] OAuth successful');
      
      const { code } = result.params;
      
      // Exchange code for tokens (this would typically be done on your backend)
      // For now, we'll simulate the response
      const userData = {
        email: result.params.email || 'user@icloud.com',
        name: result.params.name || 'Apple User',
        profilePicture: null,
        provider: 'apple',
        providerId: result.params.user || 'apple-user-id',
        accessToken: code,
      };
      
      console.log('👤 [APPLE] User profile:', userData);
      
      // Save to backend and get JWT token
      const authResponse = await authenticateWithBackend(userData);
      
      return {
        success: true,
        user: userData,
        token: authResponse.token,
        profile: authResponse.profile,
      };
    } else {
      console.log('❌ [APPLE] OAuth cancelled or failed:', result);
      return { success: false, error: 'OAuth cancelled' };
    }
  } catch (error) {
    console.error('❌ [APPLE] OAuth error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Authenticate with backend and save user profile
 * @param {Object} userData - User data from OAuth provider
 * @returns {Promise<Object>} Authentication response
 */
const authenticateWithBackend = async (userData) => {
  try {
    console.log('🔐 [AUTH] Authenticating with backend...');
    
    // Send OAuth data to backend for authentication/registration
    const response = await authApi.post('/oauth/authenticate', {
      provider: userData.provider,
      providerId: userData.providerId,
      email: userData.email,
      name: userData.name,
      profilePicture: userData.profilePicture,
      accessToken: userData.accessToken,
    });
    
    const { token, user } = response.data;
    
    // Save JWT token securely
    await saveToken(token);
    
    // Save user profile to local database
    await saveUserProfile({
      id: user.ID,
      email: user.Email,
      name: user.Name,
      profilePicture: user.ProfilePicture,
      provider: userData.provider,
      providerId: userData.providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ [AUTH] Backend authentication successful');
    
    return {
      token,
      profile: user,
    };
  } catch (error) {
    console.error('❌ [AUTH] Backend authentication error:', error);
    
    // For development, create a mock response
    if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
      console.log('🔧 [AUTH] Using development mock authentication');
      
      const mockToken = 'dev-jwt-token';
      const mockProfile = {
        ID: `dev-${userData.providerId}`,
        Email: userData.email,
        Name: userData.name,
        ProfilePicture: userData.profilePicture,
      };
      
      await saveToken(mockToken);
      await saveUserProfile({
        id: mockProfile.ID,
        email: mockProfile.Email,
        name: mockProfile.Name,
        profilePicture: mockProfile.ProfilePicture,
        provider: userData.provider,
        providerId: userData.providerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      return {
        token: mockToken,
        profile: mockProfile,
      };
    }
    
    throw error;
  }
};

/**
 * Sign out user
 * @returns {Promise<boolean>} Success status
 */
export const signOut = async () => {
  try {
    console.log('🔐 [AUTH] Signing out...');
    
    // Delete token from secure storage
    await deleteToken();
    
    // Clear user profile from local database
    // Note: You might want to keep some data for offline functionality
    console.log('✅ [AUTH] Signed out successfully');
    
    return true;
  } catch (error) {
    console.error('❌ [AUTH] Sign out error:', error);
    return false;
  }
};

/**
 * Get current user profile
 * @returns {Promise<Object|null>} User profile or null
 */
export const getCurrentUser = async () => {
  try {
    const token = await getToken();
    if (!token) {
      return null;
    }
    
    // Try to get from local database first
    const localProfile = await getUserProfile();
    if (localProfile) {
      console.log('👤 [AUTH] User profile from local database');
      return localProfile;
    }
    
    // Fallback to backend API
    const response = await authApi.get('/user/profile');
    const userProfile = response.data;
    
    // Update local database
    await saveUserProfile(userProfile);
    
    return userProfile;
  } catch (error) {
    console.error('❌ [AUTH] Error getting current user:', error);
    return null;
  }
};

/**
 * Refresh authentication token
 * @returns {Promise<string|null>} New token or null
 */
export const refreshToken = async () => {
  try {
    const response = await authApi.post('/auth/refresh');
    const { token } = response.data;
    
    await saveToken(token);
    console.log('🔄 [AUTH] Token refreshed successfully');
    
    return token;
  } catch (error) {
    console.error('❌ [AUTH] Token refresh error:', error);
    return null;
  }
};

export default {
  signInWithGoogle,
  signInWithApple,
  signOut,
  getCurrentUser,
  refreshToken,
};
