import axios from 'axios';
import { API_BASE_URL, API_KEY } from '@env';

const api = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
});

console.log(JSON.stringify(api))

export async function registerUser(data) {
  const res = await api.post('/register', data);
  return res.data;
}

export async function loginUser(data) {
  const res = await api.post('/login', data);
  return res.data.token;
}

export async function fetchUserProfile(token) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error('Invalid token');
  }

  return await res.json();
}

