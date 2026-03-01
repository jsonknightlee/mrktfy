import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationStorageService from '../services/NotificationStorageService';
import NaturalTimingEngine from '../services/NaturalTimingEngine';
import { useNavigation } from '@react-navigation/native';

const NOTIFICATION_ICONS = {
  hot_zone: 'location',
  dwell: 'time',
  price_drop: 'trending-down',
  default: 'notifications',
};

const TRIGGER_TYPE_LABELS = {
  hot_zone: 'Hot Zone',
  dwell: 'Area Alert',
  price_drop: 'Price Drop',
  default: 'Property Alert',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'unread'
  const navigation = useNavigation();

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  // Load notifications
  const loadNotifications = async () => {
    try {
      console.log('🔔 Loading notifications...');
      const allNotifications = await NotificationStorageService.getNotifications();
      const unread = await NotificationStorageService.getUnreadCount();
      
      console.log(`📊 Found ${allNotifications.length} notifications, ${unread} unread`);
      console.log('🔔 Notifications data:', allNotifications);
      
      setNotifications(allNotifications);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Refresh notifications
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await NotificationStorageService.markAsRead(notificationId);
      
      // Update Natural Timing Engine with engagement data
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        NaturalTimingEngine.recordUserEngagement(notification.triggerType, 'read');
      }
      
      await loadNotifications(); // Reload to update UI
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await NotificationStorageService.markAllAsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationStorageService.deleteNotification(notificationId);
              await loadNotifications();
            } catch (error) {
              console.error('Failed to delete notification:', error);
            }
          },
        },
      ]
    );
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationStorageService.clearAllNotifications();
              await loadNotifications();
            } catch (error) {
              console.error('Failed to clear notifications:', error);
            }
          },
        },
      ]
    );
  };

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return '£0k';
    const numericPrice = parseInt(price.replace(/[^0-9]/g, '')) || 0;
    return `£${Math.floor(numericPrice / 1000)}k`;
  };

  // Navigate to notification listings
  const navigateToListings = (notification) => {
    console.log('🔗 Navigating to notification listings:', {
      notificationId: notification.id,
      listingCount: notification.listings?.length,
      hasListings: !!(notification.listings && notification.listings.length > 0),
      firstListing: notification.listings?.[0] ? {
        id: notification.listings[0].ID,
        hasImageUrls: !!(notification.listings[0].ImageUrls && notification.listings[0].ImageUrls.length > 0),
        hasImageUrl: !!notification.listings[0].ImageUrl,
        firstImageUrl: notification.listings[0].ImageUrls?.[0],
        imageUrl: notification.listings[0].ImageUrl,
      } : null,
    });
    navigation.navigate('NotificationListings', { notification });
  };

  // Get filtered notifications based on selected tab
  const getFilteredNotifications = () => {
    if (selectedTab === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMs > 60000) {
      return `${Math.floor(diffMs / 60000)} min ago`;
    } else {
      return 'Just now';
    }
  };

  // Render notification item
  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification,
      ]}
      onPress={() => {
        if (!item.read) {
          markAsRead(item.id);
        }
        navigateToListings(item);
      }}
    >
      <View style={styles.notificationHeader}>
        <View style={styles.notificationLeft}>
          <Ionicons
            name={NOTIFICATION_ICONS[item.triggerType] || NOTIFICATION_ICONS.default}
            size={20}
            color={item.read ? '#999' : '#007AFF'}
          />
          <View style={styles.notificationMeta}>
            <Text style={styles.triggerType}>
              {TRIGGER_TYPE_LABELS[item.triggerType] || TRIGGER_TYPE_LABELS.default}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>

      <Text style={[
        styles.notificationTitle,
        !item.read && styles.unreadTitle,
      ]}>
        {item.title}
      </Text>

      {item.body && (
        <Text style={styles.notificationBody}>
          {item.body}
        </Text>
      )}

      {item.listings && item.listings.length > 0 && (
        <View style={styles.listingsContainer}>
          <Text style={styles.listingsHeader}>Matching Properties:</Text>
          {item.listings.slice(0, 3).map((listing, index) => (
            <TouchableOpacity
              key={listing.ID || index}
              style={styles.listingItem}
              onPress={() => {
                // Record engagement and navigate to listing detail
                NaturalTimingEngine.recordUserEngagement(item.triggerType, 'tap');
                navigation.navigate('ListingDetail', { listing });
              }}
            >
              <Text style={styles.listingPrice}>
                {formatPrice(listing.Price)}
              </Text>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {listing.Title}
              </Text>
              {listing.Beds && (
                <Text style={styles.listingBeds}>
                  {listing.Beds} bed{listing.Beds > 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          ))}
          {item.listings.length > 3 && (
            <TouchableOpacity
              style={styles.moreListings}
              onPress={() => navigateToListings(item)}
            >
              <Text style={styles.moreListingsText}>
                +{item.listings.length - 3} more properties
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.notificationActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteNotification(item.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#999" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const filteredNotifications = getFilteredNotifications();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'all' && styles.activeTab,
          ]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[
            styles.tabText,
            selectedTab === 'all' && styles.activeTabText,
          ]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'unread' && styles.activeTab,
          ]}
          onPress={() => setSelectedTab('unread')}
        >
          <Text style={[
            styles.tabText,
            selectedTab === 'unread' && styles.activeTabText,
          ]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
        >
          <Ionicons name="checkmark-done" size={16} color="#007AFF" />
          <Text style={styles.actionText}>Mark All Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={clearAllNotifications}
          disabled={notifications.length === 0}
        >
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          <Text style={styles.actionText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {selectedTab === 'unread' 
                ? 'No unread notifications' 
                : 'No notifications yet'
              }
            </Text>
            <Text style={styles.emptySubtext}>
              Property alerts will appear here when you're near matching listings
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginRight: 12,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  listContainer: {
    padding: 16,
  },
  notificationItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e9ecef',
  },
  unreadNotification: {
    borderLeftColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  notificationMeta: {
    marginLeft: 12,
    flex: 1,
  },
  triggerType: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginTop: 2,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  unreadTitle: {
    color: '#007AFF',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  listingsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  listingsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  listingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
    minWidth: 60,
  },
  listingTitle: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  listingBeds: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreListings: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  moreListingsText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
