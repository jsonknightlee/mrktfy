// ARScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { useNavigation } from '@react-navigation/native';
import { getBearing, getDistance } from '../utils/geoUtils';
import { fetchNearbyListings } from '../services/realEstateApi';

const REFRESH_DISTANCE_METERS = 50;
const REFRESH_INTERVAL_MS = 30000;

// ---- Instant Listing Tuning ----
const MAX_DISTANCE_M = 350;       // how far to consider listings
const CONE_HALF_ANGLE_DEG = 18;   // +/- degrees from heading considered "in front"
const HEADING_ALPHA = 0.22;       // smoothing factor (0.15 smoother, 0.3 snappier)
const MAG_UPDATE_MS = 200;        // magnetometer update interval

// --- helpers ---
const angleDiff = (a, b) => {
  // smallest signed diff between angles a and b (degrees)
  return ((a - b + 540) % 360) - 180; // -180..180
};

const smoothHeading = (prev, next, alpha = 0.2) => {
  if (prev == null) return next;
  const d = angleDiff(next, prev); // signed diff
  return (prev + d * alpha + 360) % 360;
};

const pickInstantListing = ({
  userLat,
  userLon,
  headingDeg,
  listings,
  maxDistanceM = MAX_DISTANCE_M,
  coneHalfAngleDeg = CONE_HALF_ANGLE_DEG,
}) => {
  if (!Number.isFinite(userLat) || !Number.isFinite(userLon) || headingDeg == null) return null;
  if (!Array.isArray(listings) || listings.length === 0) return null;

  let best = null;
  let bestScore = Infinity;

  for (const listing of listings) {
    const lat = listing.latitude ?? listing.Latitude;
    const lon = listing.longitude ?? listing.Longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const bearing = getBearing(userLat, userLon, lat, lon);
    const off = Math.abs(angleDiff(bearing, headingDeg));
    if (off > coneHalfAngleDeg) continue;

    const distance = getDistance(userLat, userLon, lat, lon);
    if (!Number.isFinite(distance) || distance > maxDistanceM) continue;

    // score: prioritize centeredness, then distance
    const score = off * 4 + distance * 0.02;

    if (score < bestScore) {
      bestScore = score;
      best = { ...listing, distance, bearing, off, score };
    }
  }

  return best;
};

export default function ARScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();

  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const lastFetchTimeRef = useRef(0);
  const lastLocationRef = useRef(null);

  // Convert AR listing (mixed keys) into shape ListingDetailScreen expects
  const normalizeForDetail = (l) => {
    const priceRaw = l.price ?? l.Price ?? l.rent ?? l.listPrice ?? l.ListPrice;
    const price =
      typeof priceRaw === 'number'
        ? priceRaw
        : typeof priceRaw === 'string'
        ? priceRaw
        : priceRaw != null
        ? String(priceRaw)
        : null;

    // best-effort images
    const imgs =
      Array.isArray(l.imageUrls) ? l.imageUrls :
      l.imageUrl ? [l.imageUrl] :
      Array.isArray(l.ImageUrls) ? l.ImageUrls :
      [];

    return {
      ID: l.id ?? l.ID,
      Title: l.title ?? l.Title ?? 'Listing',
      Price: price ?? '£—',
      Latitude: l.latitude ?? l.Latitude,
      Longitude: l.longitude ?? l.Longitude,
      ListingType: (l.listingType ?? l.ListingType ?? '').toString().toLowerCase(),
      ImageUrls: imgs,
      Beds: l.beds ?? l.Beds,
      Baths: l.baths ?? l.Baths,
      SquareFootage: l.squareFootage ?? l.SquareFootage ?? '',
      Postcode: l.postcode ?? l.Postcode ?? '',
      Description: l.description ?? l.Description ?? '',
      AgentPhone: l.agentPhone ?? l.AgentPhone ?? '',
      AgentEmail: l.agentEmail ?? l.AgentEmail ?? '',
    };
  };

  // Get user location and auto-refresh listings
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      if (!isMounted) return;

      setLocation(loc.coords);
      lastLocationRef.current = loc.coords;
      await fetchAndSetListings(loc.coords);
    })();

    const watchPromise = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20 },
      async (locUpdate) => {
        const now = Date.now();
        const last = lastLocationRef.current;
        if (!last) {
          lastLocationRef.current = locUpdate.coords;
          return;
        }

        const distanceMoved = getDistance(
          last.latitude,
          last.longitude,
          locUpdate.coords.latitude,
          locUpdate.coords.longitude
        );

        const timeSinceLastFetch = now - lastFetchTimeRef.current;

        if (distanceMoved > REFRESH_DISTANCE_METERS || timeSinceLastFetch > REFRESH_INTERVAL_MS) {
          if (!isMounted) return;
          setLocation(locUpdate.coords);
          lastLocationRef.current = locUpdate.coords;
          await fetchAndSetListings(locUpdate.coords);
        }
      }
    );

    return () => {
      isMounted = false;
      watchPromise.then((sub) => sub.remove());
    };
  }, []);

  const fetchAndSetListings = async (coords) => {
    try {
      setLoading(true);
      const nearby = await fetchNearbyListings(coords.latitude, coords.longitude);
      setListings(Array.isArray(nearby) ? nearby : []);
      lastFetchTimeRef.current = Date.now();
    } catch (e) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  // Get heading from magnetometer (smoothed)
  useEffect(() => {
    const sub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setHeading((prev) => smoothHeading(prev, angle, HEADING_ALPHA));
    });

    Magnetometer.setUpdateInterval(MAG_UPDATE_MS);
    return () => sub.remove();
  }, []);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission needed</Text>
        <Text onPress={requestPermission} style={styles.link}>Grant access</Text>
      </View>
    );
  }

  if (!location || heading === null) {
    return (
      <View style={styles.center}>
        <Text>Loading location & heading...</Text>
      </View>
    );
  }

  const instant = pickInstantListing({
    userLat: location.latitude,
    userLon: location.longitude,
    headingDeg: heading,
    listings,
    maxDistanceM: MAX_DISTANCE_M,
    coneHalfAngleDeg: CONE_HALF_ANGLE_DEG,
  });

  const instantTitle = instant?.title ?? instant?.Title ?? 'Listing';
  const instantImage =
    instant?.imageUrl ||
    (Array.isArray(instant?.imageUrls) ? instant.imageUrls[0] : null) ||
    (Array.isArray(instant?.ImageUrls) ? instant.ImageUrls[0] : null);

  const instantBeds = instant?.beds ?? instant?.Beds;
  const instantPrice = instant?.price ?? instant?.Price ?? instant?.rent ?? instant?.listPrice ?? instant?.ListPrice;

  return (
    <View style={{ flex: 1 }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back">
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {!loading && instant && (
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.instantCard}
            onPress={() => navigation.navigate('ListingDetail', { listing: normalizeForDetail(instant) })}
          >
            <Text style={styles.instantTitle} numberOfLines={1}>
              {instantTitle}
            </Text>

            {!!instantImage && (
              <Image source={{ uri: instantImage }} style={styles.instantImage} />
            )}

            <Text style={styles.instantMeta} numberOfLines={1}>
              {instantPrice != null ? `${String(instantPrice)}` : '£—'}
              {instantBeds ? ` • ${instantBeds} bed` : ''}
            </Text>

            {/* Debug info (keep for tuning, remove later) */}
            <Text style={styles.instantMetaSmall} numberOfLines={1}>
              {Math.round(instant.distance)}m • off {instant.off.toFixed(1)}° • bearing {instant.bearing.toFixed(0)}°
            </Text>

            <Text style={styles.instantHint}>Tap to open Instant Listing</Text>
          </TouchableOpacity>
        )}

        {!loading && !instant && (
          <View style={styles.noTarget}>
            <Text style={styles.noTargetText}>No listing in view — pan left/right</Text>
            <Text style={styles.noTargetSub}>Heading: {heading.toFixed(0)}°</Text>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  link: { color: 'blue', marginTop: 10 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Instant Listing Overlay
  instantCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 28,
    backgroundColor: 'rgba(0,0,0,0.70)',
    borderRadius: 16,
    padding: 12,
  },
  instantTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  instantMeta: {
    color: '#fff',
    opacity: 0.92,
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  instantMetaSmall: {
    color: '#fff',
    opacity: 0.75,
    marginTop: 4,
    fontSize: 12,
  },
  instantHint: {
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  instantImage: {
    width: '100%',
    height: 120,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  noTarget: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  noTargetText: { color: '#fff', fontWeight: '700' },
  noTargetSub: { color: '#fff', opacity: 0.75, marginTop: 4 },
});
