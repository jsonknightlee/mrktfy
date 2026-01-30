import * as SecureStore from 'expo-secure-store';

export async function saveToken(token) {
  console.log("Login response data:", token);
console.log("token type:", typeof token);

  await SecureStore.setItemAsync('auth_token', token.token);
}

export async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
