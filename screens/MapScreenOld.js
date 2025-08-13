import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchNearbyListings } from '../services/realEstateApi';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState(null);
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const navigation = useNavigation();
  const [mapVisible, setMapVisible] = useState(false);

useEffect(() => {
  if (listings.length > 0) {
    setTimeout(() => setMapVisible(true), 100); // slight delay for smoother load
  }
}, [listings]);
  
  useEffect(() => {
    const fetchInitialLocationAndListings = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      try {
        const nearbyListings = await fetchNearbyListings(latitude, longitude);
        // Convert stringified ImageUrls into real arrays

        //console.log('RAW LISTINGS RESPONSE:', nearbyListings);
        setListings(nearbyListings);
      } catch (err) {
        console.error('Failed to fetch listings:', err);
      }
    };

    fetchInitialLocationAndListings();
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
      {mapVisible && <MapView
        style={styles.map}
        showsUserLocation
        region={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        // Don't listen to region changes for now
        onRegionChangeComplete={() => {}}
      >
        {listings.map((listing) => 
        (
          <Marker
            key={listing.ID}
            coordinate={{
              latitude: listing.Latitude,
              longitude: listing.Longitude,
            }}
            title={listing.Title}
            pinColor="red"
            onPress={() => setSelectedListing(listing)}
          />
        ))}
      </MapView>}

      {selectedListing && (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ListingDetail', { listing: selectedListing })}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
            {selectedListing.ImageUrls?.map((imgUrl, idx) => (
              <Image
                key={idx}
                source={{ uri: imgUrl }}
                style={styles.image}
              />
            ))}
          </ScrollView>
          <Text style={styles.cardTitle}>{selectedListing.Title}</Text>
          <Text>Price: {selectedListing.Price}</Text>
        </TouchableOpacity>
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
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  imageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  image: {
    width: 100,
    height: 80,
    marginRight: 8,
    borderRadius: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  close: { marginTop: 8, color: 'blue' },
});
