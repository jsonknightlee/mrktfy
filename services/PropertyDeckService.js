import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationStorageService from './NotificationStorageService';
import { api } from './api';

const DECKS_KEY = 'mrktfy_property_decks';
const LEGACY_SHORTLIST_KEY = 'mrktfy_property_deck_shortlist';
const LEGACY_DISMISSED_KEY = 'mrktfy_property_deck_dismissed';
const apiFailureCache = new Map();
const apiInFlightLabels = new Set();

export const PROPERTY_DECK_LIMITS = {
  free: 0,
  prospector: 1,
  investor: 5,
  developer: 10,
};

export const getPropertyDeckLimit = (tier) => {
  const normalizedTier = String(tier || 'free').toLowerCase();
  return PROPERTY_DECK_LIMITS[normalizedTier] ?? 0;
};

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

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parseJsonObject(parsed);
    return parsed;
  } catch {
    return null;
  }
};

const getCoordinateValue = (source, keys) => {
  for (const key of keys) {
    const value = toNumber(source?.[key]);
    if (value !== null) return value;
  }

  return null;
};

const isBackendId = (value) => {
  const stringValue = String(value ?? '').trim();
  return /^[0-9]+$/.test(stringValue);
};

const requireBackendId = (value, label) => {
  if (!isBackendId(value)) {
    const error = new Error(`${label} is local-only or invalid: ${value}`);
    error.localOnly = true;
    throw error;
  }
};

const calculateDistanceMiles = (fromLatitude, fromLongitude, toLatitude, toLongitude) => {
  const lat1 = toNumber(fromLatitude);
  const lon1 = toNumber(fromLongitude);
  const lat2 = toNumber(toLatitude);
  const lon2 = toNumber(toLongitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const distanceMiles = earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number(distanceMiles.toFixed(2));
};

const withSearchDistance = (listing, filterJson) => {
  const parsedFilterJson = parseJsonObject(filterJson) || {};
  const existingDistanceMiles = toNumber(
    listing?.distanceMiles ??
    listing?.DistanceMiles ??
    listing?.searchDistanceMiles ??
    listing?.SearchDistanceMiles
  );

  if (existingDistanceMiles !== null) {
    const roundedDistanceMiles = Number(existingDistanceMiles.toFixed(2));
    return {
      ...listing,
      distanceMiles: roundedDistanceMiles,
      SearchDistanceMiles: roundedDistanceMiles,
    };
  }

  const distanceMiles = calculateDistanceMiles(
    getCoordinateValue(parsedFilterJson, ['latitude', 'Latitude', 'lat', 'Lat', 'centerLatitude', 'CenterLatitude']),
    getCoordinateValue(parsedFilterJson, ['longitude', 'Longitude', 'lng', 'Lng', 'lon', 'Lon', 'centerLongitude', 'CenterLongitude']),
    getCoordinateValue(listing, ['Latitude', 'latitude', 'lat', 'Lat', 'ListingLatitude', 'listingLatitude']),
    getCoordinateValue(listing, ['Longitude', 'longitude', 'lng', 'Lng', 'lon', 'Lon', 'ListingLongitude', 'listingLongitude'])
  );

  if (distanceMiles === null) return listing;

  return {
    ...listing,
    distanceMiles,
    SearchDistanceMiles: distanceMiles,
  };
};

const withDeckSearchDistance = (listing, deck) => withSearchDistance(listing, deck?.filterJson || deck?.FilterJson);

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

export const clearLocalPropertyDeckCache = async () => {
  await Promise.all([
    AsyncStorage.removeItem(DECKS_KEY),
    AsyncStorage.removeItem(LEGACY_SHORTLIST_KEY),
    AsyncStorage.removeItem(LEGACY_DISMISSED_KEY),
  ]);
};

const withApiFallback = async (request, fallback, label) => {
  apiInFlightLabels.add(label);

  try {
    const result = await request();
    apiFailureCache.delete(label);
    return result;
  } catch (error) {
    if (error?.localOnly) {
      return fallback();
    }

    const statusOrMessage = error?.response?.status || error?.message;
    apiFailureCache.set(label, {
      at: Date.now(),
      reason: statusOrMessage,
    });
    console.log(`[PROPERTY-DECK] ${label} API failed:`, {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    throw error;
  } finally {
    apiInFlightLabels.delete(label);
  }
};

const getItems = (data, key) => {
  const value = data?.items ?? data?.[key] ?? data?.data ?? data;
  return Array.isArray(value) ? value : [];
};

const getFirstArray = (data, keys = []) => {
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
  }

  return getItems(data, keys[0]);
};

const getUserDisplayName = (userProfile) => {
  const fullName = [
    userProfile?.FirstName || userProfile?.firstName,
    userProfile?.LastName || userProfile?.lastName,
  ].filter(Boolean).join(' ').trim();

  const email = userProfile?.Email || userProfile?.email || userProfile?.Username || userProfile?.username;
  if (fullName) return fullName;
  if (email && String(email).includes('@')) return String(email).split('@')[0];
  if (email) return String(email);
  return 'My';
};

const getFilterLabel = (userProfile) => {
  const listingType = userProfile?.ListingTypePreference || userProfile?.listingTypePreference;
  const propertyType = userProfile?.PropertyTypePreferences || userProfile?.propertyTypePreferences;
  const city = userProfile?.City || userProfile?.city;

  const parsedPropertyType = Array.isArray(propertyType)
    ? propertyType[0]
    : String(propertyType || '').split(',')[0].trim();

  return [listingType, parsedPropertyType, city]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Matched Properties';
};

export const generatePropertyDeckName = (userProfile, index = 1) => {
  return `Property Deck ${index}`;
};

const normalizeDeck = (deck) => {
  const deckStatus = deck.deckStatus || deck.DeckStatus || deck.status || deck.Status || 'active';
  const deletedAt = deck.deletedAt || deck.DeletedAt || null;
  const normalizedStatus = String(deckStatus || '').toLowerCase();
  const deletedFlag = deck.isDeleted ?? deck.IsDeleted;
  const isDeletedFlag = deletedFlag === true || deletedFlag === 1 || String(deletedFlag).toLowerCase() === 'true';
  const isDeleted = Boolean(
    isDeletedFlag ||
    deletedAt ||
    normalizedStatus === 'deleted' ||
    normalizedStatus === 'archived'
  );

  return {
    id: String(deck.id || deck.ID || `deck-${Date.now()}`),
    name: deck.name || deck.Name || 'Property Deck',
    filterLabel: deck.filterLabel || deck.FilterLabel || 'Matched Properties',
    filterJson: deck.filterJson || deck.FilterJson || null,
    deckStatus: isDeleted ? 'deleted' : deckStatus,
    isDeleted,
    deletedAt,
    createdAt: deck.createdAt || deck.CreatedAt || Date.now(),
    updatedAt: deck.updatedAt || deck.UpdatedAt || Date.now(),
    listings: Array.isArray(deck.listings) ? deck.listings.map((listing) => normalizeListing(listing)) : [],
    shortlist: Array.isArray(deck.shortlist) ? deck.shortlist : [],
    dismissedListingIds: Array.isArray(deck.dismissedListingIds) ? deck.dismissedListingIds.map(String) : [],
    shortlistCount: deck.shortlistCount ?? deck.ShortlistCount ?? deck.shortlist?.length ?? 0,
    deckListingCount: deck.deckListingCount ?? deck.DeckListingCount ?? deck.listings?.length ?? 0,
  };
};

const normalizeListing = (listing, notification) => {
  const listingPayload = parseJsonObject(
    listing.listingJson ||
    listing.ListingJson ||
    listing.listingData ||
    listing.ListingData ||
    listing.propertyJson ||
    listing.PropertyJson ||
    listing.rawListingJson ||
    listing.RawListingJson
  );
  const sourceListing = {
    ...(listingPayload || {}),
    ...(listing.listing || listing.Listing || listing),
  };
  const distanceMiles = toNumber(
    listing.distanceMiles ??
    listing.DistanceMiles ??
    listing.searchDistanceMiles ??
    listing.SearchDistanceMiles ??
    sourceListing.distanceMiles ??
    sourceListing.DistanceMiles ??
    sourceListing.searchDistanceMiles ??
    sourceListing.SearchDistanceMiles
  );

  return {
    ...sourceListing,
    propertyDeckListingId: listing.propertyDeckListingId || listing.PropertyDeckListingID || null,
    ID: getListingId(sourceListing) || getListingId(listing),
    status: listing.status || listing.Status,
    matchScore: listing.matchScore ?? listing.MatchScore,
    rank: listing.rank ?? listing.Rank,
    userIntent: listing.userIntent ?? listing.UserIntent ?? null,
    propertyRank: listing.propertyRank ?? listing.PropertyRank ?? null,
    yourFitRank: listing.yourFitRank ?? listing.YourFitRank ?? null,
    confidenceScore: listing.confidenceScore ?? listing.ConfidenceScore ?? null,
    scoreBreakdownJson: listing.scoreBreakdownJson ?? listing.ScoreBreakdownJson ?? null,
    rankingExplanation: listing.rankingExplanation ?? listing.RankingExplanation ?? null,
    prosJson: listing.prosJson || listing.ProsJson,
    consJson: listing.consJson || listing.ConsJson,
    metricsJson: listing.metricsJson || listing.MetricsJson,
    comparisonBoardListingId: listing.comparisonBoardListingId || listing.ComparisonBoardListingID || null,
    shortListListingId: listing.shortListListingId || listing.ShortListListingID || null,
    generalPropertyRating: listing.generalPropertyRating ?? listing.GeneralPropertyRating,
    userPropertyRating: listing.userPropertyRating ?? listing.UserPropertyRating,
    boardRank: listing.boardRank ?? listing.BoardRank,
    aiSummary: listing.aiSummary || listing.AiSummary,
    favoriteLevel: listing.favoriteLevel ?? listing.FavoriteLevel,
    distanceMiles,
    SearchDistanceMiles: distanceMiles,
    sourceNotificationId: notification?.id,
    sourceNotificationTitle: notification?.title,
    matchedAt: notification?.timestamp || Date.now(),
  };
};

const normalizeComparisonBoard = (board) => {
  if (!board) return null;
  const sourceBoard = board.board || board.Board || board;
  const listings = Array.isArray(sourceBoard.listings)
    ? sourceBoard.listings
    : Array.isArray(sourceBoard.Listings)
      ? sourceBoard.Listings
      : [];

  return {
    id: String(sourceBoard.id || sourceBoard.ID || ''),
    propertyDeckId: String(sourceBoard.propertyDeckId || sourceBoard.PropertyDeckID || ''),
    shortListId: String(sourceBoard.shortListId || sourceBoard.ShortListID || ''),
    name: sourceBoard.name || sourceBoard.Name || 'Decider Board',
    boardStatus: sourceBoard.boardStatus || sourceBoard.BoardStatus || 'active',
    summaryJson: sourceBoard.summaryJson || sourceBoard.SummaryJson || null,
    comparisons: sourceBoard.comparisons || sourceBoard.Comparisons || [],
    listings: listings.map((item) => normalizeListing(item)),
    createdAt: sourceBoard.createdAt || sourceBoard.CreatedAt || null,
    updatedAt: sourceBoard.updatedAt || sourceBoard.UpdatedAt || null,
  };
};

const migrateLegacyDeck = async (userProfile) => {
  const [legacyShortlist, legacyDismissedIds] = await Promise.all([
    readJsonArray(LEGACY_SHORTLIST_KEY),
    readJsonArray(LEGACY_DISMISSED_KEY),
  ]);

  if (!legacyShortlist.length && !legacyDismissedIds.length) return null;

  return {
    id: `deck-${Date.now()}`,
    name: generatePropertyDeckName(userProfile, 1),
    filterLabel: getFilterLabel(userProfile),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    shortlist: legacyShortlist,
    dismissedListingIds: legacyDismissedIds.map(String),
  };
};

const getLocalPropertyDecks = async (userProfile) => {
  const decks = (await readJsonArray(DECKS_KEY)).map(normalizeDeck);

  if (decks.length) {
    return decks;
  }

  const migratedDeck = await migrateLegacyDeck(userProfile);
  if (!migratedDeck) return [];

  await writeJsonArray(DECKS_KEY, [migratedDeck]);
  return [migratedDeck];
};

export const getPropertyDecks = async (userProfile) => withApiFallback(
  async () => {
    const { data } = await api.get('/api/property-decks', {
      params: { includeDeleted: true },
    });
    return getItems(data, 'decks').map(normalizeDeck);
  },
  async () => [],
  'get decks'
);

const createLocalPropertyDeck = async ({ userProfile, limit }) => {
  const decks = await getLocalPropertyDecks(userProfile);
  if (decks.length >= limit) {
    return decks;
  }

  const nextDeck = {
    id: `deck-${Date.now()}`,
    name: generatePropertyDeckName(userProfile, decks.length + 1),
    filterLabel: getFilterLabel(userProfile),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    listings: [],
    shortlist: [],
    dismissedListingIds: [],
  };

  const nextDecks = [...decks, nextDeck];
  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks;
};

export const createPropertyDeck = async ({ userProfile, limit }) => withApiFallback(
  async () => {
    const decks = await getPropertyDecks(userProfile);
    if (decks.length >= limit) return decks;

    const { data } = await api.post('/api/property-decks', {
      name: generatePropertyDeckName(userProfile, decks.length + 1),
      filterJson: {
        listingType: userProfile?.ListingTypePreference || userProfile?.listingTypePreference || null,
        propertyType: userProfile?.PropertyTypePreferences || userProfile?.propertyTypePreferences || null,
        city: userProfile?.City || userProfile?.city || null,
      },
    });

    const createdDeck = normalizeDeck(data?.deck || data);
    return [...decks, createdDeck];
  },
  () => createLocalPropertyDeck({ userProfile, limit }),
  'create deck'
);

const createLocalPropertyDeckFromListings = async ({ userProfile, limit, listings = [], name, filterJson }) => {
  const decks = await getLocalPropertyDecks(userProfile);
  if (decks.length >= limit) return decks;

  const deckId = `deck-${Date.now()}`;
  const now = Date.now();
  const normalizedListings = listings.map((listing, index) => ({
    ...normalizeListing(withSearchDistance(listing, filterJson)),
    propertyDeckListingId: `${deckId}-listing-${getListingId(listing) || index}`,
    status: 'matched',
    rank: index + 1,
    matchedAt: now,
  }));

  const nextDeck = {
    id: deckId,
    name: name || generatePropertyDeckName(userProfile, decks.length + 1),
    filterLabel: getFilterLabel(userProfile),
    filterJson: filterJson || null,
    createdAt: now,
    updatedAt: now,
    listings: normalizedListings,
    shortlist: [],
    dismissedListingIds: [],
    deckListingCount: normalizedListings.length,
  };

  const nextDecks = [...decks, nextDeck];
  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks;
};

export const createPropertyDeckFromListings = async ({ userProfile, limit, listings = [], name, filterJson }) => withApiFallback(
  async () => {
    const decks = await getPropertyDecks(userProfile);
    if (decks.length >= limit) return decks;

    const listingIds = [];
    const seenListingIds = new Set();
    listings.forEach((listing) => {
      const listingId = getListingId(listing);
      if (listingId && !seenListingIds.has(listingId)) {
        seenListingIds.add(listingId);
        listingIds.push(listingId);
      }
    });

    console.log('[PROPERTY-DECK] creating deck from map listings:', {
      listingCount: listings.length,
      payloadListingCount: listingIds.length,
      firstListingId: listingIds[0],
      payloadMode: 'listingIds',
    });

    const { data } = await api.post('/api/property-decks/from-listings', {
      name: name || generatePropertyDeckName(userProfile, decks.length + 1),
      filterJson,
      listingIds,
      listings: listingIds.map((listingId, index) => ({
        listingId,
        ListingID: listingId,
        rank: index + 1,
        Rank: index + 1,
        status: 'matched',
        Status: 'matched',
      })),
    });

    const createdDeck = normalizeDeck(data?.deck || data);
    if (listingIds.length && !Number(createdDeck.deckListingCount || 0)) {
      console.log('[PROPERTY-DECK] backend created deck but returned zero deck listings:', {
        deckId: createdDeck.id,
        sentListingCount: listingIds.length,
        response: data,
      });
    }

    return {
      decks: [...decks, createdDeck],
      createdDeck,
    };
  },
  () => createLocalPropertyDeckFromListings({ userProfile, limit, listings, name, filterJson }),
  'create deck from listings'
);

const renameLocalPropertyDeck = async (deckId, name, userProfile) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return getLocalPropertyDecks(userProfile);

  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.map((deck) => (
    deck.id === deckId
      ? { ...deck, name: trimmedName, updatedAt: Date.now() }
      : deck
  ));

  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks;
};

export const renamePropertyDeck = async (deckId, name, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    await api.patch(`/api/property-decks/${deckId}`, { name });
    return getPropertyDecks(userProfile);
  },
  () => renameLocalPropertyDeck(deckId, name, userProfile),
  'rename deck'
);

const setLocalPropertyDeckDeletedState = async (deckId, userProfile, isDeleted) => {
  const now = Date.now();
  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.map((deck) => (
    deck.id === String(deckId)
      ? {
          ...deck,
          deckStatus: isDeleted ? 'deleted' : 'active',
          isDeleted,
          deletedAt: isDeleted ? deck.deletedAt || now : null,
          updatedAt: now,
        }
      : deck
  ));

  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks.map(normalizeDeck);
};

const destroyLocalPropertyDeck = async (deckId, userProfile) => {
  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.filter((deck) => deck.id !== String(deckId));
  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks.map(normalizeDeck);
};

const logDeckMutationError = (label, error) => {
  console.log(`[PROPERTY-DECK] ${label} failed:`, {
    status: error?.response?.status,
    data: error?.response?.data,
    message: error?.message,
  });
};

const mergeDeckSnapshot = (decks, deckSnapshot, fallback = {}) => {
  const snapshot = deckSnapshot?.deck || deckSnapshot?.propertyDeck || deckSnapshot || {};
  const targetId = String(snapshot.id || snapshot.ID || fallback.id || fallback.ID || '');
  const existingDeck = decks.find((deck) => deck.id === targetId) || {};
  const normalizedDeck = normalizeDeck({
    ...existingDeck,
    ...fallback,
    ...snapshot,
  });

  if (!normalizedDeck.id) return decks;

  const foundDeck = decks.some((deck) => deck.id === normalizedDeck.id);
  if (!foundDeck) return [normalizedDeck, ...decks];

  return decks.map((deck) => (
    deck.id === normalizedDeck.id
      ? { ...deck, ...normalizedDeck }
      : deck
  ));
};

export const archivePropertyDeck = async (deckId, userProfile) => {
  if (!isBackendId(deckId)) {
    return setLocalPropertyDeckDeletedState(deckId, userProfile, true);
  }

  try {
    const deletedAt = new Date().toISOString();
    const existingDeck = (await getPropertyDecks(userProfile)).find((deck) => deck.id === String(deckId));
    const { data } = await api.patch(`/api/property-decks/${deckId}`, {
      name: existingDeck?.name || existingDeck?.Name || 'Property Deck',
      deckStatus: 'deleted',
      isDeleted: true,
      deletedAt,
    });
    const decks = await getPropertyDecks(userProfile);
    return mergeDeckSnapshot(decks, data, {
      id: deckId,
      deckStatus: 'deleted',
      isDeleted: true,
      deletedAt,
    });
  } catch (error) {
    logDeckMutationError('archive deck', error);
    throw error;
  }
};

export const restorePropertyDeck = async (deckId, userProfile) => {
  if (!isBackendId(deckId)) {
    return setLocalPropertyDeckDeletedState(deckId, userProfile, false);
  }

  try {
    const existingDeck = (await getPropertyDecks(userProfile)).find((deck) => deck.id === String(deckId));
    const { data } = await api.patch(`/api/property-decks/${deckId}`, {
      name: existingDeck?.name || existingDeck?.Name || 'Property Deck',
      deckStatus: 'active',
      isDeleted: false,
      deletedAt: null,
    });
    const decks = await getPropertyDecks(userProfile);
    return mergeDeckSnapshot(decks, data, {
      id: deckId,
      deckStatus: 'active',
      isDeleted: false,
      deletedAt: null,
    });
  } catch (error) {
    logDeckMutationError('restore deck', error);
    throw error;
  }
};

export const destroyPropertyDeck = async (deckId, userProfile) => {
  if (!isBackendId(deckId)) {
    return destroyLocalPropertyDeck(deckId, userProfile);
  }

  try {
    const destroyAttempts = [
      () => api.delete(`/api/property-decks/${deckId}`, { params: { destroy: true } }),
      () => api.delete(`/api/property-decks/${deckId}/destroy`),
      () => api.post(`/api/property-decks/${deckId}/destroy`),
    ];
    let lastError = null;

    for (const destroyAttempt of destroyAttempts) {
      try {
        await destroyAttempt();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    const decks = await getPropertyDecks(userProfile);
    return decks.filter((deck) => deck.id !== String(deckId));
  } catch (error) {
    logDeckMutationError('destroy deck', error);
    throw error;
  }
};

export const getPropertyDeck = async (deckId, userProfile) => {
  const decks = await getPropertyDecks(userProfile);
  return decks.find((deck) => deck.id === deckId) || null;
};

const getLocalMatchedDeckListings = async (deckId, userProfile) => {
  const deck = await getPropertyDeck(deckId, userProfile);

  if (!deck) return [];

  const excludedIds = new Set([
    ...deck.shortlist.map(getListingId).filter(Boolean),
    ...deck.dismissedListingIds.map(String),
  ]);

  const seenIds = new Set();
  const listings = [];

  if (deck.listings.length) {
    deck.listings.forEach((listing) => {
      const listingId = getListingId(listing);
      if (
        !listingId ||
        seenIds.has(listingId) ||
        excludedIds.has(listingId) ||
        ['shortlisted', 'skipped', 'hidden', 'archived'].includes(String(listing.status || '').toLowerCase())
      ) {
        return;
      }

      seenIds.add(listingId);
      listings.push(normalizeListing(listing));
    });

    return listings;
  }

  const notifications = await NotificationStorageService.getNotifications();

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

export const getMatchedDeckListings = async (deckId, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const [deck, response] = await Promise.all([
      getPropertyDeck(deckId, userProfile),
      api.get(`/api/property-decks/${deckId}/listings`, {
        params: { status: 'matched' },
        timeout: 45000,
      }),
    ]);

    let responseData = response.data;
    let responseListings = getFirstArray(responseData, [
      'listings',
      'deckListings',
      'propertyDeckListings',
      'propertyDeckListing',
      'items',
      'data',
    ]);

    if (!responseListings.length) {
      const unfilteredResponse = await api.get(`/api/property-decks/${deckId}/listings`, {
        timeout: 45000,
      });
      const unfilteredListings = getFirstArray(unfilteredResponse.data, [
        'listings',
        'deckListings',
        'propertyDeckListings',
        'propertyDeckListing',
        'items',
        'data',
      ]);

      if (unfilteredListings.length) {
        responseData = unfilteredResponse.data;
        responseListings = unfilteredListings;
      }
    }

    console.log('[PROPERTY-DECK] loaded deck listings response:', {
      deckId,
      responseKeys: responseData && typeof responseData === 'object' ? Object.keys(responseData) : [],
      listingCount: responseListings.length,
      firstItemKeys: responseListings[0] && typeof responseListings[0] === 'object' ? Object.keys(responseListings[0]) : [],
    });

    return responseListings
      .map((item) => normalizeListing(item))
      .map((listing) => withDeckSearchDistance(listing, deck));
  },
  () => getLocalMatchedDeckListings(deckId, userProfile),
  'get deck listings'
);

const saveLocalToShortlist = async (deckId, listing, userProfile) => {
  const listingId = getListingId(listing);
  if (!listingId) return [];

  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.map((deck) => {
    if (deck.id !== deckId) return deck;

    const shortlist = [
      {
        ...listing,
        ID: listingId,
        shortlistedAt: listing.shortlistedAt || Date.now(),
      },
      ...deck.shortlist.filter((item) => getListingId(item) !== listingId),
    ];

    const listings = deck.listings.map((deckListing) => (
      getListingId(deckListing) === listingId
        ? { ...deckListing, status: 'shortlisted', updatedAt: Date.now() }
        : deckListing
    ));

    return { ...deck, listings, shortlist, updatedAt: Date.now() };
  });

  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks.find((deck) => deck.id === deckId)?.shortlist || [];
};

export const saveToShortlist = async (deckId, listing, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const listingId = getListingId(listing);
    const listingWithDistance = withSearchDistance(listing, (await getPropertyDeck(deckId, userProfile))?.filterJson);
    const { data } = await api.post(`/api/property-decks/${deckId}/shortlist`, {
      listingId,
      sourcePropertyDeckListingId: listing.propertyDeckListingId || null,
      distanceMiles: listingWithDistance.distanceMiles,
      searchDistanceMiles: listingWithDistance.SearchDistanceMiles,
    });
    const deck = await getPropertyDeck(deckId, userProfile);
    return getItems(data, 'shortlist')
      .map((item) => normalizeListing(item))
      .map((item) => withDeckSearchDistance(item, deck));
  },
  () => saveLocalToShortlist(deckId, listing, userProfile),
  'save shortlist listing'
);

export const updateShortlistRanking = async (deckId, listingId, rankingPayload = {}, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const { data } = await api.patch(`/api/property-decks/${deckId}/shortlist/${listingId}/ranking`, rankingPayload);
    const deck = await getPropertyDeck(deckId, userProfile);
    return getItems(data, 'shortlist')
      .map((item) => normalizeListing(item))
      .map((item) => withDeckSearchDistance(item, deck));
  },
  async () => {
    const id = String(listingId || '');
    if (!id) return [];

    const decks = await getLocalPropertyDecks(userProfile);
    const nextDecks = decks.map((deck) => {
      if (deck.id !== deckId) return deck;

      return {
        ...deck,
        shortlist: (deck.shortlist || []).map((item) => (
          getListingId(item) === id ? { ...item, ...rankingPayload } : item
        )),
        updatedAt: Date.now(),
      };
    });

    await writeJsonArray(DECKS_KEY, nextDecks);
    return nextDecks.find((deck) => deck.id === deckId)?.shortlist || [];
  },
  'update shortlist ranking'
);

export const recalculateShortlistRankings = async (deckId, intent = 'Buyer', userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const { data } = await api.post(`/api/property-decks/${deckId}/shortlist/rankings/recalculate`, { intent });
    const deck = await getPropertyDeck(deckId, userProfile);
    return getItems(data, 'shortlist')
      .map((item) => normalizeListing(item))
      .map((item) => withDeckSearchDistance(item, deck));
  },
  async () => {
    const deck = await getPropertyDeck(deckId, userProfile);
    return deck?.shortlist || [];
  },
  'recalculate shortlist rankings'
);

const dismissLocalDeckListing = async (deckId, listingId, userProfile) => {
  const id = String(listingId || '');
  if (!id) return [];

  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.map((deck) => {
    if (deck.id !== deckId) return deck;

    return {
      ...deck,
      listings: deck.listings.map((listing) => (
        getListingId(listing) === id
          ? { ...listing, status: 'skipped', updatedAt: Date.now() }
          : listing
      )),
      dismissedListingIds: Array.from(new Set([id, ...deck.dismissedListingIds.map(String)])),
      updatedAt: Date.now(),
    };
  });

  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks.find((deck) => deck.id === deckId)?.dismissedListingIds || [];
};

export const dismissDeckListing = async (deckId, listingId, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    await api.patch(`/api/property-decks/${deckId}/listings/${listingId}`, {
      status: 'skipped',
    });
    return [];
  },
  () => dismissLocalDeckListing(deckId, listingId, userProfile),
  'dismiss deck listing'
);

const removeLocalFromShortlist = async (deckId, listingId, userProfile) => {
  const id = String(listingId || '');
  if (!id) return [];

  const decks = await getLocalPropertyDecks(userProfile);
  const nextDecks = decks.map((deck) => (
    deck.id === deckId
      ? {
          ...deck,
          listings: deck.listings.map((listing) => (
            getListingId(listing) === id
              ? { ...listing, status: 'matched', updatedAt: Date.now() }
              : listing
          )),
          shortlist: deck.shortlist.filter((item) => getListingId(item) !== id),
          updatedAt: Date.now(),
        }
      : deck
  ));

  await writeJsonArray(DECKS_KEY, nextDecks);
  return nextDecks.find((deck) => deck.id === deckId)?.shortlist || [];
};

export const removeFromShortlist = async (deckId, listingId, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const { data } = await api.delete(`/api/property-decks/${deckId}/shortlist/${listingId}`);
    return getItems(data, 'shortlist').map((item) => normalizeListing(item));
  },
  () => removeLocalFromShortlist(deckId, listingId, userProfile),
  'remove shortlist listing'
);

export const getShortlist = async (deckId, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const [deck, response] = await Promise.all([
      getPropertyDeck(deckId, userProfile),
      api.get(`/api/property-decks/${deckId}/shortlist`),
    ]);

    return getItems(response.data, 'shortlist')
      .map((item) => normalizeListing(item))
      .map((item) => withDeckSearchDistance(item, deck));
  },
  async () => {
    const deck = await getPropertyDeck(deckId, userProfile);
    return deck?.shortlist || [];
  },
  'get shortlist'
);

const getLocalComparisonBoard = async (deckId, userProfile) => {
  const deck = await getPropertyDeck(deckId, userProfile);
  if (!deck) return null;

  return normalizeComparisonBoard({
    id: `local-board-${deckId}`,
    propertyDeckId: deckId,
    shortListId: `local-shortlist-${deckId}`,
    name: `${deck.name || 'Property Deck'} Board`,
    boardStatus: 'active',
    listings: deck.shortlist || [],
  });
};

export const getOrCreateComparisonBoard = async (deckId, payload = {}, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const [deck, response] = await Promise.all([
      getPropertyDeck(deckId, userProfile),
      api.post(`/api/property-decks/${deckId}/comparison-board`, payload),
    ]);
    const board = normalizeComparisonBoard(response.data?.board || response.data);
    return board
      ? { ...board, listings: board.listings.map((item) => withDeckSearchDistance(item, deck)) }
      : board;
  },
  () => getLocalComparisonBoard(deckId, userProfile),
  'get or create comparison board'
);

export const getComparisonBoard = async (deckId, userProfile) => withApiFallback(
  async () => {
    requireBackendId(deckId, 'deckId');
    const [deck, response] = await Promise.all([
      getPropertyDeck(deckId, userProfile),
      api.get(`/api/property-decks/${deckId}/comparison-board`),
    ]);
    const board = normalizeComparisonBoard(response.data?.board || response.data);
    return board
      ? { ...board, listings: board.listings.map((item) => withDeckSearchDistance(item, deck)) }
      : board;
  },
  () => getLocalComparisonBoard(deckId, userProfile),
  'get comparison board'
);

export const removeComparisonBoardListing = async (boardId, listingId) => withApiFallback(
  async () => {
    requireBackendId(boardId, 'boardId');
    if (!listingId) return { success: false };

    const { data } = await api.delete(`/api/comparison-boards/${boardId}/listings/${listingId}`);
    return data || { success: true };
  },
  async () => ({ success: false, localOnly: true }),
  'remove comparison board listing'
);
