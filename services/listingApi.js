import { api } from "./api";

export const getListingById = async (id) => {
  const listingId = String(id || '').trim();
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  const routes = [
    `/api/listings/${listingId}`,
    `/listings/${listingId}`,
    `/api/realestate/listings/${listingId}`,
    `/realestate/listings/${listingId}`,
    `/api/realestate/listing/${listingId}`,
    `/realestate/listing/${listingId}`,
  ];
  let lastError = null;

  for (const route of routes) {
    try {
      const { data } = await api.get(route);
      console.log('[LISTING] full listing loaded:', {
        listingId,
        route,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
      });
      return data;
    } catch (error) {
      lastError = error;
      console.log('[LISTING] full listing route failed:', {
        listingId,
        route,
        status: error?.response?.status,
        message: error?.message,
      });
    }
  }

  throw lastError || new Error(`Listing ${listingId} could not be loaded`);
};
