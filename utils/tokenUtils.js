import {jwtDecode} from 'jwt-decode';
import { getToken } from './tokenStorage';

export async function getUserIdFromToken(){
  const token = await getToken(); 
  if (!token) return null;
  try {
    const decoded = jwtDecode(token); 
  console.log('zzzzzzzzzzz:', decoded)
    return decoded.ID;
  } catch (err) {
    console.error('Failed to decode token:', err);
    return null;
  }
};