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
import { useFavorites } from '../contexts/FavoritesContext';

const { width } = Dimensions.get('window');
const MODAL_HEIGHT = Dimensions.get("window").height * 0.9;


export default function ListingDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const modalRef = useRef(null);
  //const [favorite, setFavorite] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { toggleFavorite, getFavoriteStatus, setLastViewed } = useFavorites();
  const isFavorited = getFavoriteStatus(listing.ID)?.isFavorited ?? !!route.params.listing?.isFavorited;
  const favoriteStatus = getFavoriteStatus(listing.ID);
  const lastViewedAt = favoriteStatus?.lastViewedAt;


console.log('Fav: '+ JSON.stringify(listing))

const normalizeImageUrls = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return [];

    // JSON array string
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        // fall through
      }
    }

    // delimited or single URL
    return s.split(/[,|;]+/).map(x => x.trim()).filter(Boolean);
  }

  return [];
};

const imageUrls = normalizeImageUrls(listing.ImageUrls ?? listing.imageUrls ?? listing.imageUrl);

  

useEffect(() => {
  modalRef.current?.open();
  setLastViewed(listing.ID); // 👈 if you want to record the view here too
}, []);

  const openMap = () => {
    const url = `https://maps.google.com/?q=${listing.Latitude},${listing.Longitude}`;
    Linking.openURL(url);
  };

  const openDial = () => Linking.openURL(`tel:${listing.AgentPhone}`);
  const openMail = () => Linking.openURL(`mailto:${listing.AgentEmail}`);

  return (
    <View style={styles.backdropStyle}>
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" pointerEvents="none" />
      <Modalize
  ref={modalRef}
  modalHeight={800}
  handlePosition="inside"
  withHandle
  modalStyle={styles.modal}
  onOverlayPress={() => navigation.goBack()}
  onClosed={() => navigation.goBack()}
  flatListProps={{
    data: [listing.ID], // single row forces FlatList scroll engine
    keyExtractor: (id) => String(id),
    nestedScrollEnabled: true,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: styles.content,
    renderItem: () => (
      <View>
        {/* --- CAROUSEL (swap to FlatList horizontal for Android stability) --- */}
        <View style={{ overflow: "visible" }}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          >
            {imageUrls?.map((img, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.9}
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
          onPress={() => toggleFavorite(listing.ID)}
        >
          <Ionicons
            name={isFavorited ? "heart" : "heart-outline"}
            size={28}
            color={isFavorited ? "red" : "white"}
          />
        </TouchableOpacity>

        {/* Title & Price */}
        <Text style={styles.title}>{listing.Title}</Text>
        <Text style={styles.price}>{listing.Price.toLocaleString()}</Text>

        {/* Metadata Row */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{listing.Beds} 🛏️</Text>
          <Text style={styles.metaText}>{listing.Baths} 🛁</Text>
          {listing.SquareFootage !== "" ? (
            <Text style={styles.metaText}>{listing.SquareFootage} sqft</Text>
          ) : null}
          {listing.Reception ? (
            <Text style={styles.metaText}>Reception {listing.Reception}</Text>
          ) : null}
          <Text style={styles.metaText}>📍{listing.Postcode}</Text>
        </View>

        {lastViewedAt ? (
          <Text style={{ fontSize: 12, color: "#888", marginLeft: 16, marginBottom: 10 }}>
            Last viewed: {new Date(lastViewedAt).toLocaleDateString()}
          </Text>
        ) : null}

        <Text style={styles.description}>{listing.Description}</Text>

        {/* Mini Map */}
        <TouchableOpacity onPress={openMap} style={styles.mapContainer} activeOpacity={0.9}>
          <View pointerEvents="none">
            <MapView
              style={styles.map}
              region={{
                latitude: listing.Latitude,
                longitude: listing.Longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              pointerEvents="none"
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={{ latitude: listing.Latitude, longitude: listing.Longitude }} />
            </MapView>
          </View>
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

        <TouchableOpacity style={styles.cta}>
          <Text style={styles.ctaText}>Request Info / Book Viewing</Text>
        </TouchableOpacity>
      </View>
    ),
  }}
/>

      {/* Lightbox Viewer */}
      <ImageViewing
        images={imageUrls?.map((uri) => ({ uri }))}
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
