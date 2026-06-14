import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../contexts/SubscriptionContext';
import { addListingToDecisionBoardProject } from '../services/DecisionBoardService';
import { getListingById } from '../services/listingApi';
import {
  archivePropertyDeck,
  destroyPropertyDeck,
  dismissDeckListing,
  getListingId,
  getMatchedDeckListings,
  getOrCreateComparisonBoard,
  getPropertyDeckLimit,
  getPropertyDecks,
  getShortlist,
  removeComparisonBoardListing,
  removeFromShortlist,
  renamePropertyDeck,
  restorePropertyDeck,
  saveToShortlist,
} from '../services/PropertyDeckService';

const APP_PURPLE = '#6366F1';
const SWIPE_THRESHOLD = 90;
const RICH_FILTER_ENRICHMENT_MATCH_LIMIT = 20;
const FLOW_STEPS = [
  { key: 'detail', label: 'Property Deck' },
  { key: 'shortlist', label: 'Shortlist' },
  { key: 'board', label: 'Board' },
  { key: 'decision', label: 'Decision' },
];
const PROPERTY_TYPE_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'detached', label: 'Detached', terms: ['detached'] },
  { key: 'semi-detached', label: 'Semi-detached', terms: ['semi-detached', 'semi detached'] },
  { key: 'terraced', label: 'Terraced', terms: ['terraced', 'terrace'] },
  { key: 'flat', label: 'Flats', terms: ['flat', 'apartment', 'maisonette'] },
  { key: 'bungalow', label: 'Bungalows', terms: ['bungalow'] },
  { key: 'land', label: 'Farms/land', terms: ['farm', 'land', 'plot', 'equestrian'] },
  { key: 'park-home', label: 'Park homes', terms: ['park home', 'mobile home'] },
];
const TRI_STATE_OPTIONS = ['include', 'exclude', 'only'];
const SPECIAL_FILTERS = [
  { key: 'newBuild', label: 'New-build homes', terms: ['new build', 'new-build', 'new home', 'newly built'] },
  { key: 'sharedOwnership', label: 'Shared ownership', terms: ['shared ownership'] },
  { key: 'retirement', label: 'Retirement homes', terms: ['retirement', 'over 55', 'over 60', 'warden'] },
  { key: 'auction', label: 'Auction', terms: ['auction'] },
];
const MUST_HAVE_FILTERS = [
  { key: 'garden', label: 'Garden', terms: ['garden', 'gardens', 'grounds', 'outside space', 'rear lawn'], searchScope: 'details' },
  { key: 'parking', label: 'Parking/garage', terms: ['parking', 'garage', 'garaging', 'driveway', 'drive way', 'off street', 'off-street', 'allocated parking', 'parking space'] },
  { key: 'balcony', label: 'Balcony/terrace', terms: ['balcony', 'terrace', 'roof terrace', 'patio', 'decking'], searchScope: 'details' },
];
const OWNERSHIP_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'leasehold', label: 'Leasehold', terms: ['leasehold'] },
  { key: 'freehold', label: 'Freehold', terms: ['freehold'] },
  { key: 'share-of-freehold', label: 'Share of freehold', terms: ['share of freehold'] },
];
const STATUS_FILTERS = [
  { key: 'chainFree', label: 'Chain-free', terms: ['chain free', 'chain-free', 'no onward chain'] },
  { key: 'reduced', label: 'Reduced price', terms: ['reduced', 'price reduction', 'reduced price'] },
  { key: 'underOffer', label: 'Under offer or sold STC', terms: ['under offer', 'sold stc', 'sstc'] },
];
const FEATURE_OPTIONS = [
  { key: 'all', label: 'Show all' },
  { key: 'fixer', label: 'Fixer upper', terms: ['fixer', 'renovation', 'modernisation', 'refurbishment', 'needs work'] },
  { key: 'period', label: 'Period property', terms: ['period', 'victorian', 'edwardian', 'georgian'] },
  { key: 'cottage', label: 'Cottage', terms: ['cottage'] },
  { key: 'modern', label: 'Modern', terms: ['modern', 'contemporary'] },
  { key: 'ev', label: 'EV Charging', terms: ['ev charging', 'electric vehicle', 'charging point'] },
  { key: 'utility', label: 'Utility room', terms: ['utility room'] },
  { key: 'basement', label: 'Basement', terms: ['basement', 'cellar'] },
  { key: 'conservatory', label: 'Conservatory', terms: ['conservatory'] },
  { key: 'office', label: 'Home office', terms: ['home office', 'study'] },
  { key: 'ensuite', label: 'En-suite', terms: ['en-suite', 'ensuite'] },
  { key: 'bathtub', label: 'Bathtub', terms: ['bathtub', 'bath tub'] },
  { key: 'patio', label: 'Patio', terms: ['patio'] },
  { key: 'island', label: 'Kitchen island', terms: ['kitchen island', 'island kitchen'] },
];
const ADDED_OPTIONS = [
  { key: 'any', label: 'Anytime', days: null },
  { key: '24h', label: 'Last 24 hours', days: 1 },
  { key: '3d', label: 'Last 3 days', days: 3 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];
const SHOW_DATE_ADDED_FILTER = false;
const createDefaultDeckFilters = () => ({
  propertyType: 'all',
  special: SPECIAL_FILTERS.reduce((acc, item) => ({ ...acc, [item.key]: 'include' }), {}),
  mustHaves: [],
  ownership: 'all',
  statuses: [],
  feature: 'all',
  added: 'any',
});

const normalizeImageUrls = (listing, depth = 0) => {
  if (!listing || depth > 1) return [];

  const imageSources = [
    listing?.ImageUrls,
    listing?.imageUrls,
    listing?.ImageUrl,
    listing?.imageUrl,
  ];

  for (const source of imageSources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      return source.filter(Boolean);
    }

    if (typeof source === 'string') {
      const value = source.trim();
      if (!value) continue;

      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.filter(Boolean);
          }
        } catch {
          // Fall through to delimiter parsing.
        }
      }

      return value.split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
    }
  }

  const nestedListing = listing?.listing || listing?.Listing || listing?.property || listing?.Property || listing?.propertyListing || listing?.PropertyListing;
  if (nestedListing && nestedListing !== listing) {
    return normalizeImageUrls(nestedListing, depth + 1);
  }

  return [];
};

const getDisplayListing = (listing) => {
  if (!listing) return listing;

  const sourceListing = listing.listing || listing.Listing || listing.property || listing.Property || listing.propertyListing || listing.PropertyListing || listing;

  return {
    ...listing,
    ...sourceListing,
    ID: getListingId(sourceListing) || getListingId(listing),
    Title: sourceListing.Title ?? sourceListing.title ?? listing.Title ?? listing.title,
    Price: sourceListing.Price ?? sourceListing.price ?? listing.Price ?? listing.price,
    Description: sourceListing.Description ?? sourceListing.description ?? listing.Description ?? listing.description,
    ImageUrls: sourceListing.ImageUrls ?? sourceListing.imageUrls ?? sourceListing.imageUrl ?? listing.ImageUrls ?? listing.imageUrls ?? listing.imageUrl,
    PropertyTimeline: sourceListing.PropertyTimeline ?? sourceListing.propertyTimeline ?? listing.PropertyTimeline ?? listing.propertyTimeline,
    AdditionalInfo: sourceListing.AdditionalInfo ?? sourceListing.additionalInfo ?? listing.AdditionalInfo ?? listing.additionalInfo,
    Schools: sourceListing.Schools ?? sourceListing.NearbySchools ?? sourceListing.nearbySchools ?? listing.Schools ?? listing.NearbySchools ?? listing.nearbySchools,
    Stations: sourceListing.Stations ?? sourceListing.NearbyStations ?? sourceListing.nearbyStations ?? listing.Stations ?? listing.NearbyStations ?? listing.nearbyStations,
    Latitude: sourceListing.Latitude ?? sourceListing.latitude ?? listing.Latitude ?? listing.latitude,
    Longitude: sourceListing.Longitude ?? sourceListing.longitude ?? listing.Longitude ?? listing.longitude,
    ListingURL: sourceListing.ListingURL ?? sourceListing.listingUrl ?? sourceListing.listingURL ?? listing.ListingURL ?? listing.listingUrl ?? listing.listingURL,
    AgentPhone: sourceListing.AgentPhone ?? sourceListing.agentPhone ?? listing.AgentPhone ?? listing.agentPhone,
    AgentEmail: sourceListing.AgentEmail ?? sourceListing.agentEmail ?? listing.AgentEmail ?? listing.agentEmail,
    distanceMiles: listing.distanceMiles ?? listing.DistanceMiles ?? sourceListing.distanceMiles ?? sourceListing.DistanceMiles,
    SearchDistanceMiles: listing.SearchDistanceMiles ?? listing.searchDistanceMiles ?? sourceListing.SearchDistanceMiles ?? sourceListing.searchDistanceMiles,
    propertyDeckListingId: listing.propertyDeckListingId || listing.PropertyDeckListingID || sourceListing.propertyDeckListingId || sourceListing.PropertyDeckListingID,
  };
};

const hasDescriptionText = (listing) => Boolean(listing?.Description || listing?.description);

const deckFiltersNeedRichListingData = (filters) => (
  Boolean(filters?.mustHaves?.length) ||
  Boolean(filters?.ownership && filters.ownership !== 'all')
);

const getDeckSearchLocationLabel = (deck) => {
  const filterJson = parseJsonObject(deck?.filterJson || deck?.FilterJson);
  const label = filterJson?.searchLocationLabel || filterJson?.SearchLocationLabel;
  const query = filterJson?.searchLocationQuery || filterJson?.SearchLocationQuery;
  const source = filterJson?.searchLocationSource || filterJson?.SearchLocationSource;
  if (label) return label;
  if (query) return query;
  if (source === 'user') return 'Current location';
  return null;
};

const formatPrice = (price) => {
  if (!price) return 'Price on request';
  if (typeof price === 'number') return `£${price.toLocaleString()}`;
  return price;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';

  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return '';
  }
};

const clampRating = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

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

const flattenForSearch = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(flattenForSearch).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flattenForSearch).join(' ');
  return '';
};

const getListingSearchText = (listing, scope = 'all') => {
  const listingPayload = parseJsonObject(
    listing?.ListingJson ||
    listing?.listingJson ||
    listing?.ListingData ||
    listing?.listingData ||
    listing?.PropertyJson ||
    listing?.propertyJson ||
    listing?.RawListingJson ||
    listing?.rawListingJson
  );
  const nestedListing = listing?.listing || listing?.Listing;
  const source = {
    ...(listingPayload || {}),
    ...(nestedListing || {}),
    ...(listing || {}),
  };
  const additionalInfo = parseJsonObject(
    source?.AdditionalInfo ||
    source?.additionalInfo ||
    source?.additional_info ||
    source?.AdditionalInformation ||
    source?.additionalInformation ||
    source?.additional_information
  );
  const detailFields = [
    source?.Description,
    source?.description,
    source?.description_html,
    source?.Summary,
    source?.summary,
    source?.ShortDescription,
    source?.shortDescription,
    source?.short_description,
    source?.Features,
    source?.features,
    source?.KeyFeatures,
    source?.keyFeatures,
    source?.key_features,
    source?.BulletPoints,
    source?.bulletPoints,
    source?.bullet_points,
    source?.Highlights,
    source?.highlights,
    source?.Amenities,
    source?.amenities,
    source?.OutdoorFeatures,
    source?.outdoorFeatures,
    source?.outdoor_features,
    source?.OutsideSpace,
    source?.outsideSpace,
    source?.outside_space,
    source?.Garden,
    source?.garden,
    source?.Parking,
    source?.parking,
    source?.ParkingDetails,
    source?.parkingDetails,
    source?.parking_details,
    source?.Tenure,
    source?.tenure,
    source?.Ownership,
    source?.ownership,
    source?.PropertyTimeline,
    source?.propertyTimeline,
    source?.property_timeline,
    source?.NearbyStations,
    source?.nearbyStations,
    source?.nearby_stations,
    source?.NearbySchools,
    source?.nearbySchools,
    source?.nearby_schools,
    additionalInfo,
  ];
  const fields = scope === 'details' ? detailFields : [
    source?.Title,
    source?.title,
    source?.Description,
    source?.description,
    source?.description_html,
    source?.PropertyType,
    source?.propertyType,
    source?.property_type,
    source?.ListingType,
    source?.listingType,
    source?.listing_type,
    source?.Status,
    source?.status,
    source?.PropertyStatus,
    source?.propertyStatus,
    source?.property_status,
    source?.Tenure,
    source?.tenure,
    source?.Ownership,
    source?.ownership,
    source?.Features,
    source?.features,
    source?.KeyFeatures,
    source?.keyFeatures,
    source?.key_features,
    source?.BulletPoints,
    source?.bulletPoints,
    source?.bullet_points,
    source?.Highlights,
    source?.highlights,
    source?.Amenities,
    source?.amenities,
    source?.OutdoorFeatures,
    source?.outdoorFeatures,
    source?.outdoor_features,
    source?.OutsideSpace,
    source?.outsideSpace,
    source?.outside_space,
    source?.Garden,
    source?.garden,
    source?.Parking,
    source?.parking,
    source?.ParkingDetails,
    source?.parkingDetails,
    source?.parking_details,
    source?.Postcode,
    source?.postcode,
    source?.Address,
    source?.address,
    source?.EPCRating,
    source?.epcRating,
    source?.epc_rating,
    source?.PropertyTimeline,
    source?.propertyTimeline,
    source?.property_timeline,
    source?.NearbyStations,
    source?.nearbyStations,
    source?.nearby_stations,
    source?.NearbySchools,
    source?.nearbySchools,
    source?.nearby_schools,
    additionalInfo,
  ];

  return fields.map(flattenForSearch).join(' ').toLowerCase();
};

const matchesTerms = (listing, terms = [], scope = 'all') => {
  const searchText = getListingSearchText(listing, scope);
  return terms.some((term) => searchText.includes(term.toLowerCase()));
};

const getListingDate = (listing) => {
  const possibleDates = [
    listing?.DateScraped,
    listing?.dateScraped,
    listing?.AddedOn,
    listing?.addedOn,
    listing?.CreatedAt,
    listing?.createdAt,
    listing?.ListedAt,
    listing?.listedAt,
  ];

  for (const value of possibleDates) {
    if (!value) continue;
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }

  return null;
};

const listingPassesDeckFilters = (listing, filters) => {
  const propertyType = PROPERTY_TYPE_OPTIONS.find((item) => item.key === filters.propertyType);
  if (propertyType?.key !== 'all' && !matchesTerms(listing, propertyType?.terms)) return false;

  for (const item of SPECIAL_FILTERS) {
    const mode = filters.special?.[item.key] || 'include';
    const hasMatch = matchesTerms(listing, item.terms);
    if (mode === 'exclude' && hasMatch) return false;
    if (mode === 'only' && !hasMatch) return false;
  }

  for (const key of filters.mustHaves || []) {
    const item = MUST_HAVE_FILTERS.find((filter) => filter.key === key);
    if (item && !matchesTerms(listing, item.terms, item.searchScope)) return false;
  }

  const ownership = OWNERSHIP_OPTIONS.find((item) => item.key === filters.ownership);
  if (ownership?.key !== 'all' && !matchesTerms(listing, ownership?.terms)) return false;

  if (filters.statuses?.length) {
    const matchesAnyStatus = filters.statuses.some((key) => {
      const item = STATUS_FILTERS.find((filter) => filter.key === key);
      return item ? matchesTerms(listing, item.terms) : false;
    });

    if (!matchesAnyStatus) return false;
  }

  const feature = FEATURE_OPTIONS.find((item) => item.key === filters.feature);
  if (feature?.key !== 'all' && !matchesTerms(listing, feature?.terms)) return false;

  const added = SHOW_DATE_ADDED_FILTER ? ADDED_OPTIONS.find((item) => item.key === filters.added) : null;
  if (added?.days) {
    const listingDate = getListingDate(listing);
    if (!listingDate) return false;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - added.days);
    if (listingDate < cutoffDate) return false;
  }

  return true;
};

const getNumericValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
};

const getDistanceMiles = (listing) => getNumericValue(
  listing?.distanceMiles,
  listing?.DistanceMiles,
  listing?.searchDistanceMiles,
  listing?.SearchDistanceMiles
);

const formatSearchDistance = (listing) => {
  const distanceMiles = getDistanceMiles(listing);
  if (distanceMiles === null) return '';

  const formattedDistance = distanceMiles.toFixed(2);

  return `${formattedDistance} miles from your search location`;
};

const isDeckDeleted = (deck) => {
  const status = String(deck?.deckStatus || deck?.DeckStatus || deck?.status || deck?.Status || '').toLowerCase();
  const deletedFlag = deck?.isDeleted ?? deck?.IsDeleted;
  const isDeletedFlag = deletedFlag === true || deletedFlag === 1 || String(deletedFlag).toLowerCase() === 'true';
  return Boolean(
    isDeletedFlag ||
    deck?.deletedAt ||
    deck?.DeletedAt ||
    status === 'deleted' ||
    status === 'archived'
  );
};

const getDeckActionErrorMessage = (error) => (
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  'The backend did not complete the request.'
);

const getListingRating = (listing) => {
  const directRating = getNumericValue(
    listing?.generalPropertyRating,
    listing?.GeneralPropertyRating
  );
  if (directRating !== null) return clampRating(directRating > 1 ? directRating : directRating * 100);

  const imageCount = normalizeImageUrls(listing).length;
  const hasPrice = Boolean(listing?.Price || listing?.price);
  const hasBeds = Boolean(listing?.Beds || listing?.beds || listing?.Bedrooms || listing?.bedrooms);
  const hasBaths = Boolean(listing?.Baths || listing?.baths || listing?.Bathrooms || listing?.bathrooms);
  const hasDescription = Boolean(listing?.Description || listing?.description);
  const hasLocation = Boolean(
    listing?.Latitude || listing?.latitude || listing?.Longitude || listing?.longitude || listing?.Address || listing?.address
  );

  return clampRating(
    35 +
    (hasPrice ? 15 : 0) +
    (hasBeds ? 10 : 0) +
    (hasBaths ? 8 : 0) +
    (hasDescription ? 12 : 0) +
    (hasLocation ? 10 : 0) +
    Math.min(imageCount, 4) * 3
  );
};

const getUserMatchRating = (listing) => {
  const directScore = getNumericValue(
    listing?.userPropertyRating,
    listing?.UserPropertyRating,
    listing?.MatchScore,
    listing?.matchScore,
    listing?.UserMatchScore,
    listing?.userMatchScore
  );
  if (directScore !== null) return clampRating(directScore > 1 ? directScore : directScore * 100);

  const metrics = parseJsonObject(listing?.MetricsJson || listing?.metricsJson);
  if (metrics) {
    const scores = Object.values(metrics)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (scores.length) {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return clampRating(average > 1 ? average : average * 100);
    }
  }

  return clampRating(getListingRating(listing) - 7);
};

const toTextList = (value, fallback = []) => {
  const parsed = parseJsonObject(value);
  if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  if (typeof parsed === 'object' && parsed) return Object.values(parsed).filter(Boolean).map(String);
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return fallback;
};

const getComparisonNotes = (listing) => {
  const pros = toTextList(listing?.ProsJson || listing?.prosJson, [
    listing?.Price ? 'Price data available' : null,
    listing?.Beds ? `${listing.Beds} bedroom profile` : null,
    normalizeImageUrls(listing).length ? 'Image set available for review' : null,
  ].filter(Boolean));

  const cons = toTextList(listing?.ConsJson || listing?.consJson, [
    !listing?.Description ? 'Limited description data' : null,
    !listing?.Baths ? 'Bathroom data missing' : null,
  ].filter(Boolean));

  return {
    pros: pros.length ? pros.slice(0, 3) : ['Needs deeper analysis'],
    cons: cons.length ? cons.slice(0, 3) : ['No clear concerns surfaced yet'],
  };
};

export default function PropertyDeckScreen({ route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTier, userProfile } = useSubscription();
  const pan = useRef(new Animated.ValueXY()).current;
  const isProcessingRef = useRef(false);
  const handledOpenDeckIdRef = useRef(null);
  const fullListingCacheRef = useRef(new Map());
  const isEnrichingDeckListingsRef = useRef(false);
  const lastRichFilterEnrichmentKeyRef = useRef(null);
  const [mode, setMode] = useState('list');
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [deckListings, setDeckListings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewListing, setPreviewListing] = useState(null);
  const [editingDeckId, setEditingDeckId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparisonBoard, setComparisonBoard] = useState(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [decisionCreatingListingId, setDecisionCreatingListingId] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [deckFilters, setDeckFilters] = useState(createDefaultDeckFilters);

  const deckLimit = getPropertyDeckLimit(currentTier);
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) || null;
  const activeDecks = decks.filter((deck) => !isDeckDeleted(deck));
  const deletedDecks = decks.filter(isDeckDeleted);
  const filteredDeckListings = useMemo(
    () => deckListings.filter((listing) => listingPassesDeckFilters(listing, deckFilters)),
    [deckFilters, deckListings]
  );
  const currentListing = filteredDeckListings[currentIndex];
  const canCreateDeck = deckLimit > 0 && decks.length < deckLimit;

  const boardListings = comparisonBoard?.listings?.length
    ? comparisonBoard.listings
    : selectedDeck?.shortlist || [];

  const loadDecks = useCallback(async () => {
    setLoading(true);
    let nextDecks = [];

    try {
      nextDecks = await getPropertyDecks(userProfile);
    } catch (error) {
      console.log('[PROPERTY-DECK] load decks failed:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }

    setDecks(nextDecks);

    if (selectedDeckId && !nextDecks.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(null);
      setMode('list');
    }

    setLoading(false);
  }, [selectedDeckId, userProfile]);

  const loadSelectedDeck = useCallback(async (deckId) => {
    if (!deckId) return;

    let nextDecks = [];
    let nextListings = [];
    let nextShortlist = [];

    try {
      nextDecks = await getPropertyDecks(userProfile);
    } catch (error) {
      console.log('[PROPERTY-DECK] load selected deck list failed:', {
        deckId,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }

    try {
      nextListings = await getMatchedDeckListings(deckId, userProfile);
    } catch (error) {
      console.log('[PROPERTY-DECK] load selected deck listings failed:', {
        deckId,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      Alert.alert('Could not load Property Deck listings', getDeckActionErrorMessage(error));
    }

    try {
      nextShortlist = await getShortlist(deckId, userProfile);
    } catch (error) {
      console.log('[PROPERTY-DECK] load selected shortlist failed:', {
        deckId,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }

    setDecks(nextDecks.map((deck) => (
      deck.id === deckId
        ? { ...deck, shortlist: nextShortlist, shortlistCount: nextShortlist.length }
        : deck
    )));
    setDeckListings(nextListings);
    lastRichFilterEnrichmentKeyRef.current = null;
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [pan, userProfile]);

  useEffect(() => {
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [deckFilters, pan]);

  useEffect(() => {
    if (
      !deckFiltersNeedRichListingData(deckFilters) ||
      !deckListings.length ||
      filteredDeckListings.length ||
      isEnrichingDeckListingsRef.current
    ) {
      return;
    }

    const enrichmentKey = [
      selectedDeckId || 'deck',
      deckFilters.mustHaves?.join(',') || 'none',
      deckFilters.ownership || 'all',
      deckListings.map((listing) => getListingId(listing)).join(','),
    ].join('|');

    if (lastRichFilterEnrichmentKeyRef.current === enrichmentKey) {
      return;
    }

    let isCancelled = false;
    isEnrichingDeckListingsRef.current = true;
    lastRichFilterEnrichmentKeyRef.current = enrichmentKey;

    const enrichDeckListings = async () => {
      const enrichedListings = [...deckListings];
      let enrichedMatchCount = 0;

      for (let index = 0; index < deckListings.length; index += 1) {
        if (isCancelled) break;

        const listing = deckListings[index];
        const listingId = getListingId(listing);
        if (!listingId) {
          continue;
        }

        try {
          let fullListing = fullListingCacheRef.current.get(listingId);
          if (!fullListing) {
            const result = await getListingById(listingId);
            fullListing = result?.listing || result?.Listing || result;
            if (fullListing) fullListingCacheRef.current.set(listingId, fullListing);
          }

          const enrichedListing = getDisplayListing({
            ...listing,
            ...(fullListing || {}),
            propertyDeckListingId: listing.propertyDeckListingId,
            status: listing.status,
            distanceMiles: listing.distanceMiles,
            SearchDistanceMiles: listing.SearchDistanceMiles,
          });

          enrichedListings[index] = enrichedListing;
          if (listingPassesDeckFilters(enrichedListing, deckFilters)) {
            enrichedMatchCount += 1;
            if (enrichedMatchCount >= RICH_FILTER_ENRICHMENT_MATCH_LIMIT) break;
          }
        } catch {
          enrichedListings[index] = listing;
        }
      }

      if (!isCancelled) {
        setDeckListings(enrichedListings);
      }
    };

    enrichDeckListings().finally(() => {
      isEnrichingDeckListingsRef.current = false;
    });

    return () => {
      isCancelled = true;
    };
  }, [deckFilters, deckListings, filteredDeckListings.length]);

  useFocusEffect(
    useCallback(() => {
      const routeDeckId = route?.params?.openDeckId;
      if (routeDeckId && handledOpenDeckIdRef.current !== routeDeckId) {
        handledOpenDeckIdRef.current = routeDeckId;
        setSelectedDeckId(routeDeckId);
        setMode('detail');
        loadSelectedDeck(routeDeckId);
        return;
      }

      if ((mode === 'detail' || mode === 'shortlist' || mode === 'board') && selectedDeckId) {
        loadSelectedDeck(selectedDeckId);
      } else {
        loadDecks();
      }
    }, [loadDecks, loadSelectedDeck, mode, route?.params?.openDeckId, selectedDeckId])
  );

  useEffect(() => {
    let isMounted = true;

    const loadBoard = async () => {
      if (mode !== 'board' || !selectedDeckId) return;

      setLoadingBoard(true);
      const board = await getOrCreateComparisonBoard(selectedDeckId, {}, userProfile);
      if (isMounted) {
        setComparisonBoard(board);
        setLoadingBoard(false);
      }
    };

    loadBoard();

    return () => {
      isMounted = false;
    };
  }, [mode, selectedDeckId, userProfile]);

  const cardStyle = useMemo(() => {
    const rotate = pan.x.interpolate({
      inputRange: [-200, 0, 200],
      outputRange: ['-7deg', '0deg', '7deg'],
    });

    return {
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { rotate },
      ],
    };
  }, [pan]);

  const openDeck = async (deckId) => {
    setSelectedDeckId(deckId);
    setMode('detail');
    await loadSelectedDeck(deckId);
  };

  const openListingPreview = (listing) => {
    setPreviewListing(getDisplayListing(listing));
  };

  const openFullListing = async (listing) => {
    let displayListing = getDisplayListing(listing);
    const listingId = getListingId(displayListing);

    if (listingId && !hasDescriptionText(displayListing)) {
      try {
        console.log('[PROPERTY-DECK] loading full listing details:', {
          listingId,
          currentKeys: displayListing && typeof displayListing === 'object' ? Object.keys(displayListing) : [],
        });
        const fullListing = await getListingById(listingId);
        displayListing = getDisplayListing({
          ...displayListing,
          ...(fullListing?.listing || fullListing?.Listing || fullListing),
        });
        console.log('[PROPERTY-DECK] full listing details merged:', {
          listingId,
          hasDescription: Boolean(displayListing?.Description),
          hasAdditionalInfo: Boolean(displayListing?.AdditionalInfo),
          keys: displayListing && typeof displayListing === 'object' ? Object.keys(displayListing) : [],
        });
      } catch (error) {
        console.log('[PROPERTY-DECK] full listing detail fetch failed:', {
          listingId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
      }
    }

    setPreviewListing(null);
    navigation.navigate('ListingDetail', { listing: displayListing });
  };

  const handleCreateDeck = async () => {
    if (!canCreateDeck) {
      return;
    }

    Alert.alert(
      'Create from Map',
      'Property Decks are created from the current map radius so the deck can be populated with matching listings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Map', onPress: () => navigation.navigate('Map') },
      ]
    );
  };

  const setDeckFilterValue = (key, value) => {
    setDeckFilters((filters) => ({ ...filters, [key]: value }));
  };

  const toggleArrayFilter = (key, value) => {
    setDeckFilters((filters) => {
      const values = Array.isArray(filters[key]) ? filters[key] : [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return { ...filters, [key]: nextValues };
    });
  };

  const setSpecialFilterMode = (key, mode) => {
    setDeckFilters((filters) => ({
      ...filters,
      special: {
        ...filters.special,
        [key]: mode,
      },
    }));
  };

  const resetDeckFilters = () => {
    setDeckFilters(createDefaultDeckFilters());
  };

  const renderChoiceChips = (options, selectedKey, onSelect) => (
    <View style={styles.filterChipWrap}>
      {options.map((option) => {
        const isSelected = selectedKey === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            onPress={() => onSelect(option.key)}
          >
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderToggleChips = (options, selectedValues, onToggle) => (
    <View style={styles.filterChipWrap}>
      {options.map((option) => {
        const isSelected = (selectedValues || []).includes(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            onPress={() => onToggle(option.key)}
          >
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFilterSection = (title, children) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const startRename = (deck) => {
    setEditingDeckId(deck.id);
    setEditingName(deck.name);
  };

  const saveRename = async () => {
    const nextDecks = await renamePropertyDeck(editingDeckId, editingName, userProfile);
    setDecks(nextDecks);
    setEditingDeckId(null);
    setEditingName('');
  };

  const completeSwipe = useCallback(async (direction) => {
    if (!selectedDeckId || !currentListing || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const listing = currentListing;
    const listingId = getListingId(listing);
    const deckId = selectedDeckId;

    if (direction === 'right') {
      setDecks((currentDecks) => currentDecks.map((deck) => {
        if (deck.id !== deckId) return deck;

        const currentShortlist = Array.isArray(deck.shortlist) ? deck.shortlist : [];
        const alreadyShortlisted = currentShortlist.some((item) => getListingId(item) === listingId);
        const shortlist = alreadyShortlisted
          ? currentShortlist
          : [{ ...listing, shortlistedAt: Date.now() }, ...currentShortlist];

        return {
          ...deck,
          shortlist,
          shortlistCount: shortlist.length,
        };
      }));
    }

    Animated.timing(pan, {
      toValue: { x: direction === 'left' ? -420 : 420, y: 0 },
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setCurrentIndex((index) => index + 1);
      setPreviewListing(null);
      isProcessingRef.current = false;
    });

    (async () => {
      try {
        if (direction === 'left') {
          await dismissDeckListing(deckId, listingId, userProfile);
        } else {
          await saveToShortlist(deckId, listing, userProfile);
        }

        const [nextDecks, nextShortlist] = await Promise.all([
          getPropertyDecks(userProfile),
          getShortlist(deckId, userProfile),
        ]);
        setDecks(nextDecks.map((deck) => (
          deck.id === deckId
            ? { ...deck, shortlist: nextShortlist, shortlistCount: nextShortlist.length }
            : deck
        )));
      } catch (error) {
        console.log('[PROPERTY-DECK] swipe action failed:', {
          direction,
          deckId,
          listingId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
      }
    })();
  }, [currentListing, pan, selectedDeckId, userProfile]);

  const handlePreviewDecision = async (direction) => {
    if (!previewListing) return;

    const previewListingId = getListingId(previewListing);
    const currentListingId = getListingId(currentListing);

    if (previewListingId && previewListingId === currentListingId) {
      await completeSwipe(direction);
      return;
    }

    setPreviewListing(null);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8
    ),
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -SWIPE_THRESHOLD) {
        completeSwipe('left');
        return;
      }

      if (gesture.dx > SWIPE_THRESHOLD) {
        completeSwipe('right');
        return;
      }

      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        useNativeDriver: true,
      }).start();
    },
  }), [completeSwipe, pan]);

  const handleRemoveFromShortlist = async (listingId) => {
    if (!selectedDeckId) return;

    await removeFromShortlist(selectedDeckId, listingId, userProfile);
    await loadSelectedDeck(selectedDeckId);
  };

  const handleRemoveFromBoard = async (listingId) => {
    if (!listingId) return;

    await removeComparisonBoardListing(comparisonBoard?.id, listingId);
    setComparisonBoard((board) => {
      if (!board) return board;

      return {
        ...board,
        listings: board.listings.filter((listing) => getListingId(listing) !== String(listingId)),
      };
    });
  };

  const openDecisionBoard = async (listing) => {
    const listingId = getListingId(listing);
    if (!listingId || decisionCreatingListingId) return;

    setDecisionCreatingListingId(listingId);
    try {
      const decisionBoard = await addListingToDecisionBoardProject({
        listingId,
        shortListId: listing.shortListId || listing.ShortListID || comparisonBoard?.shortListId || comparisonBoard?.ShortListID,
        comparisonBoardId: comparisonBoard?.id || comparisonBoard?.ID,
        boardName: `${selectedDeck?.name || 'Property'} Decisions`,
      });

      navigation.navigate('DecisionBoard', {
        decisionBoardId: decisionBoard?.id,
        decisionBoard,
        sourceFlow: 'propertyDeck',
      });
    } catch (error) {
      Alert.alert(
        'Could not open Decision Board',
        error?.response?.data?.error || error?.response?.data?.message || error?.message || 'This property could not be added to a Decision Board.'
      );
    } finally {
      setDecisionCreatingListingId(null);
    }
  };

  const confirmArchiveDeck = (deck) => {
    Alert.alert(
      'Delete Property Deck',
      'This moves the deck, shortlist, and board work into Deleted Property Decks so it can be restored later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextDecks = await archivePropertyDeck(deck.id, userProfile);
              setDecks(nextDecks);
              if (selectedDeckId === deck.id) {
                setSelectedDeckId(null);
                setMode('list');
              }
            } catch (error) {
              Alert.alert('Could not delete deck', getDeckActionErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const handleRestoreDeck = async (deck) => {
    try {
      const nextDecks = await restorePropertyDeck(deck.id, userProfile);
      setDecks(nextDecks);
    } catch (error) {
      Alert.alert('Could not restore deck', getDeckActionErrorMessage(error));
    }
  };

  const confirmDestroyDeck = (deck) => {
    Alert.alert(
      'Destroy Property Deck',
      'This permanently deletes the deck and its shortlist and board records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Destroy',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextDecks = await destroyPropertyDeck(deck.id, userProfile);
              setDecks(nextDecks);
              if (selectedDeckId === deck.id) {
                setSelectedDeckId(null);
                setMode('list');
              }
            } catch (error) {
              Alert.alert('Could not destroy deck', getDeckActionErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  const renderFlowSteps = () => {
    const activeIndex = Math.max(0, FLOW_STEPS.findIndex((step) => step.key === mode));

    return (
      <View style={styles.flowStepsContainer}>
        {FLOW_STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <View key={step.key} style={styles.flowStepItem}>
              <View style={styles.flowStepTopRow}>
                <View
                  style={[
                    styles.flowStepDot,
                    isComplete && styles.flowStepDotComplete,
                    isActive && styles.flowStepDotActive,
                  ]}
                >
                  {isComplete ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.flowStepNumber, isActive && styles.flowStepNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                {index < FLOW_STEPS.length - 1 && (
                  <View style={[styles.flowStepLine, index < activeIndex && styles.flowStepLineActive]} />
                )}
              </View>
              <Text style={[styles.flowStepLabel, isActive && styles.flowStepLabelActive]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderDeckListItem = ({ item }) => {
    const isEditing = editingDeckId === item.id;

    return (
      <TouchableOpacity
        style={styles.deckListItem}
        activeOpacity={0.9}
        onPress={() => !isEditing && openDeck(item.id)}
      >
        <View style={styles.deckListIcon}>
          <Ionicons name="albums" size={24} color={APP_PURPLE} />
        </View>

        <View style={styles.deckListContent}>
          {isEditing ? (
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              style={styles.deckNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveRename}
            />
          ) : (
            <Text style={styles.deckListTitle} numberOfLines={1}>
              {item.name}
            </Text>
          )}

          <Text style={styles.deckListMeta}>
            {item.shortlist.length} shortlisted / created {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.deckListActions}>
          {isEditing ? (
            <TouchableOpacity style={styles.iconButton} onPress={saveRename}>
              <Ionicons name="checkmark" size={22} color={APP_PURPLE} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.iconButton} onPress={() => startRename(item)}>
                <Ionicons name="pencil-outline" size={20} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => confirmArchiveDeck(item)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDeletedDeckItem = ({ item }) => (
    <View style={[styles.deckListItem, styles.deletedDeckListItem]}>
      <View style={[styles.deckListIcon, styles.deletedDeckIcon]}>
        <Ionicons name="trash-outline" size={23} color="#EF4444" />
      </View>

      <View style={styles.deckListContent}>
        <Text style={styles.deckListTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.deckListMeta}>
          Deleted {formatDate(item.deletedAt || item.DeletedAt)} / {item.shortlist?.length || item.shortlistCount || 0} shortlisted
        </Text>
      </View>

      <View style={styles.deletedDeckActions}>
        <TouchableOpacity style={styles.restoreButton} onPress={() => handleRestoreDeck(item)}>
          <Ionicons name="refresh" size={16} color={APP_PURPLE} />
          <Text style={styles.restoreButtonText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.destroyButton} onPress={() => confirmDestroyDeck(item)}>
          <Ionicons name="close-circle" size={16} color="#FFFFFF" />
          <Text style={styles.destroyButtonText}>Destroy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderListScreen = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Property Decks</Text>
          <Text style={styles.subtitle}>
            {decks.length} of {deckLimit} decks used on {String(currentTier || 'free')} tier.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createButton, !canCreateDeck && styles.disabledCreateButton]}
          disabled={!canCreateDeck}
          onPress={handleCreateDeck}
        >
          <Ionicons name="add" size={20} color={canCreateDeck ? '#FFFFFF' : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      {deckLimit === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={44} color="#C7CDD8" />
          <Text style={styles.emptyTitle}>Property Decks are a paid feature</Text>
          <Text style={styles.emptyText}>
            Prospector includes 1 deck, Investor includes 5, and Developer includes 10.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeDecks}
          renderItem={renderDeckListItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.deckList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
              <Text style={styles.emptyTitle}>
                {loading ? 'Loading decks' : 'No active property decks yet'}
              </Text>
              {!loading && (
                <Text style={styles.emptyText}>
                  Create one from the map when you are ready to save matched properties.
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            deletedDecks.length ? (
              <View style={styles.deletedSection}>
                <View style={styles.deletedSectionHeader}>
                  <Text style={styles.deletedSectionTitle}>Deleted Property Decks</Text>
                  <Text style={styles.deletedSectionMeta}>{deletedDecks.length}</Text>
                </View>
                {deletedDecks.map((deck) => (
                  <View key={deck.id}>
                    {renderDeletedDeckItem({ item: deck })}
                  </View>
                ))}
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  const renderDeckCard = () => {
    if (!currentListing) {
      const filtersHaveNoMatches = deckListings.length > 0 && filteredDeckListings.length === 0;

      return (
        <View style={styles.detailEmptyState}>
          <Ionicons
            name={filtersHaveNoMatches ? 'filter-outline' : 'checkmark-circle-outline'}
            size={38}
            color={APP_PURPLE}
          />
          <Text style={styles.emptyTitle}>
            {filtersHaveNoMatches ? 'No listings match these filters' : 'Deck cleared'}
          </Text>
          <Text style={styles.emptyText}>
            {filtersHaveNoMatches
              ? 'Adjust or reset the Property Deck filters to bring listings back into the swipe flow.'
              : 'New matched properties from notifications will appear here.'}
          </Text>
        </View>
      );
    }

    const imageUrl = normalizeImageUrls(currentListing)[0];
    const distanceText = formatSearchDistance(currentListing);
    const listingId = getListingId(currentListing) || currentListing?.ID || currentListing?.id || currentIndex;
    const deckCardKey = `${currentIndex}-${listingId}-${imageUrl || 'no-image'}`;

    return (
      <>
        <Animated.View
          key={deckCardKey}
          style={[styles.deckCard, cardStyle]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={0.92} onPress={() => openListingPreview(currentListing)}>
            {imageUrl ? (
              <Image key={deckCardKey} source={{ uri: imageUrl }} style={styles.deckImage} />
            ) : (
              <View key={deckCardKey} style={[styles.deckImage, styles.placeholderImage]}>
                <Ionicons name="home-outline" size={40} color="#C7CDD8" />
              </View>
            )}

            <View style={styles.deckContent}>
              <Text style={styles.deckPrice}>{formatPrice(currentListing.Price)}</Text>
              {!!distanceText && (
                <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
              )}
              <Text style={styles.deckTitle} numberOfLines={2}>
                {currentListing.Title || currentListing.Address || 'Property match'}
              </Text>
              <Text style={styles.deckMeta} numberOfLines={1}>
                {[currentListing.Beds && `${currentListing.Beds} beds`, currentListing.Baths && `${currentListing.Baths} baths`, currentListing.PropertyType]
                  .filter(Boolean)
                  .join(' / ')}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={() => completeSwipe('left')}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shortlistButton]}
            onPress={() => completeSwipe('right')}
          >
            <Ionicons name="albums" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderShortlistItem = ({ item, index }) => {
    const imageUrl = normalizeImageUrls(item)[0];
    const listingId = getListingId(item);
    const propertyRating = getListingRating(item);
    const userRating = getUserMatchRating(item);
    const distanceText = formatSearchDistance(item);

    return (
      <TouchableOpacity
        style={styles.shortlistItem}
        activeOpacity={0.9}
        onPress={() => openListingPreview(item)}
        onLongPress={() => openFullListing(item)}
      >
        <Text style={styles.shortlistRank}>#{index + 1}</Text>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.shortlistImage} />
        ) : (
          <View style={[styles.shortlistImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={22} color="#C7CDD8" />
          </View>
        )}

        <View style={styles.shortlistContent}>
          <Text style={styles.shortlistPrice}>{formatPrice(item.Price)}</Text>
          {!!distanceText && (
            <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
          )}
          <Text style={styles.shortlistTitle} numberOfLines={2}>
            {item.Title || item.Address || 'Shortlisted property'}
          </Text>
          <View style={styles.shortlistScoreRow}>
            <View style={styles.compactScorePill}>
              <Text style={styles.compactScoreLabel}>Property</Text>
              <Text style={styles.compactScoreValue}>{propertyRating}</Text>
            </View>
            <View style={[styles.compactScorePill, styles.compactUserScorePill]}>
              <Text style={[styles.compactScoreLabel, styles.compactUserScoreLabel]}>Your fit</Text>
              <Text style={[styles.compactScoreValue, styles.compactUserScoreValue]}>{userRating}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFromBoard(listingId)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderBoardItem = ({ item, index }) => {
    const imageUrl = normalizeImageUrls(item)[0];
    const propertyRating = getListingRating(item);
    const userRating = getUserMatchRating(item);
    const listingId = getListingId(item);
    const distanceText = formatSearchDistance(item);
    const creatingDecision = decisionCreatingListingId === listingId;

    return (
      <TouchableOpacity
        style={styles.boardCard}
        activeOpacity={0.9}
        onPress={() => openListingPreview(item)}
        onLongPress={() => openFullListing(item)}
      >
        <Text style={styles.boardRank}>#{index + 1}</Text>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.boardImage} />
        ) : (
          <View style={[styles.boardImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={26} color="#C7CDD8" />
          </View>
        )}

        <View style={styles.boardContent}>
          <Text style={styles.boardPrice}>{formatPrice(item.Price)}</Text>
          {!!distanceText && (
            <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
          )}
          <Text style={styles.boardTitle} numberOfLines={2}>
            {item.Title || item.Address || 'Shortlisted property'}
          </Text>
          <Text style={styles.boardMeta} numberOfLines={1}>
            {[item.Beds && `${item.Beds} beds`, item.Baths && `${item.Baths} baths`, item.PropertyType]
              .filter(Boolean)
              .join(' / ')}
          </Text>
        </View>

        <View style={styles.ratingStack}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingLabel}>Property</Text>
            <Text style={styles.ratingValue}>{propertyRating}</Text>
          </View>
          <View style={[styles.ratingPill, styles.userRatingPill]}>
            <Text style={[styles.ratingLabel, styles.userRatingLabel]}>Your fit</Text>
            <Text style={[styles.ratingValue, styles.userRatingValue]}>{userRating}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.decisionButton, creatingDecision && styles.disabledDecisionButton]}
          onPress={() => openDecisionBoard(item)}
          disabled={creatingDecision}
        >
          <Ionicons name="flag-outline" size={17} color={creatingDecision ? '#94A3B8' : APP_PURPLE} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFromShortlist(listingId)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderComparisonCandidate = (item, label) => {
    if (!item) {
      return (
        <View style={styles.compareCard}>
          <Text style={styles.compareLabel}>{label}</Text>
          <View style={styles.compareEmpty}>
            <Ionicons name="add-circle-outline" size={26} color="#C7CDD8" />
            <Text style={styles.emptyText}>Add another shortlist property to compare.</Text>
          </View>
        </View>
      );
    }

    const imageUrl = normalizeImageUrls(item)[0];
    const notes = getComparisonNotes(item);
    const distanceText = formatSearchDistance(item);
    const listingId = getListingId(item);
    const creatingDecision = decisionCreatingListingId === listingId;

    return (
      <View style={styles.compareCard}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => openListingPreview(item)}>
        <Text style={styles.compareLabel}>{label}</Text>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.compareImage} />
        ) : (
          <View style={[styles.compareImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={30} color="#C7CDD8" />
          </View>
        )}
        <View style={styles.compareBody}>
          <Text style={styles.boardPrice}>{formatPrice(item.Price)}</Text>
          {!!distanceText && (
            <Text style={styles.distanceText} numberOfLines={1}>{distanceText}</Text>
          )}
          <Text style={styles.boardTitle} numberOfLines={2}>
            {item.Title || item.Address || 'Shortlisted property'}
          </Text>
          <View style={styles.compareScoreRow}>
            <Text style={styles.compareScore}>Property {getListingRating(item)}</Text>
            <Text style={styles.compareScore}>Your fit {getUserMatchRating(item)}</Text>
          </View>
          <Text style={styles.compareSubhead}>Pros</Text>
          {notes.pros.map((note, index) => (
            <Text key={`pro-${index}`} style={styles.compareNote}>+ {note}</Text>
          ))}
          <Text style={styles.compareSubhead}>Cons</Text>
          {notes.cons.map((note, index) => (
            <Text key={`con-${index}`} style={styles.compareNote}>- {note}</Text>
          ))}
        </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.compareDecisionButton, creatingDecision && styles.disabledDecisionButton]}
          onPress={() => openDecisionBoard(item)}
          disabled={creatingDecision}
        >
          <Ionicons name="flag-outline" size={18} color={creatingDecision ? '#94A3B8' : '#FFFFFF'} />
          <Text style={[styles.compareDecisionButtonText, creatingDecision && styles.disabledDecisionButtonText]}>
            {creatingDecision ? 'Opening...' : 'Pursue'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBoardScreen = () => {
    const shortlist = [...boardListings].sort((a, b) => (
      (getNumericValue(a?.boardRank, a?.BoardRank) ?? 9999) - (getNumericValue(b?.boardRank, b?.BoardRank) ?? 9999) ||
      getUserMatchRating(b) - getUserMatchRating(a) ||
      getListingRating(b) - getListingRating(a)
    ));
    const [firstCandidate, secondCandidate] = shortlist;

    return (
      <>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('shortlist')}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.detailHeaderText}>
            <Text style={styles.title} numberOfLines={1}>Decider Board</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {comparisonBoard?.name || selectedDeck?.name || 'Property Deck'} / {shortlist.length} candidates
            </Text>
          </View>
        </View>

        {renderFlowSteps()}

        <View style={styles.boardIntro}>
          <View style={styles.boardIntroIcon}>
            <Ionicons name="analytics-outline" size={22} color={APP_PURPLE} />
          </View>
          <View style={styles.boardIntroText}>
            <Text style={styles.boardIntroTitle}>Comparison workspace</Text>
            <Text style={styles.boardIntroCopy}>
              Compare the strongest candidates head to head, then keep thinning the ranked list below.
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.compareRow}
          showsHorizontalScrollIndicator={false}
        >
          {renderComparisonCandidate(firstCandidate, 'Candidate A')}
          {renderComparisonCandidate(secondCandidate, 'Candidate B')}
        </ScrollView>

        <FlatList
          data={shortlist}
          renderItem={renderBoardItem}
          keyExtractor={(item, index) => getListingId(item) || `board-${index}`}
          contentContainerStyle={styles.boardList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
              <Text style={styles.emptyTitle}>{loadingBoard ? 'Loading board' : 'No board candidates yet'}</Text>
              <Text style={styles.emptyText}>Move properties into the shortlist before opening the Decider Board.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </>
    );
  };

  const renderDetailScreen = () => (
    <>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('list')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.detailHeaderText}>
          <Text style={styles.title} numberOfLines={1}>
            {selectedDeck?.name || 'Property Deck'}
          </Text>
          <Text style={styles.subtitle}>
            {[
              getDeckSearchLocationLabel(selectedDeck),
              `${filteredDeckListings.length} of ${deckListings.length} listings`,
              'swipe left to remove, right to shortlist',
            ].filter(Boolean).join(' / ')}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerFilterButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={18} color={APP_PURPLE} />
          <Text style={styles.headerFilterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {renderFlowSteps()}

      <View style={styles.deckFlowContent}>
        <View style={styles.flowStepHeader}>
          <Text style={styles.columnTitle}>Property Deck</Text>
          <Text style={styles.flowCounter}>
            {Math.min(currentIndex + 1, filteredDeckListings.length || 1)} / {filteredDeckListings.length || 0}
          </Text>
        </View>
        {renderDeckCard()}
      </View>

      <TouchableOpacity
        style={styles.flowNextButton}
        onPress={() => setMode('shortlist')}
      >
        <Text style={styles.flowNextButtonText}>
          Shortlist({selectedDeck?.shortlist.length || 0})
        </Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </>
  );

  const renderShortlistScreen = () => (
    <>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('detail')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.detailHeaderText}>
          <Text style={styles.title} numberOfLines={1}>Shortlist</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Review {selectedDeck?.shortlist.length || 0} selected listings from {selectedDeck?.name || 'Property Deck'}.
          </Text>
        </View>
      </View>

      {renderFlowSteps()}

      <FlatList
        data={selectedDeck?.shortlist || []}
        renderItem={renderShortlistItem}
        keyExtractor={(item, index) => getListingId(item) || `shortlist-${index}`}
        contentContainerStyle={styles.shortlistScreenList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
            <Text style={styles.emptyTitle}>No shortlisted properties yet.</Text>
            <Text style={styles.emptyText}>Go back to the deck and swipe right on listings you want to compare.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[
          styles.flowNextButton,
          !(selectedDeck?.shortlist.length) && styles.disabledFlowNextButton,
        ]}
        disabled={!(selectedDeck?.shortlist.length)}
        onPress={() => setMode('board')}
      >
        <Text style={[
          styles.flowNextButtonText,
          !(selectedDeck?.shortlist.length) && styles.disabledFlowNextButtonText,
        ]}>
          Board
        </Text>
        <Ionicons
          name="analytics-outline"
          size={18}
          color={selectedDeck?.shortlist.length ? '#FFFFFF' : '#94A3B8'}
        />
      </TouchableOpacity>
    </>
  );

  const renderPreviewModal = () => {
    if (!previewListing) return null;

    const imageUrls = normalizeImageUrls(previewListing);

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setPreviewListing(null)}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeaderTitle}>Listing Preview</Text>
              <TouchableOpacity style={styles.previewCloseButton} onPress={() => setPreviewListing(null)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {imageUrls[0] ? (
                <Image source={{ uri: imageUrls[0] }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, styles.placeholderImage]}>
                  <Ionicons name="home-outline" size={44} color="#C7CDD8" />
                </View>
              )}

              <View style={styles.previewBody}>
                <Text style={styles.previewPrice}>{formatPrice(previewListing.Price)}</Text>
                <Text style={styles.previewTitle}>
                  {previewListing.Title || previewListing.Address || 'Property match'}
                </Text>
                <Text style={styles.previewMeta}>
                  {[previewListing.Beds && `${previewListing.Beds} beds`, previewListing.Baths && `${previewListing.Baths} baths`, previewListing.PropertyType]
                    .filter(Boolean)
                    .join(' / ')}
                </Text>
                {!!previewListing.Description && (
                  <Text style={styles.previewDescription}>{previewListing.Description}</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewSkipButton]}
                onPress={() => handlePreviewDecision('left')}
              >
                <Ionicons name="close" size={20} color="#475569" />
                <Text style={styles.previewSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewDetailsButton]}
                onPress={() => openFullListing(previewListing)}
              >
                <Ionicons name="open-outline" size={20} color={APP_PURPLE} />
                <Text style={styles.previewDetailsText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewActionButton, styles.previewShortlistButton]}
                onPress={() => handlePreviewDecision('right')}
              >
                <Ionicons name="albums" size={20} color="#FFFFFF" />
                <Text style={styles.previewShortlistText}>Shortlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDeckFilterModal = () => (
    <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
      <View style={styles.previewOverlay}>
        <View style={styles.filterModalCard}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewHeaderTitle}>Property Deck Filters</Text>
              <Text style={styles.filterResultText}>
                {filteredDeckListings.length} of {deckListings.length} listings
              </Text>
            </View>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.filterModalBody} showsVerticalScrollIndicator={false}>
            {renderFilterSection(
              'Property type',
              renderChoiceChips(PROPERTY_TYPE_OPTIONS, deckFilters.propertyType, (key) => setDeckFilterValue('propertyType', key))
            )}

            {renderFilterSection(
              'Include, exclude & show only',
              SPECIAL_FILTERS.map((item) => (
                <View key={item.key} style={styles.triFilterRow}>
                  <Text style={styles.triFilterTitle}>{item.label}</Text>
                  <View style={styles.triFilterOptions}>
                    {TRI_STATE_OPTIONS.map((mode) => {
                      const isSelected = deckFilters.special?.[item.key] === mode;
                      const label = mode === 'only' ? 'Show only' : mode.charAt(0).toUpperCase() + mode.slice(1);
                      return (
                        <TouchableOpacity
                          key={mode}
                          style={[styles.triFilterButton, isSelected && styles.triFilterButtonSelected]}
                          onPress={() => setSpecialFilterMode(item.key, mode)}
                        >
                          <Text style={[styles.triFilterButtonText, isSelected && styles.triFilterButtonTextSelected]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))
            )}

            {renderFilterSection(
              'Must-haves',
              renderToggleChips(MUST_HAVE_FILTERS, deckFilters.mustHaves, (key) => toggleArrayFilter('mustHaves', key))
            )}

            {renderFilterSection(
              'Ownership',
              renderChoiceChips(OWNERSHIP_OPTIONS, deckFilters.ownership, (key) => setDeckFilterValue('ownership', key))
            )}

            {renderFilterSection(
              'Property status',
              renderToggleChips(STATUS_FILTERS, deckFilters.statuses, (key) => toggleArrayFilter('statuses', key))
            )}

            {renderFilterSection(
              'Property features',
              renderChoiceChips(FEATURE_OPTIONS, deckFilters.feature, (key) => setDeckFilterValue('feature', key))
            )}

            {SHOW_DATE_ADDED_FILTER && renderFilterSection(
              'Date added',
              renderChoiceChips(ADDED_OPTIONS, deckFilters.added, (key) => setDeckFilterValue('added', key))
            )}
          </ScrollView>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.filterResetButton} onPress={resetDeckFilters}>
              <Text style={styles.filterResetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyButton} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.filterApplyButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {mode === 'board'
        ? renderBoardScreen()
        : mode === 'shortlist'
          ? renderShortlistScreen()
          : mode === 'detail'
            ? renderDetailScreen()
            : renderListScreen()}
      {renderPreviewModal()}
      {renderDeckFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F8FB',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
    width: 40,
  },
  detailHeaderText: {
    flex: 1,
  },
  headerFilterButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    marginLeft: 8,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  headerFilterButtonText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 3,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  disabledCreateButton: {
    backgroundColor: '#E5E7EB',
  },
  deckList: {
    padding: 18,
    paddingBottom: 32,
  },
  deckListItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
  },
  deckListIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  deckListContent: {
    flex: 1,
  },
  deckListActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  deckListTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  deckListMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deckNameInput: {
    borderBottomColor: APP_PURPLE,
    borderBottomWidth: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 2,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginLeft: 8,
    width: 42,
  },
  deletedSection: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 18,
  },
  deletedSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deletedSectionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  deletedSectionMeta: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  deletedDeckListItem: {
    borderColor: '#FEE2E2',
    borderWidth: 1,
  },
  deletedDeckIcon: {
    backgroundColor: '#FEF2F2',
  },
  deletedDeckActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  restoreButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 9,
  },
  restoreButtonText: {
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },
  destroyButton: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 9,
  },
  destroyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },
  flowStepsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  flowStepItem: {
    flex: 1,
  },
  flowStepTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  flowStepDot: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  flowStepDotActive: {
    backgroundColor: APP_PURPLE,
    borderColor: APP_PURPLE,
  },
  flowStepDotComplete: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  flowStepNumber: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  flowStepNumberActive: {
    color: '#FFFFFF',
  },
  flowStepLine: {
    backgroundColor: '#E5E7EB',
    flex: 1,
    height: 3,
    marginHorizontal: 6,
  },
  flowStepLineActive: {
    backgroundColor: APP_PURPLE,
  },
  flowStepLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
  },
  flowStepLabelActive: {
    color: '#111827',
  },
  deckFlowContent: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    paddingBottom: 92,
  },
  flowStepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flowCounter: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  flowNextButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 999,
    bottom: 18,
    elevation: 4,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 18,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  disabledFlowNextButton: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  flowNextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 8,
  },
  disabledFlowNextButtonText: {
    color: '#94A3B8',
  },
  shortlistScreenList: {
    padding: 16,
    paddingBottom: 96,
  },
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 6,
  },
  rightColumn: {
    flex: 1,
    paddingLeft: 6,
  },
  columnTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  columnHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  boardButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  disabledBoardButton: {
    backgroundColor: '#E5E7EB',
  },
  boardButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 5,
  },
  disabledBoardButtonText: {
    color: '#94A3B8',
  },
  deckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  deckImage: {
    backgroundColor: '#EEF2F7',
    height: 220,
    width: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckContent: {
    padding: 12,
  },
  deckPrice: {
    color: APP_PURPLE,
    fontSize: 17,
    fontWeight: '800',
  },
  deckTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 5,
  },
  deckMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  distanceText: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 7,
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  skipButton: {
    backgroundColor: '#E5E7EB',
  },
  shortlistButton: {
    backgroundColor: APP_PURPLE,
  },
  shortlistItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
  },
  shortlistRank: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    width: 32,
  },
  shortlistImage: {
    backgroundColor: '#EEF2F7',
    height: 92,
    width: 70,
  },
  shortlistContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shortlistPrice: {
    color: APP_PURPLE,
    fontSize: 13,
    fontWeight: '800',
  },
  shortlistTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  shortlistScoreRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  compactScorePill: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    flexDirection: 'row',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  compactUserScorePill: {
    backgroundColor: '#EEF2FF',
  },
  compactScoreLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    marginRight: 4,
    textTransform: 'uppercase',
  },
  compactUserScoreLabel: {
    color: APP_PURPLE,
  },
  compactScoreValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  compactUserScoreValue: {
    color: APP_PURPLE,
  },
  removeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 34,
  },
  decisionButton: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginRight: 4,
    width: 36,
  },
  disabledDecisionButton: {
    backgroundColor: '#F1F5F9',
  },
  disabledDecisionButtonText: {
    color: '#94A3B8',
  },
  boardIntro: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  boardIntroIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  boardIntroText: {
    flex: 1,
  },
  boardIntroTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  boardIntroCopy: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  boardList: {
    padding: 14,
    paddingBottom: 32,
  },
  compareRow: {
    gap: 12,
    padding: 14,
  },
  compareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    width: 270,
  },
  compareLabel: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingTop: 10,
    textTransform: 'uppercase',
  },
  compareImage: {
    backgroundColor: '#EEF2F7',
    height: 120,
    marginTop: 8,
    width: '100%',
  },
  compareBody: {
    padding: 12,
  },
  compareScoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  compareScore: {
    backgroundColor: '#EEF2FF',
    borderRadius: 7,
    color: APP_PURPLE,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  compareSubhead: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  compareNote: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  compareEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    padding: 18,
  },
  compareDecisionButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 42,
  },
  compareDecisionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  boardCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
  },
  boardRank: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    width: 38,
  },
  boardImage: {
    backgroundColor: '#EEF2F7',
    height: 92,
    width: 86,
  },
  boardContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  boardPrice: {
    color: APP_PURPLE,
    fontSize: 14,
    fontWeight: '900',
  },
  boardTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 4,
  },
  boardMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  ratingStack: {
    paddingRight: 10,
    width: 84,
  },
  ratingPill: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginVertical: 3,
    paddingVertical: 6,
  },
  userRatingPill: {
    backgroundColor: '#EEF2FF',
  },
  ratingLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  userRatingLabel: {
    color: APP_PURPLE,
  },
  ratingValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },
  userRatingValue: {
    color: APP_PURPLE,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 56,
  },
  detailEmptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 20,
  },
  shortlistEmpty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  previewOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  filterModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  previewHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewHeaderTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  filterResultText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  previewCloseButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewImage: {
    backgroundColor: '#EEF2F7',
    height: 260,
    width: '100%',
  },
  previewBody: {
    padding: 16,
  },
  previewPrice: {
    color: APP_PURPLE,
    fontSize: 22,
    fontWeight: '800',
  },
  previewTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 6,
  },
  previewMeta: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  previewDescription: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },
  previewActions: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  previewActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
  },
  previewSkipButton: {
    backgroundColor: '#E5E7EB',
  },
  previewDetailsButton: {
    backgroundColor: '#EEF2FF',
  },
  previewShortlistButton: {
    backgroundColor: APP_PURPLE,
  },
  previewSkipText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  previewDetailsText: {
    color: APP_PURPLE,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  previewShortlistText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  filterModalBody: {
    padding: 16,
    paddingBottom: 24,
  },
  filterSection: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  filterSectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: APP_PURPLE,
  },
  filterChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextSelected: {
    color: APP_PURPLE,
  },
  triFilterRow: {
    marginBottom: 14,
  },
  triFilterTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },
  triFilterOptions: {
    flexDirection: 'row',
    gap: 7,
  },
  triFilterButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  triFilterButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: APP_PURPLE,
  },
  triFilterButtonText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  triFilterButtonTextSelected: {
    color: APP_PURPLE,
  },
  filterFooter: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  filterResetButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
  },
  filterResetButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '900',
  },
  filterApplyButton: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 8,
    flex: 1.4,
    minHeight: 46,
    justifyContent: 'center',
  },
  filterApplyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
