import Constants from "expo-constants";
const { API_BASE_URL, API_KEY } = Constants.expoConfig.extra;

// Now supports an optional 4th param: `type` = 'rental' | 'sale'
export const fetchNearbyListings = async (lat, lng, radiusKm = 2, type = 'sale') => {
  // Convert 'sale' to 'for-sale' for the API
  const apiType = type === 'sale' ? 'for-sale' : type;
  let url = `${API_BASE_URL}/realestate/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&type=${apiType}`;
  console.log('Calling:', url);

  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': API_KEY,
        Accept: 'application/json',
      },
    });

    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType?.includes('application/json')) {
      const text = await res.text();
      console.error('Unexpected response:', res.status, text);
      throw new Error(`Unexpected server response (${res.status})`);
    }

    let data = await res.json();
    console.log('🔍 Raw API response:', data);
    console.log('🔍 API response type:', typeof data);
    console.log('🔍 API response length:', Array.isArray(data) ? data.length : 'not an array');

    // Debug: Check what fields are available in the response
    console.log('🔍 API Response fields check:');
    console.log('📊 Available fields:', Object.keys(data));
    
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

    console.log('� Processed listings count:', listings.length);
    
    if (listings.length > 0) {
      const sampleListing = listings[0];
      console.log('📊 Sample listing fields:', Object.keys(sampleListing));
    }

    // 🔥 Clean the ImageUrls field for each listing
    data = listings.map((listing) => {
      let imageUrls = [];

      // Handle ImageUrls - could be string, array, or already processed
      console.log('🔍 ImageUrls type check for listing ID:', listing.ID, 'type:', typeof listing.ImageUrls, 'isArray:', Array.isArray(listing.ImageUrls));
      
      if (Array.isArray(listing.ImageUrls)) {
        // Already an array, process directly
        const seen = new Set();
        imageUrls = listing.ImageUrls
          .map((url) => url.replace(':p', ''))
          .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
        console.log('🖼️ ImageUrls already array for listing ID:', listing.ID, 'processed:', imageUrls.length);
      } else if (typeof listing.ImageUrls === 'string') {
        console.log('🔍 Processing ImageUrls string for listing ID:', listing.ID);
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(listing.ImageUrls);
          if (Array.isArray(parsed)) {
            // Remove :p suffix, keep only 1024/768, and dedupe
            const seen = new Set();
            imageUrls = parsed
              .map((url) => url.replace(':p', ''))
              .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
            console.log('🖼️ ImageUrls parsed from JSON string for listing ID:', listing.ID, 'processed:', imageUrls.length);
          } else {
            console.log('🔍 Parsed result is not an array for listing ID:', listing.ID, 'type:', typeof parsed);
          }
        } catch (e) {
          console.warn('JSON parsing failed for listing ID:', listing.ID, 'trying alternative method');
          
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
              console.log('🖼️ ImageUrls processed via alternative method for listing ID:', listing.ID, 'processed:', imageUrls.length);
            } else {
              console.warn('Invalid format for listing ID:', listing.ID, 'not starting/ending with brackets');
            }
          } catch (altError) {
            console.warn('Alternative parsing also failed for listing ID:', listing.ID, altError.message);
          }
        }
      } else {
        console.log('🖼️ ImageUrls not found or invalid type for listing ID:', listing.ID, typeof listing.ImageUrls);
      }

      // 🔍 Preserve new fields if they exist
      const preservedFields = {};
      ['PropertyTimeline', 'Schools', 'Stations', 'AdditionalInfo'].forEach(field => {
        if (listing[field] !== undefined) {
          preservedFields[field] = listing[field];
          console.log(`✅ Preserved ${field}:`, typeof listing[field], listing[field]);
        }
      });

      return { ...listing, ImageUrls: imageUrls, ...preservedFields };
    });

    //console.log('Listings: ' + JSON.stringify(data))

    return data;
  } catch (err) {
    console.error('fetchNearbyListings ERROR:', err.message);
    return [];
  }
}
