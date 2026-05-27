import * as SecureStore from 'expo-secure-store';

export async function saveToken(token) {
  console.log("Login response data:", token);
  console.log("token type:", typeof token);

  // Handle both direct string tokens and object responses
  const tokenToSave = typeof token === 'string' ? token : token?.token;
  
  if (!tokenToSave) {
    console.error("❌ No token found in response:", token);
    throw new Error("Login response missing token");
  }
  
  console.log("💾 Saving token (first 30 chars):", tokenToSave.substring(0, 30) + "...");
  await SecureStore.setItemAsync('auth_token', tokenToSave);
}

export async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
