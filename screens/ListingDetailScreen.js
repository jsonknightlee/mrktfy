import React, { useState, useEffect, useRef } from 'react';
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
import { useSubscription } from '../contexts/SubscriptionContext';
import { AdBanner } from '../services/adService';
import VirtualTourModal from '../components/VirtualTourModal';
import PropertyTimeline from '../components/PropertyTimeline';
import CollapsibleInfoSection from '../components/CollapsibleInfoSection';
import AdModal from '../components/AdModal';

const { width } = Dimensions.get('window');
const MODAL_HEIGHT = Dimensions.get("window").height * 0.9;

const getStatusTag = (listing) => {
  const status = listing?.Status ?? listing?.status;
  if (typeof status !== 'string') return null;

  const trimmed = status.trim();
  return trimmed.length ? trimmed : null;
};

export default function ListingDetailScreen({ route, navigation }) {
  const { listing } = route.params;
  const modalRef = useRef(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Use ONLY live data from listing - no mock data fallbacks
  const timeline = listing.PropertyTimeline;
  const schools = listing.Schools;
  const stations = listing.Stations;
  const additionalInfo = listing.AdditionalInfo;

  // Defensive checks to ensure data is valid
  const safeTimeline = timeline && (typeof timeline === 'string' || Array.isArray(timeline)) ? timeline : null;
  const safeSchools = schools && Array.isArray(schools) ? schools : null;
  const safeStations = stations && Array.isArray(stations) ? stations : null;
  const safeAdditionalInfo = additionalInfo && (typeof additionalInfo === 'string' || typeof additionalInfo === 'object') ? additionalInfo : null;

  const [virtualTourModalVisible, setVirtualTourModalVisible] = useState(false);
  const [floorPlanModalVisible, setFloorPlanModalVisible] = useState(false);
  const { toggleFavorite, getFavoriteStatus, setLastViewed } = useFavorites();
  const { currentTier, shouldShowAd } = useSubscription();
  const isFavorited = getFavoriteStatus(listing.ID)?.isFavorited ?? !!route.params.listing?.isFavorited;
  const lastViewedAt = getFavoriteStatus(listing.ID)?.lastViewedAt;

  // Ad modal state
  const [adModalVisible, setAdModalVisible] = useState(false);
  const adShownRef = useRef(false);

  // Show ad modal for Free plan users when screen loads (only once per session)
  useEffect(() => {
    if (shouldShowAd('property_open') && !adShownRef.current) {
      adShownRef.current = true;
      // Small delay to ensure screen is fully loaded
      const timer = setTimeout(() => {
        setAdModalVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array - only run once on mount

  const handleAdUpgrade = () => {
    setAdModalVisible(false);
    navigation.navigate('Subscription');
  };


// console.log('Fav: '+ JSON.stringify(listing))
// console.log('🏠 Listing data fields:', {
//   hasPropertyTimeline: !!(listing.PropertyTimeline),
//   propertyTimelineLength: listing.PropertyTimeline?.length,
//   hasSchools: !!(listing.Schools),
//   schoolsLength: listing.Schools?.length,
//   hasStations: !!(listing.Stations),
//   stationsLength: listing.Stations?.length,
//   hasAdditionalInfo: !!(listing.AdditionalInfo),
//   additionalInfoLength: listing.AdditionalInfo?.length,
// });

const normalizeImageUrls = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) {
    console.log('🖼️ normalizeImageUrls - Array input:', val.slice(0, 3)); // Debug first 3
    return val.filter(Boolean);
  }

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return [];

    // JSON array string
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        console.log('🖼️ normalizeImageUrls - Parsed JSON:', parsed.slice(0, 3)); // Debug first 3
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        // fall through
      }
    }

    // delimited or single URL
    const result = s.split(/[,|;]+/).map(x => x.trim()).filter(Boolean);
    console.log('🖼️ normalizeImageUrls - Split result:', result.slice(0, 3)); // Debug first 3
    return result;
  }

  return [];
};

  const imageUrls = normalizeImageUrls(listing.ImageUrls ?? listing.imageUrls ?? listing.imageUrl);

useEffect(() => {
  console.log('🖼️ Final imageUrls for listing', listing.ID, ':', imageUrls.slice(0, 5)); // Debug first 5
  modalRef.current?.open();
  setLastViewed(listing.ID); // 👈 if you want to record the view here too
}, []);

  const openMap = () => {
    const url = `https://maps.google.com/?q=${listing.Latitude},${listing.Longitude}`;
    Linking.openURL(url);
  };

  const openDial = () => Linking.openURL(`tel:${listing.AgentPhone}`);
  const openMail = () => Linking.openURL(`mailto:${listing.AgentEmail}`);

  const generateVirtualTourUrl = () => {
    if (!listing.ListingURL) return null;
    const baseUrl = listing.ListingURL.split('?')[0];
    return `${baseUrl}?console=open&tab=virtual_tours`;
  };

  const generateFloorPlanUrl = () => {
    if (!listing.ListingURL) return null;
    const baseUrl = listing.ListingURL.split('?')[0];
    return `${baseUrl}?console=open&tab=floor_plans`;
  };

  const openVirtualTour = () => {
    const url = generateVirtualTourUrl();
    if (url) {
      setVirtualTourModalVisible(true);
    }
  };

  const openFloorPlan = () => {
    const url = generateFloorPlanUrl();
    if (url) {
      setFloorPlanModalVisible(true);
    }
  };

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
        <Text style={styles.title}>{String(listing.Title || '')}</Text>
        <Text style={styles.price}>
          {typeof listing.Price === 'number' ? listing.Price.toLocaleString() : String(listing.Price || '')}
        </Text>
        {(() => {
          const statusTag = getStatusTag(listing);
          return statusTag ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusTag}</Text>
            </View>
          ) : null;
        })()}

        {/* Metadata Row */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{String(listing.Beds || '')} beds</Text>
          <Text style={styles.metaText}>{String(listing.Baths || '')} baths</Text>
          {listing.SquareFootage !== "" ? (
            <Text style={styles.metaText}>{String(listing.SquareFootage)} sqft</Text>
          ) : null}
          {listing.Reception ? (
            <Text style={styles.metaText}>Reception {String(listing.Reception)}</Text>
          ) : null}
          <Text style={styles.metaText}>{String(listing.Postcode || '')}</Text>
        </View>

        {lastViewedAt ? (
          <Text style={{ fontSize: 12, color: "#888", marginLeft: 16, marginBottom: 10 }}>
            Last viewed: {new Date(lastViewedAt).toLocaleDateString()}
          </Text>
        ) : null}

        <Text style={styles.description}>{String(listing.Description || '')}</Text>

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

        {/* Virtual Tour & Floor Plan Buttons */}
        {((listing.VirtualTours && listing.VirtualTours > 0) || (listing.FloorPlans && listing.FloorPlans > 0)) && (
          <View style={styles.tourButtonsContainer}>
            {listing.VirtualTours && listing.VirtualTours > 0 && (
              <TouchableOpacity style={styles.tourButton} onPress={openVirtualTour}>
                <Ionicons name="play-circle" size={20} color="#fff" />
                <Text style={styles.tourButtonText}>Virtual Tour</Text>
              </TouchableOpacity>
            )}
            {listing.FloorPlans && listing.FloorPlans > 0 && (
              <TouchableOpacity style={styles.tourButton} onPress={openFloorPlan}>
                <Ionicons name="business" size={20} color="#fff" />
                <Text style={styles.tourButtonText}>Floor Plan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

        {/* New Information Sections - Only show if data exists */}
        {safeTimeline && (typeof safeTimeline === 'string' || safeTimeline.length > 0) && (
          <PropertyTimeline timeline={safeTimeline} />
        )}

        {safeSchools && safeSchools.length > 0 && (
          <CollapsibleInfoSection
            title="Nearby Schools"
            icon="school"
            data={safeSchools}
          />
        )}

        {safeStations && safeStations.length > 0 && (
          <CollapsibleInfoSection
            title="Nearby Stations"
            icon="train"
            data={safeStations}
          />
        )}

        {safeAdditionalInfo && (typeof safeAdditionalInfo === 'string' || Object.keys(safeAdditionalInfo).length > 0) && (
          <CollapsibleInfoSection
            title="Additional Information"
            icon="information-circle"
            data={safeAdditionalInfo}
          />
        )}

        {/* Spacing before CTA */}
        <View style={styles.sectionSpacing} />

        <TouchableOpacity style={styles.cta}>
          <Text style={styles.ctaText}>Request Info / Book Viewing</Text>
        </TouchableOpacity>

        {/* Ref ID for development */}
        <View style={styles.refIdContainer}>
          <Text style={styles.refIdText}>Ref ID: {listing.ZooplaID || listing.ID}</Text>
        </View>

        {/* Banner Ad for Free Plan Users */}
        {shouldShowAd('property_open') && <AdBanner style={{ marginHorizontal: 16, marginBottom: 10 }} />}
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
      {/* Virtual Tour Modal */}
      <VirtualTourModal
        visible={virtualTourModalVisible}
        onClose={() => setVirtualTourModalVisible(false)}
        url={generateVirtualTourUrl()}
        title="Virtual Tour"
      />

      {/* Floor Plan Modal */}
      <VirtualTourModal
        visible={floorPlanModalVisible}
        onClose={() => setFloorPlanModalVisible(false)}
        url={generateFloorPlanUrl()}
        title="Floor Plan"
      />

      {/* Ad Modal for Free Plan Users */}
      {adModalVisible && (
        <AdModal
          visible={adModalVisible}
          onClose={() => setAdModalVisible(false)}
          onUpgrade={handleAdUpgrade}
        />
      )}
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
  price: { fontSize: 22, color: '#107AB0', marginHorizontal: 16, marginBottom: 8, marginTop: 8 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD84D',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: '#2f2500',
    fontSize: 12,
    fontWeight: '800',
  },
  mockDataIndicator: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mockDataIndicatorText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
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
  sectionSpacing: {
    height: 20,
  },
  refIdContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  refIdText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  tourButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tourButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  tourButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  backdropStyle : {
  flex: 1,
  backgroundColor: '#dffbee', // mint pastel
   //backgroundColor: '#f4e6e9', // pastel maroon/rose
}
});
