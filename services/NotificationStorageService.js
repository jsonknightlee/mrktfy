import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationStorageService {
  constructor() {
    this.STORAGE_KEY = 'mrktfy_notifications';
    this.READ_KEY = 'mrktfy_read_notifications';
  }

  // Save a new notification
  async saveNotification(notification) {
    try {
      const notifications = await this.getNotifications();
      
      const newNotification = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        read: false,
        type: notification.type || 'property_alert',
        triggerType: notification.triggerType || 'hot_zone',
        title: notification.title,
        body: notification.body,
        listingIds: notification.listingIds || [],
        listings: notification.listings || [],
        data: notification.data || {},
        ...notification,
      };

      // Add to beginning of array (newest first)
      notifications.unshift(newNotification);
      
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(100);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
      
      // Update unread count
      await this.updateUnreadCount();
      
      return newNotification;
    } catch (error) {
      console.error('Failed to save notification:', error);
      return null;
    }
  }

  // Get all notifications
  async getNotifications() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  // Get unread notifications
  async getUnreadNotifications() {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(n => !n.read);
    } catch (error) {
      console.error('Failed to get unread notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const notifications = await this.getNotifications();
      const notification = notifications.find(n => n.id === notificationId);
      
      if (notification) {
        notification.read = true;
        notification.readAt = Date.now();
        
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
        await this.updateUnreadCount();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const notifications = await this.getNotifications();
      const now = Date.now();
      
      notifications.forEach(notification => {
        if (!notification.read) {
          notification.read = true;
          notification.readAt = now;
        }
      });
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
      await this.updateUnreadCount();
      
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const notifications = await this.getNotifications();
      const filtered = notifications.filter(n => n.id !== notificationId);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      await this.updateUnreadCount();
      
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  // Clear all notifications
  async clearAllNotifications() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await this.updateUnreadCount();
      return true;
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      return false;
    }
  }

  // Get unread count
  async getUnreadCount() {
    try {
      const count = await AsyncStorage.getItem('mrktfy_unread_count');
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  // Update unread count
  async updateUnreadCount() {
    try {
      const notifications = await this.getNotifications();
      const unreadCount = notifications.filter(n => !n.read).length;
      
      await AsyncStorage.setItem('mrktfy_unread_count', unreadCount.toString());
      
      return unreadCount;
    } catch (error) {
      console.error('Failed to update unread count:', error);
      return 0;
    }
  }

  // Get notifications by type
  async getNotificationsByType(type) {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(n => n.type === type);
    } catch (error) {
      console.error('Failed to get notifications by type:', error);
      return [];
    }
  }

  // Get notifications from last N days
  async getRecentNotifications(days = 7) {
    try {
      const notifications = await this.getNotifications();
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      return notifications.filter(n => n.timestamp > cutoff);
    } catch (error) {
      console.error('Failed to get recent notifications:', error);
      return [];
    }
  }

  // Get notification statistics
  async getNotificationStats() {
    try {
      const notifications = await this.getNotifications();
      const unread = await this.getUnreadCount();
      
      const stats = {
        total: notifications.length,
        unread,
        read: notifications.length - unread,
        byType: {},
        byTriggerType: {},
      };

      notifications.forEach(notification => {
        // Count by type
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        
        // Count by trigger type
        stats.byTriggerType[notification.triggerType] = (stats.byTriggerType[notification.triggerType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        total: 0,
        unread: 0,
        read: 0,
        byType: {},
        byTriggerType: {},
      };
    }
  }

  // Export notifications for backup
  async exportNotifications() {
    try {
      const notifications = await this.getNotifications();
      const stats = await this.getNotificationStats();
      
      return {
        notifications,
        stats,
        exportedAt: Date.now(),
        version: '1.0',
      };
    } catch (error) {
      console.error('Failed to export notifications:', error);
      return null;
    }
  }

  // Import notifications from backup
  async importNotifications(data) {
    try {
      if (!data.notifications || !Array.isArray(data.notifications)) {
        throw new Error('Invalid notification data');
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.notifications));
      await this.updateUnreadCount();
      
      return true;
    } catch (error) {
      console.error('Failed to import notifications:', error);
      return false;
    }
  }
}

export default new NotificationStorageService();
