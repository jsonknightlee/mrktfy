import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { getBearing, getDistance } from '../utils/geoUtils';
import { fetchNearbyListings } from '../services/realEstateApi';

const REFRESH_DISTANCE_METERS = 50;
const REFRESH_INTERVAL_MS = 30000;

export default function ARScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchTimeRef = useRef(0);
  const lastLocationRef = useRef(null);

  // Get user location and auto-refresh listings
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      lastLocationRef.current = loc.coords;
      await fetchAndSetListings(loc.coords);
    })();

    const watchId = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20 },
      async (locUpdate) => {
        const now = Date.now();
        const last = lastLocationRef.current;
        const distance = getDistance(
          last.latitude,
          last.longitude,
          locUpdate.coords.latitude,
          locUpdate.coords.longitude
        );

        const timeSinceLastFetch = now - lastFetchTimeRef.current;

        if (distance > REFRESH_DISTANCE_METERS || timeSinceLastFetch > REFRESH_INTERVAL_MS) {
          setLocation(locUpdate.coords);
          lastLocationRef.current = locUpdate.coords;
          await fetchAndSetListings(locUpdate.coords);
        }
      }
    );

    return () => {
      watchId.then((sub) => sub.remove());
    };
  }, []);

  const fetchAndSetListings = async (coords) => {
    setLoading(true);
    const nearby = await fetchNearbyListings(coords.latitude, coords.longitude);
    setListings(nearby);
    lastFetchTimeRef.current = Date.now();
    setLoading(false);
  };

  // Get heading from magnetometer
  useEffect(() => {
    const sub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setHeading(angle);
    });

    Magnetometer.setUpdateInterval(500);
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

  const visibleListings = listings
    .map((listing) => {
      const bearing = getBearing(location.latitude, location.longitude, listing.latitude, listing.longitude);
      const diff = Math.abs(bearing - heading);
      const withinView = diff < 30 || diff > 330;
      const distance = getDistance(location.latitude, location.longitude, listing.latitude, listing.longitude);
      return { ...listing, distance, bearing, visible: withinView };
    })
    .filter((item) => item.visible);

  return (
    <View style={{ flex: 1 }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back">
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {!loading &&
          visibleListings.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.tokenBubble,
                { top: 100 + idx * 120, left: 50 + (idx % 2) * 120 },
              ]}
            >
              <Text style={styles.tokenTitle}>{item.title || 'Listing'}</Text>
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
              )}
              {item.squareFootage && (
                <Text style={styles.details}>{item.squareFootage} sq ft</Text>
              )}
              <Text style={styles.details}>
                {item.distance.toFixed(0)}m • {item.bearing.toFixed(0)}°
              </Text>
            </View>
          ))}
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
  tokenBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    borderRadius: 12,
    width: 180,
    elevation: 5,
  },
  tokenTitle: { fontWeight: 'bold', fontSize: 14 },
  details: { fontSize: 12, color: '#333' },
  image: {
    width: '100%',
    height: 80,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
});
