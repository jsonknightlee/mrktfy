import { api } from "./api";

export const getListingById = async (id) => {
  const listingId = String(id || '').trim();
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  const routes = [
    `/api/realestate/listings/${listingId}`,
    `/api/listings/${listingId}`,
    `/listings/${listingId}`,
    `/realestate/listings/${listingId}`,
    `/api/realestate/listing/${listingId}`,
    `/realestate/listing/${listingId}`,
  ];
  let lastError = null;

  for (const route of routes) {
    try {
      const { data } = await api.get(route);
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Listing ${listingId} could not be loaded`);
};
