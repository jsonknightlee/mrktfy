import Constants from "expo-constants";
import { Platform } from 'react-native';

const { API_BASE_URL, API_BACKUP_BASE_URL, API_KEY } = Constants.expoConfig.extra;

const resolveDevAndroidUrl = (url) => {
  if (Platform.OS !== 'android' || !__DEV__ || typeof url !== 'string') return url;
  return url.replace(/\/\/localhost(?::(\d+))?(?=[/?#]|$)/g, (match, port) => `//10.0.2.2${port ? `:${port}` : ''}`);
};

const RESOLVED_API_BASE_URL = resolveDevAndroidUrl(API_BASE_URL);
const RESOLVED_API_BACKUP_BASE_URL = resolveDevAndroidUrl(API_BACKUP_BASE_URL);

const NEARBY_FETCH_TIMEOUT_MS = 5000;

const appendParam = (params, key, value) => {
  if (value === undefined || value === null || value === '') return;
  params.append(key, value);
};

const parseBooleanLike = (value) => (
  value === true ||
  value === 1 ||
  String(value).trim().toLowerCase() === 'true' ||
  String(value).trim().toLowerCase() === '1' ||
  String(value).trim().toLowerCase() === 'yes' ||
  String(value).trim().toLowerCase() === 'on'
);

const getListingStatusText = (listing = {}) => String(
  listing.Status ??
  listing.status ??
  listing.ListingStatus ??
  listing.listingStatus ??
  listing.PropertyStatus ??
  listing.propertyStatus ??
  ''
).trim().toLowerCase();

const isSoldListing = (listing = {}) => {
  const status = getListingStatusText(listing);
  return (
    status === 'sold' ||
    status.includes('sold stc') ||
    status.includes('sstc') ||
    status.startsWith('sold ') ||
    status.includes('sold subject to contract')
  );
};

const shouldIncludeSoldProperties = (filters = {}) => {
  const directFlags = [
    filters.includeSoldProperties,
    filters.includeSold,
    filters.includeSoldListings,
    filters.includeSoldPropertiesOnly,
  ];

  if (directFlags.some(parseBooleanLike)) {
    return true;
  }

  const statusValues = [
    filters.status,
    filters.Status,
    filters.listingStatus,
    filters.ListingStatus,
    filters.propertyStatus,
    filters.PropertyStatus,
    filters.statuses,
    filters.Statuses,
  ];

  return statusValues.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  }).some((value) => String(value).trim().toLowerCase().includes('sold'));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = NEARBY_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

// Supports `type` = 'rental' | 'sale', an optional result limit, and server-side filters.
export const fetchNearbyListings = async (lat, lng, radiusKm = 2, type = 'sale', limit = 350, filters = {}) => {
  // Convert 'sale' to 'for-sale' for the API
  const apiType = type === 'sale' ? 'for-sale' : type;
  const params = new URLSearchParams();
  const includeSoldProperties = shouldIncludeSoldProperties(filters);
  appendParam(params, 'lat', lat);
  appendParam(params, 'lng', lng);
  appendParam(params, 'radiusKm', radiusKm);
  appendParam(params, 'type', apiType);
  appendParam(params, 'limit', limit);
  appendParam(params, 'minPrice', filters.minPrice);
  appendParam(params, 'maxPrice', filters.maxPrice && Number(filters.maxPrice) > 1000000 ? '' : filters.maxPrice);
  appendParam(params, 'bedrooms', filters.beds);
  appendParam(params, 'bathrooms', filters.baths);
  if (includeSoldProperties) {
    appendParam(params, 'includeSoldProperties', 'true');
  }

  let url = `${RESOLVED_API_BASE_URL}/realestate/nearby?${params.toString()}`;
  console.log('Calling:', url);

  try {
    const requestOptions = {
      headers: {
        'x-api-key': API_KEY,
        Accept: 'application/json',
      },
    };

    let res;
    try {
      res = await fetchWithTimeout(url, requestOptions);
    } catch (fetchError) {
      if (!API_BACKUP_BASE_URL) throw fetchError;
      console.warn('Primary nearby listings request failed:', fetchError?.name || fetchError?.message || fetchError);
      url = `${RESOLVED_API_BACKUP_BASE_URL}/realestate/nearby?${params.toString()}`;
      console.log('Primary nearby listings request failed, retrying backup:', url);
      res = await fetchWithTimeout(url, requestOptions);
    }

    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType?.includes('application/json')) {
      const text = await res.text();
      console.error('Unexpected nearby listings response:', {
        status: res.status,
        url,
        body: text,
      });
      throw new Error(`Unexpected server response (${res.status}): ${text}`);
    }

    let data = await res.json();
    //console.log('🔍 Raw API response:', data);
    //console.log('🔍 API response type:', typeof data);
    //console.log('🔍 API response length:', Array.isArray(data) ? data.length : 'not an array');
//
    //// Debug: Check what fields are available in the response
    //console.log('🔍 API Response fields check:');
    //console.log('📊 Available fields:', Object.keys(data));
    
    // Handle different response structures
    let listings = [];
    if (Array.isArray(data)) {
      listings = data; // API returns array directly
    } else if (data && data.listings && Array.isArray(data.listings)) {
      listings = data.listings; // API returns {listings: [...] }
    } else if (data && data.data && Array.isArray(data.data)) {
      listings = data.data; // API returns {data: [...] }
    } else {
      console.warn('⚠️ Unexpected API response structure:', data);
      return [];
    }

    console.log('Processed listings count:', listings.length);

    // 🔥 Clean the ImageUrls field for each listing
    data = listings.map((listing) => {
      let imageUrls = [];

      // Handle ImageUrls - could be string, array, or already processed
      if (Array.isArray(listing.ImageUrls)) {
        // Already an array, process directly
        const seen = new Set();
        imageUrls = listing.ImageUrls
          .map((url) => url.replace(':p', ''))
          .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
      } else if (typeof listing.ImageUrls === 'string') {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(listing.ImageUrls);
          if (Array.isArray(parsed)) {
            // Remove :p suffix, keep only 1024/768, and dedupe
            const seen = new Set();
            imageUrls = parsed
              .map((url) => url.replace(':p', ''))
              .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
          }
        } catch (e) {
          // Alternative: Manual parsing if JSON.parse fails
          try {
            const cleanString = listing.ImageUrls.trim();
            if (cleanString.startsWith('[') && cleanString.endsWith(']')) {
              // Remove brackets and split by comma
              const items = cleanString.slice(1, -1).split(',').map(item => item.trim().replace(/^"|"$/g, ''));
              const seen = new Set();
              imageUrls = items
                .map((url) => url.replace(':p', ''))
                .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
            }
          } catch {}
        }
      }

      // 🔍 Preserve new fields if they exist
      const preservedFields = {};
      ['PropertyTimeline', 'Schools', 'Stations', 'AdditionalInfo'].forEach(field => {
        if (listing[field] !== undefined) {
          preservedFields[field] = listing[field];
        }
      });

      return { ...listing, ImageUrls: imageUrls, ...preservedFields };
    });

    if (!includeSoldProperties) {
      data = data.filter((listing) => !isSoldListing(listing));
    }

    //console.log('Listings: ' + JSON.stringify(data))

    return data;
  } catch (err) {
    console.error('fetchNearbyListings ERROR:', {
      message: err?.message,
      lat,
      lng,
      radiusKm,
      type,
    });
    return [];
  }
}
