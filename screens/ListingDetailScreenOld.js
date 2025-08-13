import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Dimensions,
} from 'react-native';

import { Modalize } from 'react-native-modalize';
import { BlurView } from 'expo-blur';
import MapView, { Marker } from 'react-native-maps';
import ImageViewing from 'react-native-image-viewing';
import { Ionicons } from '@expo/vector-icons';
import { getToken } from '../utils/tokenStorage'; 
import { API_BASE_URL, API_KEY } from '@env';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const modalRef = useRef(null);
  //const [favorite, setFavorite] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
   const [isFavorited, setIsFavorited] = useState(false);

  //console.log('Listing: ' +  JSON.stringify(listing))

    // 
useEffect(() => {
  const markAsViewed = async () => {
  
    const token = await getToken();
    await fetch(`${API_BASE_URL}/user-listings/status?listingId=${listing.ID}`, {
       headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-api-key':`${API_KEY}`,
          },
    }).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json(); // ✅ must return res.json()
    })
    .then(data => {
      //console.log('Parsed JSON:', data);
      setIsFavorited(data.isFavorited);
    })
    .catch(err => {
      console.error('Error in markAsViewed():', err);
    })
  }
    markAsViewed();
}, [listing.ID]);

 

const toggleFavorite = async () => {
 
  try {
    const token = await getToken();
    const newStatus = !isFavorited;
    setIsFavorited(newStatus);

    await fetch(`${API_BASE_URL}/user-listings/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
         'x-api-key':`${API_KEY}`,
      },
      body: JSON.stringify({ listingId: listing.ID, isFavorited: newStatus }),
    }).then((res)=> (res.status === 403) ? (console.error('Error toggling favorite:'),
    setIsFavorited(!newStatus)) : console.log('success'))


  } catch (err) {
    console.error('Error toggling favorite:', err);
    setIsFavorited(!newStatus); // rollback
  }
};

  useEffect(() => {
  modalRef.current?.open();
}, []);

  const openMap = () => {
    const url = `https://maps.google.com/?q=${listing.Latitude},${listing.Longitude}`;
    Linking.openURL(url);
  };

  const openDial = () => Linking.openURL(`tel:${listing.AgentPhone}`);
  const openMail = () => Linking.openURL(`mailto:${listing.AgentEmail}`);

  return (
    <View style={styles.backdropStyle}>
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      <Modalize
        ref={modalRef}
        modalHeight={800}
        handlePosition="inside"
        withHandle
        modalStyle={styles.modal}
        scrollViewProps={{ showsVerticalScrollIndicator: false }}
        onOverlayPress={() => navigation.goBack()}
        onClosed={() => navigation.goBack()}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero Image Carousel */}
          <View style={{ overflow: 'visible' }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
            >
              {listing.ImageUrls?.map((img, i) =>
              (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setLightboxIndex(i);
                    setLightboxVisible(true);
                  }}
                >
                  <Image source={{ uri: img }} style={styles.image} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteIcon}
            onPress={() => toggleFavorite()}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorited ? 'red' : 'white'}
            />
          </TouchableOpacity>

          {/* Title & Price */}
          <Text style={styles.title}>{listing.Title}</Text>
          <Text style={styles.price}>{listing.Price.toLocaleString()}</Text>

          {/* Metadata Row */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{listing.Beds} 🛏️</Text>
            <Text style={styles.metaText}>{listing.Baths} 🛁</Text>
            {listing.SquareFootage != '' ? <Text style={styles.metaText}>{listing.SquareFootage} sqft</Text> :<></>}
            {listing.Reception ? <Text style={styles.metaText}>Reception {listing.Reception}</Text> :<></>}
            <Text style={styles.metaText}>📍{listing.Postcode}</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{listing.Description}</Text>

          {/* Mini Map */}
          <TouchableOpacity onPress={openMap} style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={{
                latitude: listing.Latitude,
                longitude: listing.Longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              pointerEvents="none"
            >
              <Marker
                coordinate={{
                  latitude: listing.Latitude,
                  longitude: listing.Longitude,
                }}
              />
            </MapView>
            <Text style={styles.mapLabel}>Tap to open in Google Maps</Text>
          </TouchableOpacity>

          {/* Contact Buttons */}
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactBtn} onPress={openDial}>
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.contactText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={openMail}>
              <Ionicons name="mail" size={18} color="#fff" />
              <Text style={styles.contactText}>Email</Text>
            </TouchableOpacity>
          </View>

          {/* CTA Button */}
          <TouchableOpacity style={styles.cta}>
            <Text style={styles.ctaText}>Request Info / Book Viewing</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modalize>

      {/* Lightbox Viewer */}
      <ImageViewing
        images={listing.ImageUrls?.map((uri) => ({ uri }))}
        imageIndex={lightboxIndex}
        visible={lightboxVisible}
        onRequestClose={() => setLightboxVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  content: { paddingBottom: 100 },
  carousel: { height: 250 },
  image: {   width, height: 250, resizeMode: 'cover' },
  favoriteIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  title: { fontSize: 22, fontWeight: '600', marginTop: 16, marginHorizontal: 16 },
  price: { fontSize: 22, color: '#107AB0', marginHorizontal: 16, marginBottom: 16, marginTop: 8 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metaText: { fontSize: 16, color: '#666', fontWeight:'600' },
  description: { fontSize: 14, color: '#333', marginHorizontal: 16, marginBottom: 16 },
  mapContainer: { marginHorizontal: 16, marginBottom: 16 },
  map: { height: 150, borderRadius: 8 },
  mapLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  contactButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  contactBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: { color: '#fff', fontWeight: '600' },
  cta: {
    backgroundColor: '#222',
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 40,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backdropStyle : {
  flex: 1,
  backgroundColor: '#dffbee', // mint pastel
   //backgroundColor: '#f4e6e9', // pastel maroon/rose
}
});
