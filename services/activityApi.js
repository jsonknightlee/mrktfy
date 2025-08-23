// services/activityApi.js
import { api } from './api';



const transformItem = (it) => {

      if (typeof it.ImageUrls === 'string') {
        try {
          const parsed = JSON.parse(it.ImageUrls);
          if (Array.isArray(parsed)) {
            // Remove :p suffix, keep only 1024/768, and dedupe
            const seen = new Set();
            imageUrls = parsed
              .map((url) => url.replace(':p', ''))
              .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
             
          }
           it.ImageUrls = imageUrls;
        } catch (e) {
          console.warn('Could not parse ImageUrls for listing ID:', it.ID, it.ImageUrls);
        }
      }

      return it;
    
}

/* ---------------- API ---------------- */

export const getFavorites = async () => {
  const { data } = await api.get('/activity/users/me/favorites');
  const items = data?.items ?? [];
  return items.map(transformItem);
};

export const getHistory = async (limit = 30) => {
  const { data } = await api.get('/activity/users/me/history', { params: { limit } });
  const items = data?.items ?? [];
  return items.map(transformItem);
};

export const markViewed = async (listingId) => {
  await api.post(`/activity/listings/${listingId}/view`);
};

export const setFavorite = async (listingId, on) => {
  const url = `/activity/listings/${listingId}/favorite`;
  if (on) await api.post(url);
  else await api.delete(url);
};
