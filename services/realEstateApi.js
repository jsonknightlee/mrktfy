import { API_BASE_URL } from '@env';// Replace with your local or deployed API
import {API_KEY} from '@env';


console.log(API_KEY)
export async function fetchNearbyListings(lat, lng, radiusKm = 5) {
  const url = `${API_BASE_URL}/realestate/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`;
  console.log('Calling:', url);

  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
      },
    });

    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType?.includes('application/json')) {
      const text = await res.text();
      console.error('Unexpected response:', res.status, text);
      throw new Error(`Unexpected server response (${res.status})`);
    }

    const data = await res.json();
    console.log('Nearby listings response:', data);
    return data;
  } catch (err) {
    console.error('fetchNearbyListings ERROR:', err.message);
    return [];
  }
}
