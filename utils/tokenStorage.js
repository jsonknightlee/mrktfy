import * as SecureStore from 'expo-secure-store';

export async function saveToken(token) {
  await SecureStore.setItemAsync('auth_token', token);
}

export async function getToken() {
  return await SecureStore.getItemAsync('auth_token');
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
