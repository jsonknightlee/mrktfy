import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationListingsScreen({ route }) {
  const { notification } = route.params;
  const navigation = useNavigation();
  const { toggleFavorite, getFavoriteStatus } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const listings = notification.listings || [];

  // Debug: Log image data
  console.log('🖼️ Notification listings image data:', listings.map(l => ({
    id: l.ID,
    hasImageUrls: !!(l.ImageUrls && l.ImageUrls.length > 0),
    hasImageUrl: !!l.ImageUrl,
    firstImageUrl: l.ImageUrls?.[0],
    imageUrl: l.ImageUrl,
  })));

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const navigateToListing = (listing) => {
    navigation.navigate('ListingDetail', { listing });
  };

  const formatPrice = (price) => {
    if (!price) return '£0';
    const numericPrice = parseInt(price.replace(/[^0-9]/g, '')) || 0;
    if (numericPrice >= 1000000) {
      return `£${(numericPrice / 1000000).toFixed(1)}M`;
    }
    return `£${Math.floor(numericPrice / 1000)}k`;
  };

  // Normalize image URLs from various field names
  const normalizeImageUrls = (listing) => {
    // Try different possible field names
    const imageSources = [
      listing.ImageUrls,
      listing.imageUrls,
      listing.imageUrl,
      listing.ImageUrl,
    ];
    
    for (const source of imageSources) {
      if (!source) continue;
      
      // If it's already an array
      if (Array.isArray(source)) {
        return source.filter(Boolean);
      }
      
      // If it's a string
      if (typeof source === 'string') {
        const s = source.trim();
        if (!s) continue;
        
        // JSON array string
        if (s.startsWith("[") && s.endsWith("]")) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
              return parsed.filter(Boolean);
            }
          } catch {
            // fall through
          }
        }
        
        // Delimited or single URL
        return s.split(/[,|;]+/).map(x => x.trim()).filter(Boolean);
      }
    }
    
    return [];
  };

  const renderListing = ({ item }) => {
    const favoriteStatus = getFavoriteStatus(item.ID);
    
    // Normalize image URLs from various field names
    const imageUrls = normalizeImageUrls(item);
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
    
    console.log('🖼️ Listing image data for', item.ID, ':', {
      hasImageUrls: !!(item.ImageUrls),
      hasimageUrls: !!(item.imageUrls),
      hasImageUrl: !!(item.imageUrl),
      hasImageUrl2: !!(item.ImageUrl),
      normalizedUrls: imageUrls,
      imageUrl,
    });
    
    return (
      <TouchableOpacity
        style={styles.listingItem}
        onPress={() => navigateToListing(item)}
      >
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.listingImage}
            onError={() => console.log('🖼️ Failed to load image:', imageUrl)}
            onLoad={() => console.log('🖼️ Successfully loaded image:', imageUrl)}
          />
        ) : (
          <View style={[styles.listingImage, styles.placeholderImage]}>
            <Ionicons name="home" size={40} color="#ccc" />
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        <View style={styles.listingContent}>
          <View style={styles.listingHeader}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {item.Title}
            </Text>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => toggleFavorite(item.ID)}
            >
              <Ionicons
                name={favoriteStatus?.isFavorited ? 'heart' : 'heart-outline'}
                size={20}
                color={favoriteStatus?.isFavorited ? '#FF3B30' : '#999'}
              />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.listingPrice}>
            {item.Price || 'Price on request'}
          </Text>
          
          <View style={styles.listingMeta}>
            {item.Beds && (
              <Text style={styles.listingMetaItem}>
                {item.Beds} bed{item.Beds > 1 ? 's' : ''}
              </Text>
            )}
            {item.Baths && (
              <Text style={styles.listingMetaItem}>
                {item.Baths} bath{item.Baths > 1 ? 's' : ''}
              </Text>
            )}
            {item.PropertyType && (
              <Text style={styles.listingMetaItem}>
                {item.PropertyType}
              </Text>
            )}
          </View>
          
          {item.Description && (
            <Text style={styles.listingDescription} numberOfLines={2}>
              {item.Description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Properties</Text>
          <Text style={styles.headerSubtitle}>
            {listings.length} propert{listings.length !== 1 ? 'ies' : ''}
          </Text>
        </View>
      </View>

      {/* Notification Info */}
      <View style={styles.notificationInfo}>
        <View style={styles.notificationHeader}>
          <Ionicons 
            name={
              notification.triggerType === 'hot_zone' ? 'location' :
              notification.triggerType === 'dwell' ? 'time' :
              notification.triggerType === 'price_drop' ? 'trending-down' :
              'notifications'
            } 
            size={20} 
            color="#007AFF" 
          />
          <Text style={styles.notificationTitle}>{notification.title}</Text>
        </View>
        <Text style={styles.notificationBody}>{notification.body}</Text>
        <Text style={styles.notificationTime}>
          {new Date(notification.timestamp).toLocaleString()}
        </Text>
      </View>

      {/* Listings */}
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.ID || Math.random().toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="home" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No properties found</Text>
            <Text style={styles.emptySubtext}>
              This notification doesn't contain any property listings
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  notificationInfo: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  listContainer: {
    padding: 16,
  },
  listingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listingImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  listingContent: {
    padding: 16,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  favoriteButton: {
    padding: 4,
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  listingMetaItem: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
