import Constants from "expo-constants";
const { API_BASE_URL, API_KEY } = Constants.expoConfig.extra;


// Now supports an optional 4th param: `type` = 'rental' | 'sale'
export async function fetchNearbyListings(lat, lng, radiusKm = 5, type /* optional */) {
  let url = `${API_BASE_URL}/realestate/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }
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

    // 🔥 Clean the ImageUrls field for each listing
    data = data.map((listing) => {
      let imageUrls = [];

      if (typeof listing.ImageUrls === 'string') {
        try {
          const parsed = JSON.parse(listing.ImageUrls);
          if (Array.isArray(parsed)) {
            // Remove :p suffix, keep only 1024/768, and dedupe
            const seen = new Set();
            imageUrls = parsed
              .map((url) => url.replace(':p', ''))
              .filter((url) => url.includes('1024/768') && !seen.has(url) && seen.add(url));
          }
        } catch (e) {
          console.warn('Could not parse ImageUrls for listing ID:', listing.ID, listing.ImageUrls);
        }
      }

      return { ...listing, ImageUrls: imageUrls };
    });

    //console.log('Listings: ' + JSON.stringify(data))

    return data;
  } catch (err) {
    console.error('fetchNearbyListings ERROR:', err.message);
    return [];
  }
}
