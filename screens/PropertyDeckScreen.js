import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  dismissDeckListing,
  getListingId,
  getMatchedDeckListings,
  getShortlist,
  removeFromShortlist,
  saveToShortlist,
} from '../services/PropertyDeckService';

const APP_PURPLE = '#6366F1';
const SWIPE_THRESHOLD = 110;

const normalizeImageUrls = (listing) => {
  const imageSources = [
    listing?.ImageUrls,
    listing?.imageUrls,
    listing?.ImageUrl,
    listing?.imageUrl,
  ];

  for (const source of imageSources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      return source.filter(Boolean);
    }

    if (typeof source === 'string') {
      const value = source.trim();
      if (!value) continue;

      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.filter(Boolean);
          }
        } catch {
          // Fall through to delimiter parsing.
        }
      }

      return value.split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
};

const formatPrice = (price) => {
  if (!price) return 'Price on request';
  if (typeof price === 'number') return `£${price.toLocaleString()}`;
  return price;
};

const formatMatchedAt = (timestamp) => {
  if (!timestamp) return 'Matched from notifications';

  try {
    return `Matched ${new Date(timestamp).toLocaleDateString()}`;
  } catch {
    return 'Matched from notifications';
  }
};

export default function PropertyDeckScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const pan = useRef(new Animated.ValueXY()).current;
  const isProcessingRef = useRef(false);
  const [activeSection, setActiveSection] = useState('deck');
  const [deckListings, setDeckListings] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentListing = deckListings[currentIndex];

  const loadDeck = useCallback(async () => {
    setLoading(true);
    const [nextDeckListings, nextShortlist] = await Promise.all([
      getMatchedDeckListings(),
      getShortlist(),
    ]);

    setDeckListings(nextDeckListings);
    setShortlist(nextShortlist);
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
    setLoading(false);
  }, [pan]);

  useFocusEffect(
    useCallback(() => {
      loadDeck();
    }, [loadDeck])
  );

  const cardStyle = useMemo(() => {
    const rotate = pan.x.interpolate({
      inputRange: [-240, 0, 240],
      outputRange: ['-8deg', '0deg', '8deg'],
    });

    return {
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { rotate },
      ],
    };
  }, [pan]);

  const completeSwipe = useCallback(async (direction) => {
    if (!currentListing || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const listing = currentListing;
    const listingId = getListingId(listing);

    if (direction === 'left') {
      const nextShortlist = await saveToShortlist(listing);
      setShortlist(nextShortlist);
    } else {
      await dismissDeckListing(listingId);
    }

    Animated.timing(pan, {
      toValue: { x: direction === 'left' ? -500 : 500, y: 0 },
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setCurrentIndex((index) => index + 1);
      isProcessingRef.current = false;
    });
  }, [currentListing, pan]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8
    ),
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -SWIPE_THRESHOLD) {
        completeSwipe('left');
        return;
      }

      if (gesture.dx > SWIPE_THRESHOLD) {
        completeSwipe('right');
        return;
      }

      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        useNativeDriver: true,
      }).start();
    },
  }), [completeSwipe, pan]);

  const openListing = (listing) => {
    navigation.navigate('ListingDetail', { listing });
  };

  const handleRemoveFromShortlist = async (listingId) => {
    const nextShortlist = await removeFromShortlist(listingId);
    setShortlist(nextShortlist);
    setDeckListings(await getMatchedDeckListings());
  };

  const renderDeckCard = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="layers-outline" size={42} color="#C7CDD8" />
          <Text style={styles.emptyTitle}>Loading Property Deck</Text>
        </View>
      );
    }

    if (!currentListing) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={44} color={APP_PURPLE} />
          <Text style={styles.emptyTitle}>Deck cleared</Text>
          <Text style={styles.emptyText}>
            New matched properties from notifications will appear here.
          </Text>
        </View>
      );
    }

    const imageUrl = normalizeImageUrls(currentListing)[0];

    return (
      <>
        <Animated.View
          style={[styles.deckCard, cardStyle]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => openListing(currentListing)}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.deckImage} />
            ) : (
              <View style={[styles.deckImage, styles.placeholderImage]}>
                <Ionicons name="home-outline" size={52} color="#C7CDD8" />
              </View>
            )}

            <View style={styles.deckContent}>
              <Text style={styles.deckPrice}>{formatPrice(currentListing.Price)}</Text>
              <Text style={styles.deckTitle} numberOfLines={2}>
                {currentListing.Title || currentListing.Address || 'Property match'}
              </Text>

              <View style={styles.metaRow}>
                {!!currentListing.Beds && (
                  <Text style={styles.metaText}>{currentListing.Beds} beds</Text>
                )}
                {!!currentListing.Baths && (
                  <Text style={styles.metaText}>{currentListing.Baths} baths</Text>
                )}
                {!!currentListing.PropertyType && (
                  <Text style={styles.metaText}>{currentListing.PropertyType}</Text>
                )}
              </View>

              <View style={styles.matchFooter}>
                <Ionicons name="notifications-outline" size={16} color={APP_PURPLE} />
                <Text style={styles.matchText} numberOfLines={1}>
                  {currentListing.sourceNotificationTitle || formatMatchedAt(currentListing.matchedAt)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={() => completeSwipe('right')}
          >
            <Ionicons name="close" size={22} color="#475569" />
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shortlistButton]}
            onPress={() => completeSwipe('left')}
          >
            <Ionicons name="albums" size={22} color="#FFFFFF" />
            <Text style={styles.shortlistButtonText}>Shortlist</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderShortlistItem = ({ item }) => {
    const imageUrl = normalizeImageUrls(item)[0];
    const listingId = getListingId(item);

    return (
      <TouchableOpacity
        style={styles.shortlistItem}
        activeOpacity={0.9}
        onPress={() => openListing(item)}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.shortlistImage} />
        ) : (
          <View style={[styles.shortlistImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={28} color="#C7CDD8" />
          </View>
        )}

        <View style={styles.shortlistContent}>
          <Text style={styles.shortlistPrice}>{formatPrice(item.Price)}</Text>
          <Text style={styles.shortlistTitle} numberOfLines={2}>
            {item.Title || item.Address || 'Shortlisted property'}
          </Text>
          <Text style={styles.shortlistMeta} numberOfLines={1}>
            {[item.Beds && `${item.Beds} beds`, item.Baths && `${item.Baths} baths`, item.PropertyType]
              .filter(Boolean)
              .join(' / ')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFromShortlist(listingId)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Property Deck</Text>
          <Text style={styles.subtitle}>
            Swipe left to shortlist matched properties.
          </Text>
        </View>
      </View>

      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, activeSection === 'deck' && styles.activeSegment]}
          onPress={() => setActiveSection('deck')}
        >
          <Text style={[styles.segmentText, activeSection === 'deck' && styles.activeSegmentText]}>
            Deck
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeSection === 'shortlist' && styles.activeSegment]}
          onPress={() => setActiveSection('shortlist')}
        >
          <Text style={[styles.segmentText, activeSection === 'shortlist' && styles.activeSegmentText]}>
            Shortlist ({shortlist.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'deck' ? (
        <View style={styles.deckContainer}>
          {renderDeckCard()}
        </View>
      ) : (
        <FlatList
          data={shortlist}
          renderItem={renderShortlistItem}
          keyExtractor={(item, index) => getListingId(item) || `shortlist-${index}`}
          contentContainerStyle={styles.shortlistList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={44} color="#C7CDD8" />
              <Text style={styles.emptyTitle}>No shortlisted properties yet</Text>
              <Text style={styles.emptyText}>
                Swipe left on deck cards to build your compare list.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F8FB',
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  segmentedControl: {
    backgroundColor: '#E8EAF1',
    borderRadius: 8,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingVertical: 10,
  },
  activeSegment: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  activeSegmentText: {
    color: APP_PURPLE,
  },
  deckContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  deckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: '100%',
  },
  deckImage: {
    backgroundColor: '#EEF2F7',
    height: 310,
    width: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckContent: {
    padding: 18,
  },
  deckPrice: {
    color: APP_PURPLE,
    fontSize: 22,
    fontWeight: '800',
  },
  deckTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaText: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  matchFooter: {
    alignItems: 'center',
    borderTopColor: '#EEF2F7',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
  },
  matchText: {
    color: '#64748B',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  skipButton: {
    backgroundColor: '#E5E7EB',
  },
  shortlistButton: {
    backgroundColor: APP_PURPLE,
  },
  skipButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '800',
  },
  shortlistButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  shortlistList: {
    padding: 20,
    paddingBottom: 32,
  },
  shortlistItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
  },
  shortlistImage: {
    backgroundColor: '#EEF2F7',
    height: 92,
    width: 104,
  },
  shortlistContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shortlistPrice: {
    color: APP_PURPLE,
    fontSize: 16,
    fontWeight: '800',
  },
  shortlistTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 3,
  },
  shortlistMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  removeButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginRight: 6,
    width: 44,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 46,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
