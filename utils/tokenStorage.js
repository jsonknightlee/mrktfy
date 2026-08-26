import * as SecureStore from 'expo-secure-store';

const VERBOSE_TOKEN_LOGS = __DEV__ && process.env.EXPO_PUBLIC_VERBOSE_API_LOGS === 'true';

export async function saveToken(token) {
  // Handle both direct string tokens and object responses
  const tokenToSave = typeof token === 'string' ? token : token?.token;
  
  if (!tokenToSave) {
    console.error("❌ No token found in response:", token);
    throw new Error("Login response missing token");
  }
  
  if (VERBOSE_TOKEN_LOGS) {
    console.log("💾 Saving token:", tokenToSave ? '[redacted]' : 'none');
  }
  await SecureStore.setItemAsync('auth_token', tokenToSave);
}

export async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
