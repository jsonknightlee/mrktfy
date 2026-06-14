import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal,
  ScrollView, Animated, TouchableWithoutFeedback, TextInput
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropDownPicker from 'react-native-dropdown-picker';
import WheelPickerExpo from 'react-native-wheel-picker-expo';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNearbyListings } from '../services/realEstateApi';
import { getToken } from '../utils/tokenStorage';
import Constants from "expo-constants";
import { useFavorites } from '../contexts/FavoritesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { AdBanner } from '../services/adService';
import { api } from '../services/api';
import {
  createPropertyDeckFromListings,
  getPropertyDeckLimit,
  getPropertyDecks,
} from '../services/PropertyDeckService';

// Show only if the date is before today (local device timezone)
const isBeforeToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < startOfToday;
};

const formatLastViewed = (iso) => new Date(iso).toLocaleDateString();

const { API_BASE_URL, API_KEY} = Constants.expoConfig.extra;
const FILTER_STORAGE_KEY = 'mrktfy-filters';
const TYPE_STORAGE_KEY = 'mrktfy-property-type';
const SEARCH_LOCATION_STORAGE_KEY = 'mrktfy-map-search-location';
const TOAST_DURATION_MS = 20000; // 20s
const MAP_LISTING_LIMIT = 2000;

const TYPE_RENT = 'to-rent';
const TYPE_SALE = 'for-sale';
const APP_PURPLE = '#6366F1';
const VIEWED_PIN_GREY = '#9CA3AF';

const PIN_COLORS = {
  [TYPE_RENT]: '#32CD32',
  [TYPE_SALE]: undefined,
};

const prettyType = (t) => (t === TYPE_RENT ? 'RENTAL' : 'FOR SALE');

const formatFilterPrice = (value, rental = false) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'Any';
  if (!rental && numeric > 1000000) return '£1m+';
  if (rental && numeric >= 1000) return `£${(numeric / 1000).toFixed(numeric % 1000 === 0 ? 0 : 1)}k`;
  if (!rental && numeric >= 1000) return `£${(numeric / 1000).toFixed(numeric % 1000 === 0 ? 0 : 1)}k`;
  return `£${numeric.toLocaleString()}`;
};

const formatMinimumRoomLabel = (value) => {
  if (!value || value === '0') return 'Any';
  return `${value}+`;
};

const getStatusTag = (listing) => {
  const status = listing?.Status ?? listing?.status;
  if (typeof status !== 'string') return null;

  const trimmed = status.trim();
  return trimmed.length ? trimmed : null;
};

const canUseSearchLocation = (tier) => ['investor', 'developer'].includes(String(tier || '').toLowerCase());

const getSearchLocationLabel = (location) => {
  if (!location) return 'Current location';
  return location.label || location.query || 'Search location';
};

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState(null);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapType, setMapType] = useState('real-estate');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({ minPrice: '0', maxPrice: '400000', beds: '', baths: '' });
  const [filtersTouched, setFiltersTouched] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [openBeds, setOpenBeds] = useState(null);
  const [openBaths, setOpenBaths] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [searchLocationInputVisible, setSearchLocationInputVisible] = useState(false);
  const [searchLocationQuery, setSearchLocationQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Wheel state (we avoid re-render during scroll)
  const minIndexRef = useRef(0);
  const maxIndexRef = useRef(0);
  const minValueRef = useRef('0');        // ← track exact selected VALUE
  const maxValueRef = useRef('400000');   // ← track exact selected VALUE
  const [pickerMountKey, setPickerMountKey] = useState(0);

  // Animations & refs
  const [badgeAnim] = useState(new Animated.Value(200));
  const deckBorderAnim = useRef(new Animated.Value(0)).current;
  const isInteractingWithMarker = useRef(false);
  const isDismissingRef = useRef(false);

  // Toast
  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastY = useRef(new Animated.Value(120)).current;
  const toastTimerRef = useRef(null);

  //Open box on pin click fix
  const suppressMapPressUntilRef = React.useRef(0);
  const suppressMapPress = (ms = 450) => {
    suppressMapPressUntilRef.current = Date.now() + ms;
  };

  const showToast = (msg, duration = TOAST_DURATION_MS) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(msg);
    setToastVisible(true);
    Animated.timing(toastY, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      toastTimerRef.current = setTimeout(hideToast, duration);
    });
  };

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(deckBorderAnim, { toValue: 1, duration: 2600, useNativeDriver: true })
    );

    animation.start();
    return () => animation.stop();
  }, [deckBorderAnim]);
  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    Animated.timing(toastY, { toValue: 120, duration: 220, useNativeDriver: true }).start(() => {
      setToastVisible(false);
    });
  };

  // Favorites
  const { toggleFavorite, getFavoriteStatus, setLastViewed } = useFavorites();
  const { currentTier, getMaxSearchRadius, subscriptionLevels, updateSubscription, loading, error, getCurrentSubscriptionLevel, shouldShowAd, getTrialStatus, userProfile } = useSubscription();
  const navigation = useNavigation();
  const searchLocationEnabled = canUseSearchLocation(currentTier);
  const activeSearchLocation = searchLocationEnabled && searchLocation ? searchLocation : userLocation;
  const activeSearchLocationLabel = searchLocationEnabled && searchLocation
    ? getSearchLocationLabel(searchLocation)
    : 'Current location';

  const getListingPinColor = (listing) => {
    const status = getFavoriteStatus(listing.ID);
    if (status.isFavorited) return APP_PURPLE;
    if (status.lastViewedAt) return VIEWED_PIN_GREY;

    return PIN_COLORS[
      (listing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase()
    ];
  };

  // Get trial status for badge
  const trialStatus = getTrialStatus();
  const subscriptionName = getCurrentSubscriptionLevel()?.name || 'Free';
  const badgeText = trialStatus.isInTrial 
    ? `${subscriptionName}(${trialStatus.daysRemaining}d)` 
    : subscriptionName;

  const priceOptions = useMemo(() => {
    const step = isRental ? 100 : 100000;
    const max = isRental ? 5000 : 900000;
    const arr = [];
    for (let i = 0; i <= max; i += step) {
      arr.push({ label: `£${i.toLocaleString()}`, value: i.toString(), key: `price-${i}` });
    }
    if (!isRental) arr.push({ label: '£1,000,000+', value: '1000001', key: 'price-1000001' });
    return arr;
  }, [isRental]);

  const parsePrice = (p) => {
    if (typeof p === 'number') return p;
    const s = (p ?? '').toString();
    const digits = s.replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  const updateFilters = (next) => {
    setFiltersTouched(true);
    setFilters((prev) => {
      const changed =
        prev.minPrice !== next.minPrice ||
        prev.maxPrice !== next.maxPrice ||
        prev.beds !== next.beds ||
        prev.baths !== next.baths;
      if (!changed) return prev;
      const updated = { ...prev, ...next };
      AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const loadListingsForLocation = async (location, type = isRental ? TYPE_RENT : TYPE_SALE) => {
    if (!location?.latitude || !location?.longitude) return;

    setSelectedListing(null);
    setListings([]);
    setFilteredListings([]);

    try {
      const searchRadius = getMaxSearchRadius();
      console.log(`🔍 Using search radius: ${searchRadius}km for ${currentTier} tier`);
      const nearby = await fetchNearbyListings(location.latitude, location.longitude, searchRadius, type, MAP_LISTING_LIMIT);
      setListings(nearby);

      if (nearby.length === 0) {
        showToast(`No listings found near ${getSearchLocationLabel(location)}.`);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
      try {
        const searchRadius = getMaxSearchRadius();
        const londonNearby = await fetchNearbyListings(51.5074, -0.1278, searchRadius, type, MAP_LISTING_LIMIT);
        setListings(londonNearby);
        console.log('Error fallback to London, found:', londonNearby.length, 'listings');
      } catch (fallbackErr) {
        console.error('London fallback also failed:', fallbackErr);
      }
    }
  };

  // Load saved filters & type
  useEffect(() => {
    (async () => {
      try {
        const [storedFilters, storedType] = await Promise.all([
          AsyncStorage.getItem(FILTER_STORAGE_KEY),
          AsyncStorage.getItem(TYPE_STORAGE_KEY),
        ]);
        if (storedFilters) {
          const parsed = JSON.parse(storedFilters);
          setFilters(parsed);
          setFiltersTouched(true);
        }
        if (storedType === TYPE_RENT || storedType === TYPE_SALE) {
          setIsRental(storedType === TYPE_RENT);
        }
      } catch (err) {
        console.warn('Failed to load prefs:', err);
      }
    })();
  }, []);

  // Coerce min/max when switching type
  useEffect(() => {
    setFilters((prev) => {
      const hasMin = priceOptions.some((o) => o.value === prev.minPrice);
      const hasMax = priceOptions.some((o) => o.value === prev.maxPrice);
      const coercedMin = hasMin ? prev.minPrice : '0';
      const coercedMax = hasMax ? prev.maxPrice : (isRental ? '2000' : '400000');
      if (coercedMin === prev.minPrice && coercedMax === prev.maxPrice) return prev;
      const updated = { ...prev, minPrice: coercedMin, maxPrice: coercedMax };
      AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRental, priceOptions]);

  const handleToggleType = async (value) => {
    setIsRental(value);
    try { await AsyncStorage.setItem(TYPE_STORAGE_KEY, value ? TYPE_RENT : TYPE_SALE); } catch {}
  };

  // Sync indices & *values* and remount wheels when modal opens
  useEffect(() => {
    if (filterModalVisible) {
      const minIdx = Math.max(0, priceOptions.findIndex((o) => o.value === filters.minPrice));
      const tmpMaxIdx = priceOptions.findIndex((o) => o.value === filters.maxPrice);
      const maxIdx = tmpMaxIdx >= 0 ? tmpMaxIdx : priceOptions.length - 1;

      minIndexRef.current = minIdx;
      maxIndexRef.current = maxIdx;
      minValueRef.current = priceOptions[minIdx]?.value ?? filters.minPrice;   // ← keep value in sync
      maxValueRef.current = priceOptions[maxIdx]?.value ?? filters.maxPrice;   // ← keep value in sync

      setPickerMountKey((k) => k + 1);
    }
  }, [filterModalVisible, priceOptions, filters.minPrice, filters.maxPrice]);

  // fetch listings by type and active search location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const nextUserLocation = { latitude, longitude, label: 'Current location', source: 'user' };
      setUserLocation(nextUserLocation);

      let savedSearchLocation = null;
      if (canUseSearchLocation(currentTier)) {
        try {
          const savedValue = await AsyncStorage.getItem(SEARCH_LOCATION_STORAGE_KEY);
          savedSearchLocation = savedValue ? JSON.parse(savedValue) : null;
        } catch {}
      } else {
        await AsyncStorage.removeItem(SEARCH_LOCATION_STORAGE_KEY);
        setSearchLocation(null);
        setSearchLocationInputVisible(false);
      }

      if (savedSearchLocation?.latitude && savedSearchLocation?.longitude) {
        setSearchLocation(savedSearchLocation);
        if (!searchLocationQuery) {
          setSearchLocationQuery(savedSearchLocation.query || savedSearchLocation.label || '');
        }
      }

      const locationForSearch = savedSearchLocation?.latitude && canUseSearchLocation(currentTier)
        ? savedSearchLocation
        : nextUserLocation;

      await loadListingsForLocation(locationForSearch, isRental ? TYPE_RENT : TYPE_SALE);
    })();
  }, [isRental, currentTier]);

  useEffect(() => {
    if (!userLocation || !searchLocationEnabled || searchLocation) return;
    setSearchLocationInputVisible(false);
  }, [searchLocation, searchLocationEnabled, userLocation]);

  const submitSearchLocation = async () => {
    if (!searchLocationEnabled) return;

    const query = searchLocationQuery.trim();
    if (!query) {
      showToast('Enter an address or postcode to search from.');
      return;
    }

    setSearchingLocation(true);
    try {
      const geocodeResults = await Location.geocodeAsync(query);
      const result = geocodeResults?.[0];
      if (!result) {
        showToast('No location found. Try a fuller address or postcode.');
        return;
      }

      const nextSearchLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
        label: query,
        query,
        source: 'search',
        savedAt: new Date().toISOString(),
      };

      setSelectedListing(null);
      setSearchLocation(nextSearchLocation);
      setSearchLocationInputVisible(false);
      await AsyncStorage.setItem(SEARCH_LOCATION_STORAGE_KEY, JSON.stringify(nextSearchLocation));
      await loadListingsForLocation(nextSearchLocation, isRental ? TYPE_RENT : TYPE_SALE);
    } catch (err) {
      console.error('Search location failed:', err);
      showToast('Could not search that location. Try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const useCurrentLocationForSearch = async () => {
    if (!userLocation) return;
    setSelectedListing(null);
    setSearchLocation(null);
    setSearchLocationInputVisible(false);
    setSearchLocationQuery('');
    await AsyncStorage.removeItem(SEARCH_LOCATION_STORAGE_KEY);
    await loadListingsForLocation(userLocation, isRental ? TYPE_RENT : TYPE_SALE);
  };

  // re-apply when (new) listings arrive
  useEffect(() => {
    // Always show the map, regardless of listings count
    setTimeout(() => setMapVisible(true), 100);
    
    if (listings.length > 0) {
      if (filtersTouched) {
        applyFilters(); // uses current filters state
      } else {
        setFilteredListings(listings);
        if (listings.length === 0) showToast('No listings found nearby.');
      }
    } else {
      setFilteredListings([]);
    }
  }, [listings, filtersTouched]);

  // Apply using optional source filters (so we can use fresh values immediately)
  const applyFilters = (sourceFilters = filters) => {
    const { minPrice, maxPrice, beds, baths } = sourceFilters;

    const min = parseInt(minPrice || '0', 10);
    const rawMax = parseInt(maxPrice || (isRental ? '2000' : '400000'), 10);
    const max = rawMax > 1000000 ? Infinity : rawMax;

    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const targetType = isRental ? TYPE_RENT : TYPE_SALE;

    let filtered = listings.filter((l) => {
      const lType = ((l.ListingType ?? '').toString().trim().toLowerCase());
      if (lType && lType !== targetType) return false;

      const price = parsePrice(l.Price);
      return price >= lo && price <= hi;
    });

    if (beds) filtered = filtered.filter((l) => parseInt(l.Beds, 10) >= parseInt(beds, 10));
    if (baths) filtered = filtered.filter((l) => parseInt(l.Baths, 10) >= parseInt(baths, 10));

    setFilteredListings(filtered);
    if (filtered.length === 0) {
      const loFmt = `£${lo.toLocaleString()}`;
      const hiFmt = hi === Infinity ? '£1,000,000+' : `£${hi.toLocaleString()}`;
      showToast(`No listings for ${isRental ? 'rentals' : 'sales'} between ${loFmt} and ${hiFmt}. Try widening the range.`);
    }
  };

  const resetFilters = () => {
    const def = { minPrice: '0', maxPrice: isRental ? '2000' : '400000', beds: '', baths: '' };
    setFilters(def);
    setFiltersTouched(false);
    AsyncStorage.removeItem(FILTER_STORAGE_KEY);
    setFilteredListings(listings);
    setFilterModalVisible(false);
  };

  const handlePropertyOpenWithAd = (listing) => {
    // Navigate directly - ListingDetailScreen will handle showing the ad
    navigation?.navigate?.('ListingDetail', { listing });
  };

  const handleCreatePropertyDeck = async () => {
    const deckLimit = getPropertyDeckLimit(currentTier);
    if (deckLimit <= 0) {
      navigation.navigate('Subscription');
      return;
    }

    const sourceListings = filtersTouched ? filteredListings : listings;
    if (!sourceListings.length) {
      showToast('No properties in the current map view to add to a deck.');
      return;
    }

    const existingDecks = await getPropertyDecks(userProfile);
    if (existingDecks.length >= deckLimit) {
      showToast(`You have reached your ${subscriptionName} Property Deck limit.`);
      return;
    }

    const searchRadiusKm = getMaxSearchRadius();
    const deckSearchLocation = activeSearchLocation || userLocation;
    const filterJson = {
      listingType: isRental ? TYPE_RENT : TYPE_SALE,
      radiusKm: searchRadiusKm,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      beds: filters.beds || null,
      baths: filters.baths || null,
      latitude: deckSearchLocation?.latitude || null,
      longitude: deckSearchLocation?.longitude || null,
      searchLocationLabel: activeSearchLocationLabel,
      searchLocationSource: searchLocationEnabled && searchLocation ? 'search' : 'user',
      searchLocationQuery: searchLocationEnabled && searchLocation ? searchLocation.query || searchLocation.label || null : null,
    };

    let deckCreationResult;
    try {
      deckCreationResult = await createPropertyDeckFromListings({
        userProfile,
        limit: deckLimit,
        listings: sourceListings,
        filterJson,
      });
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
      showToast(backendMessage || `Property Deck creation failed${status ? ` (${status})` : ''}.`);
      return;
    }

    const nextDecks = Array.isArray(deckCreationResult)
      ? deckCreationResult
      : deckCreationResult?.decks || [];
    const createdDeck = deckCreationResult?.createdDeck || nextDecks.find((deck) => !existingDecks.some((existingDeck) => existingDeck.id === deck.id));
    if (!createdDeck) {
      showToast(`You have reached your ${subscriptionName} Property Deck limit.`);
      return;
    }

    console.log('[PROPERTY-DECK] navigating to created deck:', {
      deckId: createdDeck.id,
      deckListingCount: createdDeck.deckListingCount,
    });

    navigation.navigate('Deck', {
      openDeckId: createdDeck.id,
      createdFromMap: true,
    });
  };

  const handleFavoriteToggleWithAd = (listingId) => {
    // Directly toggle favorite without showing ad
    toggleFavorite(listingId);
  };

  useEffect(() => {
    if (selectedListing) {
      Animated.timing(badgeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => { isInteractingWithMarker.current = false; }, 400);
    }
  }, [selectedListing]);

  const visibleListingCount = filtersTouched ? filteredListings.length : listings.length;
  const minPriceLabel = formatFilterPrice(filters.minPrice, isRental);
  const maxPriceLabel = formatFilterPrice(filters.maxPrice, isRental);
  const bedsLabel = formatMinimumRoomLabel(filters.beds);
  const bathsLabel = formatMinimumRoomLabel(filters.baths);

  if (!userLocation) {
    return (
      <View style={styles.center}>
        <Text>Loading your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastWrap, { transform: [{ translateY: toastY }] }]}>
          <TouchableWithoutFeedback onPress={hideToast}>
            <View style={styles.toast}>
              <Ionicons name="alert-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.toastText}>{toastText}</Text>
              <TouchableOpacity onPress={hideToast} style={styles.toastClose}>
                <Text style={styles.toastCloseText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
        <Ionicons name="filter" size={24} color="black" />
      </TouchableOpacity>

      {searchLocationEnabled && (
        <View style={styles.searchLocationPanel}>
          {searchLocationInputVisible ? (
            <View style={styles.searchLocationInputRow}>
              <Ionicons name="search" size={18} color="#64748B" />
              <TextInput
                style={styles.searchLocationInput}
                value={searchLocationQuery}
                onChangeText={setSearchLocationQuery}
                placeholder="Enter address or postcode"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                autoCapitalize="words"
                onSubmitEditing={submitSearchLocation}
              />
              <TouchableOpacity
                style={[styles.searchLocationSubmit, searchingLocation && styles.searchLocationSubmitDisabled]}
                onPress={submitSearchLocation}
                disabled={searchingLocation}
              >
                <Ionicons name={searchingLocation ? 'hourglass-outline' : 'arrow-forward'} size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchLocationClose} onPress={() => setSearchLocationInputVisible(false)}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchLocationCollapsedRow}>
              <TouchableOpacity
                style={styles.searchLocationButton}
                onPress={() => setSearchLocationInputVisible(true)}
                activeOpacity={0.9}
              >
                <Ionicons name="location-outline" size={17} color={APP_PURPLE} />
                <Text style={styles.searchLocationButtonText} numberOfLines={1}>
                  {searchLocation ? activeSearchLocationLabel : 'Search location'}
                </Text>
              </TouchableOpacity>
              {searchLocation ? (
                <TouchableOpacity style={styles.currentLocationButton} onPress={useCurrentLocationForSearch}>
                  <Ionicons name="navigate-outline" size={16} color="#475569" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.createDeckOuter} onPress={handleCreatePropertyDeck} activeOpacity={0.9}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.createDeckRainbow,
            {
              transform: [{
                rotate: deckBorderAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              }],
            },
          ]}
        />
        <View style={styles.createDeckBtn}>
          <Text style={styles.createDeckBtnText}>Create</Text>
          <View style={styles.createDeckIconWrap}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Subscription Badge */}
      <TouchableOpacity 
        style={styles.subscriptionBadge}
        onPress={() => navigation.navigate('Subscription')}
      >
        <Ionicons name="diamond-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
        <Text style={styles.subscriptionBadgeText}>
          {badgeText}
        </Text>
      </TouchableOpacity>

      {mapVisible && (
        <MapView
          key={`${activeSearchLocation?.latitude || userLocation.latitude}-${activeSearchLocation?.longitude || userLocation.longitude}`}
          style={styles.map}
          showsUserLocation
          initialRegion={{
            latitude: activeSearchLocation?.latitude || userLocation.latitude,
            longitude: activeSearchLocation?.longitude || userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={() => {
            if (Date.now() < suppressMapPressUntilRef.current) return;
            setSelectedListing(null);
          }}
          onPanDrag={() => {
            if (Date.now() < suppressMapPressUntilRef.current) return;
            setSelectedListing(null);
          }}
        >
          {/* User Radius Circle */}
          {activeSearchLocation && (
            <Circle
              center={{
                latitude: activeSearchLocation.latitude,
                longitude: activeSearchLocation.longitude,
              }}
              radius={getMaxSearchRadius() * 1000} // Convert km to meters
              strokeColor="rgba(0, 200, 255, 0.8)"
              fillColor="rgba(0, 200, 255, 0.1)"
              strokeWidth={2}
            />
          )}

          {filteredListings.map((listing) => (
            <Marker
              key={listing.ID}
              coordinate={{ latitude: listing.Latitude, longitude: listing.Longitude }}
              title={listing.Title}
              pinColor={getListingPinColor(listing)}
              onPress={async () => {
                suppressMapPress(500);

                isInteractingWithMarker.current = true;
                isDismissingRef.current = false;

                const token = await getToken();

                // Optimistic last viewed
                setLastViewed(listing.ID, new Date().toISOString());

                badgeAnim.setValue(200);
                setSelectedListing(null);

                setTimeout(() => {
                  setSelectedListing(listing);

                  api.get(`/activity/user-listings/status`, { params: { listingId: listing.ID } })
                    .then(({ data }) => {
                      if (data?.lastViewedAt) setLastViewed(listing.ID, data.lastViewedAt);
                    })
                    .catch((err) => console.error('Status fetch err:', err));

                  Animated.timing(badgeAnim, {
                    toValue: 0, duration: 300, useNativeDriver: true,
                  }).start(() => { isInteractingWithMarker.current = false; });
                }, 100);
              }}
            />
          ))}
        </MapView>
      )}

      {selectedListing && (
        <Animated.View style={[styles.card, { transform: [{ translateY: badgeAnim }] }]} pointerEvents="auto">
          <TouchableOpacity
            onPress={() => setSelectedListing(null)}
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: '#eee', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}
          >
            <Text style={{ fontSize: 18 }}>✕</Text>
          </TouchableOpacity>

          <View style={styles.cardBadgeRow}>
            <View
              style={[
                styles.listingTypeBadge,
                {
                  backgroundColor:
                    (selectedListing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase() === TYPE_RENT
                      ? '#b7f397'
                      : '#e6e6e6',
                },
              ]}
            >
              <Text style={styles.listingTypeBadgeText}>
                {prettyType((selectedListing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase())}
              </Text>
            </View>

            {(() => {
              const statusTag = getStatusTag(selectedListing);
              return statusTag ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{statusTag}</Text>
                </View>
              ) : null;
            })()}
          </View>

          <ScrollView
            key={`scroll-${selectedListing?.ID}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
            style={styles.imageRow}
            contentContainerStyle={{ paddingRight: 12 }}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
          >
            {selectedListing.ImageUrls?.map((imgUrl, idx) => (
              <Image key={idx} source={{ uri: imgUrl }} style={styles.image} />
            ))}
          </ScrollView>

          <TouchableOpacity onPress={() => handlePropertyOpenWithAd(selectedListing)} activeOpacity={0.8}>
            <Text style={styles.cardTitle}>{selectedListing.Title}</Text>

            {/* Price + Heart */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Price: {selectedListing.Price}</Text>
              <TouchableOpacity onPress={() => handleFavoriteToggleWithAd(selectedListing.ID)}>
                <Ionicons
                  name={getFavoriteStatus(selectedListing.ID)?.isFavorited ? 'heart' : 'heart-outline'}
                  size={22}
                  color={getFavoriteStatus(selectedListing.ID)?.isFavorited ? 'red' : 'gray'}
                />
              </TouchableOpacity>
            </View>

            {/* Conditionally show Last viewed only if it's from a previous day */}
            {(() => {
              const lv = getFavoriteStatus(selectedListing.ID)?.lastViewedAt;
              return lv && isBeforeToday(lv) ? (
                <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Last viewed: {formatLastViewed(lv)}
                </Text>
              ) : null;
            })()}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Filter Modal */}
      <Modal animationType="slide" transparent visible={filterModalVisible} onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.sheetHandle} />
            <View style={styles.filterHeader}>
              <View>
                <Text style={styles.modalTitle}>Find the right fit</Text>
                <Text style={styles.modalSubtitle}>
                  {visibleListingCount} {visibleListingCount === 1 ? 'property' : 'properties'} in view
                </Text>
              </View>
              <TouchableOpacity style={styles.closeFilterButton} onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSummaryRow}>
              <View style={styles.filterSummaryPill}>
                <Ionicons name="cash-outline" size={15} color={APP_PURPLE} />
                <Text style={styles.filterSummaryText}>{minPriceLabel} - {maxPriceLabel}</Text>
              </View>
              <View style={styles.filterSummaryPill}>
                <Ionicons name="bed-outline" size={15} color={APP_PURPLE} />
                <Text style={styles.filterSummaryText}>{bedsLabel} beds</Text>
              </View>
              <View style={styles.filterSummaryPill}>
                <Ionicons name="water-outline" size={15} color={APP_PURPLE} />
                <Text style={styles.filterSummaryText}>{bathsLabel} baths</Text>
              </View>
            </View>

            <View style={styles.filterContent}>
              <View style={styles.filterSectionCard}>
                <Text style={styles.inputLabel}>Search type</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segmentButton, !isRental && styles.segmentButtonActive]}
                    onPress={() => handleToggleType(false)}
                  >
                    <Ionicons name="home-outline" size={17} color={!isRental ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.segmentButtonText, !isRental && styles.segmentButtonTextActive]}>For sale</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentButton, isRental && styles.segmentButtonActive]}
                    onPress={() => handleToggleType(true)}
                  >
                    <Ionicons name="key-outline" size={17} color={isRental ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.segmentButtonText, isRental && styles.segmentButtonTextActive]}>To rent</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterSectionCard}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.inputLabel}>Price range</Text>
                  <Text style={styles.sectionValueText}>{minPriceLabel} - {maxPriceLabel}</Text>
                </View>
                <View style={styles.pricePickerRow}>
                  <View style={styles.pricePickerCard}>
                    <Text style={styles.pickerLabel}>Minimum</Text>
                    <WheelPickerExpo
                      key={`min-${pickerMountKey}`}
                      height={132}
                      initialSelectedIndex={minIndexRef.current}
                      items={priceOptions}
                      onChange={({ index, item }) => {
                        minIndexRef.current = index;
                        minValueRef.current = item.value;
                        if (index > maxIndexRef.current) {
                          maxIndexRef.current = index;
                          maxValueRef.current = item.value;
                          setPickerMountKey((key) => key + 1);
                        }
                      }}
                    />
                  </View>
                  <View style={styles.pricePickerCard}>
                    <Text style={styles.pickerLabel}>Maximum</Text>
                    <WheelPickerExpo
                      key={`max-${pickerMountKey}`}
                      height={132}
                      initialSelectedIndex={maxIndexRef.current}
                      items={priceOptions}
                      onChange={({ index, item }) => {
                        maxIndexRef.current = index;
                        maxValueRef.current = item.value;
                        if (index < minIndexRef.current) {
                          minIndexRef.current = index;
                          minValueRef.current = item.value;
                          setPickerMountKey((key) => key + 1);
                        }
                      }}
                    />
                  </View>
                </View>
              </View>

              <View style={[styles.filterSectionCard, styles.roomSectionCard]}>
                <Text style={styles.inputLabel}>Minimum rooms</Text>
                <View style={styles.roomPickerRow}>
                  <View style={[styles.roomPickerBlock, { zIndex: openBeds ? 3000 : 2000 }]}>
                    <Text style={styles.pickerLabel}>Bedrooms</Text>
                    <DropDownPicker
                      placeholder="Any beds"
                      open={openBeds}
                      value={filters.beds}
                      items={[0, 1, 2, 3, 4, 5].map((n) => ({ label: n === 0 ? 'Any' : `${n}+`, value: `${n}`, key: `beds-${n}` }))}
                      setOpen={setOpenBeds}
                      setValue={(cb) => updateFilters({ ...filters, beds: cb(filters.beds) })}
                      style={styles.dropdown}
                      dropDownContainerStyle={styles.dropdownMenu}
                      textStyle={styles.dropdownText}
                      placeholderStyle={styles.dropdownPlaceholder}
                      listMode="SCROLLVIEW"
                    />
                  </View>
                  <View style={[styles.roomPickerBlock, { zIndex: openBaths ? 3000 : 1000 }]}>
                    <Text style={styles.pickerLabel}>Bathrooms</Text>
                    <DropDownPicker
                      placeholder="Any baths"
                      open={openBaths}
                      value={filters.baths}
                      items={[0, 1, 2, 3, 4, 5].map((n) => ({ label: n === 0 ? 'Any' : `${n}+`, value: `${n}`, key: `baths-${n}` }))}
                      setOpen={setOpenBaths}
                      setValue={(cb) => updateFilters({ ...filters, baths: cb(filters.baths) })}
                      style={styles.dropdown}
                      dropDownContainerStyle={styles.dropdownMenu}
                      textStyle={styles.dropdownText}
                      placeholderStyle={styles.dropdownPlaceholder}
                      listMode="SCROLLVIEW"
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.resetBtn].filter(Boolean)} onPress={resetFilters}>
                <Ionicons name="refresh-outline" size={18} color="#475569" />
                <Text style={[styles.modalBtnText, styles.resetBtnText]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.applyBtn]}
                onPress={() => {
                  // Pull the exact values you see on the wheels
                  let nextMinIndex = Math.max(0, priceOptions.findIndex((o) => o.value === (minValueRef.current ?? filters.minPrice)));
                  let nextMaxIndex = priceOptions.findIndex((o) => o.value === (maxValueRef.current ?? filters.maxPrice));
                  if (nextMaxIndex < 0) nextMaxIndex = priceOptions.length - 1;
                  if (nextMinIndex > nextMaxIndex) nextMaxIndex = nextMinIndex;

                  const newMin = priceOptions[nextMinIndex]?.value ?? filters.minPrice;
                  const newMax = priceOptions[nextMaxIndex]?.value ?? filters.maxPrice;
                  const newFilters = { ...filters, minPrice: newMin, maxPrice: newMax };

                  // Persist & apply immediately with fresh values
                  updateFilters(newFilters);
                  setFilterModalVisible(false);
                  applyFilters(newFilters);
                }}
              >
                <Text style={styles.modalBtnText}>Show properties</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Banner Ad for Free Plan Users */}
      {shouldShowAd('search') && <AdBanner style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },

  // Toast
  toastWrap: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  toastText: { color: '#fff', fontWeight: '600', flex: 1 },
  toastClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  toastCloseText: { color: '#fff', fontSize: 12 },

  // Subscription Panel
  subscriptionPanel: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  subscriptionControls: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  subscriptionBtn: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  subscriptionBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  subscriptionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  subscriptionBtnActiveText: {
    color: '#fff',
  },
  subscriptionInfo: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  filterBtn: {
    position: 'absolute', top: 50, left: 20, zIndex: 10,
    backgroundColor: 'white', padding: 10, borderRadius: 20, elevation: 3
  },
  searchLocationPanel: {
    left: 20,
    position: 'absolute',
    right: 20,
    top: 104,
    zIndex: 12,
  },
  searchLocationCollapsedRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  searchLocationButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 4,
    flex: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  searchLocationButtonText: {
    color: '#111827',
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  currentLocationButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 4,
    height: 40,
    justifyContent: 'center',
    marginLeft: 8,
    width: 40,
  },
  searchLocationInputRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 5,
    flexDirection: 'row',
    minHeight: 46,
    paddingLeft: 13,
    paddingRight: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
  },
  searchLocationInput: {
    color: '#111827',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  searchLocationSubmit: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  searchLocationSubmitDisabled: {
    backgroundColor: '#A5B4FC',
  },
  searchLocationClose: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 34,
  },
  createDeckOuter: {
    position: 'absolute',
    right: 20,
    bottom: 34,
    zIndex: 10,
    borderRadius: 25,
    elevation: 7,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
    width: 112,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  createDeckRainbow: {
    position: 'absolute',
    width: 150,
    height: 150,
    backgroundColor: '#6366F1',
    borderRadius: 75,
    borderWidth: 38,
    borderTopColor: '#FF4D8D',
    borderRightColor: '#FACC15',
    borderBottomColor: '#22C55E',
    borderLeftColor: '#38BDF8',
  },
  createDeckBtn: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 23,
    flexDirection: 'row',
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 108,
  },
  createDeckBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 7,
  },
  createDeckIconWrap: {
    alignItems: 'center',
    backgroundColor: APP_PURPLE,
    borderRadius: 16,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  card: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: 'white', borderRadius: 12, padding: 12, elevation: 5,
    zIndex: 30,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingRight: 36,
    marginBottom: 8,
  },
  listingTypeBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  listingTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD84D',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  statusBadgeText: {
    color: '#2f2500',
    fontSize: 12,
    fontWeight: '800',
  },
  imageRow: { flexDirection: 'row', marginBottom: 8 },
  image: { width: 100, height: 80, marginRight: 8, borderRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '70%',
    overflow: 'visible',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 46,
  },
  filterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeFilterButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterSummaryPill: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterSummaryText: {
    color: '#3730A3',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  filterContent: {
    paddingBottom: 14,
  },
  filterSectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  roomSectionCard: {
    zIndex: 20,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionValueText: {
    color: APP_PURPLE,
    fontSize: 12,
    fontWeight: '900',
  },
  inputLabel: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  segmentedControl: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentButtonActive: {
    backgroundColor: APP_PURPLE,
    shadowColor: APP_PURPLE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  segmentButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  pricePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  pricePickerCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  roomPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roomPickerBlock: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    minHeight: 46,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 12,
  },
  dropdownText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
    fontWeight: '800',
  },
  modalButtons: {
    backgroundColor: '#F8FAFC',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  modalBtn: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  applyBtn: {
    backgroundColor: APP_PURPLE,
    flex: 1.45,
    shadowColor: APP_PURPLE,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  resetBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    flex: 1,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 8,
  },
  resetBtnText: {
    color: '#475569',
  },

  // Subscription Badge
  subscriptionBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  subscriptionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  }
})
