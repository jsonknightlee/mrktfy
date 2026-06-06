import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationStorageService from './NotificationStorageService';

const SHORTLIST_KEY = 'mrktfy_property_deck_shortlist';
const DISMISSED_KEY = 'mrktfy_property_deck_dismissed';

export const getListingId = (listing) => {
  if (!listing) return '';
  return String(
    listing.ID ??
    listing.id ??
    listing.ListingID ??
    listing.listingId ??
    ''
  );
};

const readJsonArray = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[PROPERTY-DECK] Failed to read ${key}:`, error);
    return [];
  }
};

const writeJsonArray = async (key, value) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const normalizeListing = (listing, notification) => ({
  ...listing,
  ID: getListingId(listing) || listing.ID,
  sourceNotificationId: notification?.id,
  sourceNotificationTitle: notification?.title,
  matchedAt: notification?.timestamp || Date.now(),
});

export const getShortlist = async () => {
  return readJsonArray(SHORTLIST_KEY);
};

export const getDismissedListingIds = async () => {
  return readJsonArray(DISMISSED_KEY);
};

export const getMatchedDeckListings = async () => {
  const [notifications, shortlist, dismissedIds] = await Promise.all([
    NotificationStorageService.getNotifications(),
    getShortlist(),
    getDismissedListingIds(),
  ]);

  const excludedIds = new Set([
    ...shortlist.map(getListingId).filter(Boolean),
    ...dismissedIds.map(String),
  ]);

  const seenIds = new Set();
  const listings = [];

  notifications.forEach((notification) => {
    const notificationListings = Array.isArray(notification.listings)
      ? notification.listings
      : [];

    notificationListings.forEach((listing) => {
      const listingId = getListingId(listing);
      if (!listingId || seenIds.has(listingId) || excludedIds.has(listingId)) {
        return;
      }

      seenIds.add(listingId);
      listings.push(normalizeListing(listing, notification));
    });
  });

  return listings;
};

export const saveToShortlist = async (listing) => {
  const listingId = getListingId(listing);
  if (!listingId) return [];

  const shortlist = await getShortlist();
  const nextShortlist = [
    {
      ...listing,
      ID: listingId,
      shortlistedAt: listing.shortlistedAt || Date.now(),
    },
    ...shortlist.filter((item) => getListingId(item) !== listingId),
  ];

  await writeJsonArray(SHORTLIST_KEY, nextShortlist);
  return nextShortlist;
};

export const dismissDeckListing = async (listingId) => {
  const id = String(listingId || '');
  if (!id) return [];

  const dismissedIds = await getDismissedListingIds();
  const nextDismissedIds = Array.from(new Set([id, ...dismissedIds.map(String)]));
  await writeJsonArray(DISMISSED_KEY, nextDismissedIds);
  return nextDismissedIds;
};

export const removeFromShortlist = async (listingId) => {
  const id = String(listingId || '');
  if (!id) return [];

  const shortlist = await getShortlist();
  const nextShortlist = shortlist.filter((item) => getListingId(item) !== id);
  await writeJsonArray(SHORTLIST_KEY, nextShortlist);
  return nextShortlist;
};
