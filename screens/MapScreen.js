import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchListingsNearby } from '../services/realEstateApi';

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState(null);
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      const nearbyListings = await fetchListingsNearby(latitude, longitude);
      setListings(nearbyListings);
    };

    init();
  }, []);

  if (!userLocation) {
    return (
      <View style={styles.center}>
        <Text>Loading your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {listings.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{
              latitude: listing.latitude,
              longitude: listing.longitude,
            }}
            title={listing.title}
            pinColor={listing.type === 'sale' ? 'green' : 'blue'}
            onPress={() => setSelectedListing(listing)}
          />
        ))}
      </MapView>

      {selectedListing && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedListing.title}</Text>
          <Text>Type: {selectedListing.type}</Text>
          <TouchableOpacity onPress={() => setSelectedListing(null)}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  card: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  close: { marginTop: 8, color: 'blue' },
});
