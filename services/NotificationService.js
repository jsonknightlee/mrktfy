import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

class NotificationService {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize notification service
  async initialize() {
    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      const permissions = await this.requestPermissions();
      
      if (permissions.granted) {
        this.isInitialized = true;
        console.log('✅ Notification service initialized');
        return true;
      } else {
        console.warn('⚠️ Notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      return false;
    }
  }

  // Request notification permissions
  async requestPermissions() {
    if (Platform.OS === 'ios') {
      const { status } = await Notifications.requestPermissionsAsync();
      return {
        granted: status === 'granted',
        status,
      };
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      return {
        granted: status === 'granted',
        status,
      };
    }
  }

  // Check current permission status
  async getPermissions() {
    const status = await Notifications.getPermissionsAsync();
    return {
      granted: status.status === 'granted',
      status: status.status,
      canAskAgain: status.canAskAgain,
    };
  }

  // Send local notification
  async sendLocalNotification(title, body, data = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ Notification service not initialized');
      return false;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });

      console.log('📱 Local notification sent:', title);
      return true;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      return false;
    }
  }

  // Schedule delayed notification
  async scheduleNotification(title, body, trigger, data = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ Notification service not initialized');
      return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      console.log('⏰ Notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Failed to schedule notification:', error);
      return null;
    }
  }

  // Cancel scheduled notification
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('🚫 Notification cancelled:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ Failed to cancel notification:', error);
      return false;
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('❌ Failed to get scheduled notifications:', error);
      return [];
    }
  }

  // Clear all notifications
  async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🧹 All notifications cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear notifications:', error);
      return false;
    }
  }

  // Get notification badge count
  async getBadgeCount() {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('❌ Failed to get badge count:', error);
      return 0;
    }
  }

  // Set notification badge count
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('🔢 Badge count set to:', count);
      return true;
    } catch (error) {
      console.error('❌ Failed to set badge count:', error);
      return false;
    }
  }

  // Setup notification listeners
  setupListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for when notification is received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📨 Notification received in foreground:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user interacts with notification
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification response received:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  // Create property notification content
  createPropertyNotification(listings, triggerType, userLocation) {
    const count = listings.length;
    const priceRange = this.getPriceRange(listings);
    
    let title, body;
    
    switch (triggerType) {
      case 'hot_zone':
        title = count === 1 ? 'New Property Nearby!' : `${count} New Properties Nearby`;
        body = count === 1 
          ? `${listings[0].Title}${priceRange ? ` - ${priceRange}` : ''}`
          : `Properties matching your search${priceRange ? ` (${priceRange})` : ''}`;
        break;
        
      case 'dwell':
        title = count === 1 ? 'Property Nearby' : 'Properties Nearby';
        body = count === 1
          ? `You're near ${listings[0].Title}${priceRange ? ` - ${priceRange}` : ''}`
          : `You're near ${count} properties matching your criteria${priceRange ? ` (${priceRange})` : ''}`;
        break;
        
      case 'price_drop':
        title = count === 1 ? 'Price Drop!' : 'Price Drops!';
        body = count === 1
          ? `${listings[0].Title} price reduced${priceRange ? ` - now ${priceRange}` : ''}`
          : `${count} properties you viewed had price drops`;
        break;
        
      default:
        title = 'Property Alert';
        body = `${count} properties match your criteria`;
    }

    return { title, body };
  }

  // Extract price range from listings
  getPriceRange(listings) {
    if (!listings || !listings.length) return null;
    
    const prices = listings.map(listing => listing.Price).filter(Boolean);
    if (!prices.length) return null;
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    if (min === max) {
      return `£${(min / 1000).toFixed(0)}k`;
    }
    
    return `£${(min / 1000).toFixed(0)}k-£${(max / 1000).toFixed(0)}k`;
  }

  // Send property notification
  async sendPropertyNotification(listings, triggerType, userLocation = null) {
    const { title, body } = this.createPropertyNotification(listings, triggerType, userLocation);
    
    const data = {
      type: 'property_alert',
      triggerType,
      listingIds: listings.map(l => l.ID),
      timestamp: Date.now(),
    };

    return await this.sendLocalNotification(title, body, data);
  }

  // Get initialization status
  isReady() {
    return this.isInitialized;
  }
}

export default new NotificationService();
