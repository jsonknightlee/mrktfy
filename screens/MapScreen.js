import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal,
  Switch, ScrollView, Animated, TouchableWithoutFeedback
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
import { api } from '../services/api';

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
const TOAST_DURATION_MS = 20000; // 20s

const TYPE_RENT = 'to-rent';
const TYPE_SALE = 'for-sale';

const PIN_COLORS = {
  [TYPE_RENT]: '#32CD32',
  [TYPE_SALE]: undefined,
};

const prettyType = (t) => (t === TYPE_RENT ? 'RENTAL' : 'FOR SALE');

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

  // Wheel state (we avoid re-render during scroll)
  const minIndexRef = useRef(0);
  const maxIndexRef = useRef(0);
  const minValueRef = useRef('0');        // ← track exact selected VALUE
  const maxValueRef = useRef('400000');   // ← track exact selected VALUE
  const [pickerMountKey, setPickerMountKey] = useState(0);

  // Animations & refs
  const [badgeAnim] = useState(new Animated.Value(200));
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
  const { currentTier, getMaxSearchRadius, plans, mockSubscription } = useSubscription();
  const navigation = useNavigation();

  const priceOptions = useMemo(() => {
    const step = isRental ? 100 : 100000;
    const max = isRental ? 5000 : 900000;
    const arr = [];
    for (let i = 0; i <= max; i += step) {
      arr.push({ label: `£${i.toLocaleString()}`, value: i.toString() });
    }
    if (!isRental) arr.push({ label: '£1,000,000+', value: '1000001' });
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

  // fetch listings by type
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });

      try {
        const searchRadius = getMaxSearchRadius();
        console.log(`🔍 Using search radius: ${searchRadius}km for ${currentTier} tier`);
        const nearby = await fetchNearbyListings(latitude, longitude, searchRadius, isRental ? TYPE_RENT : TYPE_SALE);
        setListings(nearby);
        
        // If no listings found, fallback to London but keep user's GPS location
        if (nearby.length === 0) {
          console.log(' No listings found at current location, falling back to London...');
          const londonNearby = await fetchNearbyListings(51.5074, -0.1278, searchRadius, isRental ? TYPE_RENT : TYPE_SALE);
          setListings(londonNearby);
          // Don't change userLocation - keep GPS location for the circle
          console.log(' Using London listings, found:', londonNearby.length, 'listings');
        }
      } catch (err) {
        console.error('Failed to fetch listings:', err);
        // Fallback to London on error too
        try {
          const searchRadius = getMaxSearchRadius();
          const londonNearby = await fetchNearbyListings(51.5074, -0.1278, searchRadius, isRental ? TYPE_RENT : TYPE_SALE);
          setListings(londonNearby);
          // Don't change userLocation - keep GPS location for the circle
          console.log(' Error fallback to London, found:', londonNearby.length, 'listings');
        } catch (fallbackErr) {
          console.error('London fallback also failed:', fallbackErr);
        }
      }
    })();
  }, [isRental, currentTier]);

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

  useEffect(() => {
    if (selectedListing) {
      Animated.timing(badgeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => { isInteractingWithMarker.current = false; }, 400);
    }
  }, [selectedListing]);

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
        <Animated.View style={[styles.toastWrap, { transform: [{ translateY: toastY }] }]} >
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

      {/* Subscription Tier Panel */}
      <View style={styles.subscriptionPanel}>
        <Text style={styles.subscriptionTitle}>Current Plan: {plans[currentTier]?.name || 'Free'}</Text>
        <View style={styles.subscriptionControls}>
          {Object.keys(plans).map((tierId) => {
            const tier = plans[tierId];
            // Show all tiers for testing, including unavailable ones
            return (
              <TouchableOpacity
                key={tierId}
                style={[
                  styles.subscriptionBtn,
                  currentTier === tierId && styles.subscriptionBtnActive
                ]}
                onPress={() => {
                  mockSubscription(tierId);
                  showToast(`Switched to ${tier.name} plan (${getMaxSearchRadius()}km radius)`);
                }}
              >
                <Text style={[
                  styles.subscriptionBtnText,
                  currentTier === tierId && styles.subscriptionBtnActiveText
                ]}>
                  {tier.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.subscriptionInfo}>
          Search Radius: {getMaxSearchRadius()}km • {listings.length} properties found
        </Text>
      </View>

      {mapVisible && (
        <MapView
          style={styles.map}
          showsUserLocation
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
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
          {userLocation && (
            <Circle
              center={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
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
              pinColor={
                PIN_COLORS[
                  (listing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase()
                ]
              }
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

          {/* Rental/Sale label */}
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <Text
              style={{
                fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4,
                borderRadius: 10, overflow: 'hidden',
                backgroundColor:
                  (selectedListing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase() === TYPE_RENT
                    ? '#b7f397'
                    : '#e6e6e6',
              }}
            >
              {prettyType((selectedListing.ListingType || (isRental ? TYPE_RENT : TYPE_SALE)).toString().toLowerCase())}
            </Text>
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

          <TouchableOpacity onPress={() => navigation.navigate('ListingDetail', { listing: selectedListing })} activeOpacity={0.8}>
            <Text style={styles.cardTitle}>{selectedListing.Title}</Text>

            {/* Price + Heart */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Price: {selectedListing.Price}</Text>
              <TouchableOpacity onPress={() => toggleFavorite(selectedListing.ID)}>
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
      <Modal animationType="slide" transparent visible={filterModalVisible}>
        <View style={styles.modalOverlay}>
          <View className="filterModal" style={styles.filterModal}>
            <Text style={styles.modalTitle}>Filter Listings</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Property Type:</Text>
              <Text style={styles.switchLabel}>{isRental ? 'Rental' : 'Sale'}</Text>
              <Switch value={isRental} onValueChange={handleToggleType} />
            </View>

            <Text style={styles.inputLabel}>Min Price (£)</Text>
            <WheelPickerExpo
              key={`min-${pickerMountKey}`}
              height={150}
              initialSelectedIndex={minIndexRef.current}
              items={priceOptions}
              onChange={({ index, item }) => {
                minIndexRef.current = index;
                minValueRef.current = item.value; // ← keep actual value
              }}
            />

            <Text style={styles.inputLabel}>Max Price (£)</Text>
            <WheelPickerExpo
              key={`max-${pickerMountKey}`}
              height={150}
              initialSelectedIndex={maxIndexRef.current}
              items={priceOptions}
              onChange={({ index, item }) => {
                maxIndexRef.current = index;
                maxValueRef.current = item.value; // ← keep actual value
              }}
            />

            <Text style={styles.inputLabel}>Min Beds</Text>
            <DropDownPicker
              placeholder="Select Minimum Beds"
              open={openBeds}
              value={filters.beds}
              items={[0, 1, 2, 3, 4, 5].map((n) => ({ label: `${n}`, value: `${n}` }))}
              setOpen={setOpenBeds}
              setValue={(cb) => updateFilters({ ...filters, beds: cb(filters.beds) })}
            />

            <Text style={styles.inputLabel}>Min Baths</Text>
            <DropDownPicker
              placeholder="Select Minimum Baths"
              open={openBaths}
              value={filters.baths}
              items={[0, 1, 2, 3, 4, 5].map((n) => ({ label: `${n}`, value: `${n}` }))}
              setOpen={setOpenBaths}
              setValue={(cb) => updateFilters({ ...filters, baths: cb(filters.baths) })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => {
                  // Pull the exact values you see on the wheels
                  const newMin = minValueRef.current ?? filters.minPrice;
                  const newMax = maxValueRef.current ?? filters.maxPrice;
                  const newFilters = { ...filters, minPrice: newMin, maxPrice: newMax };

                  // Persist & apply immediately with fresh values
                  updateFilters(newFilters);
                  setFilterModalVisible(false);
                  applyFilters(newFilters);
                }}
              >
                <Text style={styles.modalBtnText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.resetBtn]} onPress={resetFilters}>
                <Text style={styles.modalBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  card: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: 'white', borderRadius: 12, padding: 12, elevation: 5,
    zIndex: 30,
  },
  imageRow: { flexDirection: 'row', marginBottom: 8 },
  image: { width: 100, height: 80, marginRight: 8, borderRadius: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start' },
  filterModal: {
    flexGrow: 1, backgroundColor: 'white', padding: 20, paddingTop: 60,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  inputLabel: { fontWeight: '600', marginTop: 10, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  modalBtn: {
    backgroundColor: '#007AFF', padding: 12, borderRadius: 8,
    flex: 1, alignItems: 'center', marginRight: 10
  },
  resetBtn: { backgroundColor: '#FF3B30', marginRight: 0, marginLeft: 10 },
  modalBtnText: { color: 'white', fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  switchLabel: { fontSize: 14, fontWeight: '500' }
});