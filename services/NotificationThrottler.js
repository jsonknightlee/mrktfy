import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationThrottler {
  constructor() {
    this.tierLimits = {
      prospector: {
        maxPerDay: 5,
        maxPerHour: 2,
        minCooldownMinutes: 15,
        contextDelayMinutes: 60, // After viewing listing
      },
      investor: {
        maxPerDay: 20,
        maxPerHour: 5,
        minCooldownMinutes: 5,
        contextDelayMinutes: 30,
      },
      developer: {
        maxPerDay: Infinity,
        maxPerHour: Infinity,
        minCooldownMinutes: 1,
        contextDelayMinutes: 15,
      },
    };

    this.userTier = 'prospector'; // Default tier
    this.notificationHistory = [];
    this.lastListingViewTime = null;
    this.ignoredCount = 0;
    this.engagementScore = 100; // Starts at 100, decreases with ignores
  }

  // Initialize throttler with user data
  async initialize(userTier = 'prospector') {
    this.userTier = userTier;
    await this.loadNotificationHistory();
    await this.cleanupOldHistory();
  }

  // Load notification history from storage
  async loadNotificationHistory() {
    try {
      const stored = await AsyncStorage.getItem('notificationHistory');
      if (stored) {
        this.notificationHistory = JSON.parse(stored);
      }

      const lastView = await AsyncStorage.getItem('lastListingViewTime');
      if (lastView) {
        this.lastListingViewTime = parseInt(lastView);
      }

      const ignored = await AsyncStorage.getItem('ignoredNotifications');
      if (ignored) {
        this.ignoredCount = parseInt(ignored);
      }

      const score = await AsyncStorage.getItem('engagementScore');
      if (score) {
        this.engagementScore = parseInt(score);
      }
    } catch (error) {
      console.error('Failed to load notification history:', error);
    }
  }

  // Save notification history to storage
  async saveHistory() {
    try {
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(this.notificationHistory));
      await AsyncStorage.setItem('ignoredNotifications', this.ignoredCount.toString());
      await AsyncStorage.setItem('engagementScore', this.engagementScore.toString());
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }

  // Clean up old history (older than 7 days)
  async cleanupOldHistory() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.notificationHistory = this.notificationHistory.filter(
      notification => notification.timestamp > sevenDaysAgo
    );
    await this.saveHistory();
  }

  // Check if notification can be sent
  async canSendNotification(context = {}) {
    const limits = this.tierLimits[this.userTier];
    const now = Date.now();

    // Check daily limit
    const todayNotifications = this.getTodayNotifications();
    if (todayNotifications.length >= limits.maxPerDay) {
      return { allowed: false, reason: 'daily_limit_exceeded' };
    }

    // Check hourly limit
    const hourAgo = now - (60 * 60 * 1000);
    const recentNotifications = this.notificationHistory.filter(
      notification => notification.timestamp > hourAgo
    );
    if (recentNotifications.length >= limits.maxPerHour) {
      return { allowed: false, reason: 'hourly_limit_exceeded' };
    }

    // Check minimum cooldown
    if (this.notificationHistory.length > 0) {
      const lastNotification = this.notificationHistory[this.notificationHistory.length - 1];
      const timeSinceLast = now - lastNotification.timestamp;
      const minCooldown = limits.minCooldownMinutes * 60 * 1000;
      
      if (timeSinceLast < minCooldown) {
        return { allowed: false, reason: 'cooldown_active' };
      }
    }

    // Check context-aware delays
    if (this.lastListingViewTime) {
      const timeSinceView = now - this.lastListingViewTime;
      const contextDelay = limits.contextDelayMinutes * 60 * 1000;
      
      if (timeSinceView < contextDelay) {
        return { allowed: false, reason: 'recent_listing_view' };
      }
    }

    // Check engagement-based frequency adjustment
    if (this.engagementScore < 50) {
      // Reduce frequency for low engagement users
      const adjustedCooldown = minCooldown * 2; // Double the cooldown
      if (this.notificationHistory.length > 0) {
        const lastNotification = this.notificationHistory[this.notificationHistory.length - 1];
        const timeSinceLast = now - lastNotification.timestamp;
        
        if (timeSinceLast < adjustedCooldown) {
          return { allowed: false, reason: 'low_engagement_cooldown' };
        }
      }
    }

    // Check if user is currently active in app
    if (context.isAppActive) {
      return { allowed: false, reason: 'app_active' };
    }

    return { allowed: true };
  }

  // Record notification sent
  async recordNotification(listingIds = [], triggerType = 'hot_zone') {
    const notification = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      listingIds,
      triggerType,
      tier: this.userTier,
    };

    this.notificationHistory.push(notification);
    await this.saveHistory();

    return notification.id;
  }

  // Record user interaction with notification
  async recordNotificationInteraction(notificationId, action) {
    const notification = this.notificationHistory.find(n => n.id === notificationId);
    if (notification) {
      notification.interaction = {
        action, // 'tapped', 'dismissed', 'ignored'
        timestamp: Date.now(),
      };

      // Update engagement score
      if (action === 'tapped') {
        this.engagementScore = Math.min(100, this.engagementScore + 10);
        this.ignoredCount = 0;
      } else if (action === 'dismissed' || action === 'ignored') {
        this.engagementScore = Math.max(0, this.engagementScore - 5);
        this.ignoredCount++;
      }

      await this.saveHistory();
    }
  }

  // Record listing view (for context-aware delays)
  async recordListingView() {
    this.lastListingViewTime = Date.now();
    try {
      await AsyncStorage.setItem('lastListingViewTime', this.lastListingViewTime.toString());
    } catch (error) {
      console.error('Failed to save listing view time:', error);
    }
  }

  // Get today's notifications
  getTodayNotifications() {
    const today = new Date().toDateString();
    const todayStart = new Date(today).getTime();
    
    return this.notificationHistory.filter(
      notification => notification.timestamp >= todayStart
    );
  }

  // Get notification statistics
  getStats() {
    const todayNotifications = this.getTodayNotifications();
    const hourAgo = Date.now() - (60 * 60 * 1000);
    const recentNotifications = this.notificationHistory.filter(
      notification => notification.timestamp > hourAgo
    );

    return {
      tier: this.userTier,
      todayCount: todayNotifications.length,
      hourCount: recentNotifications.length,
      dailyLimit: this.tierLimits[this.userTier].maxPerDay,
      hourlyLimit: this.tierLimits[this.userTier].maxPerHour,
      ignoredCount: this.ignoredCount,
      engagementScore: this.engagementScore,
      lastNotificationTime: this.notificationHistory.length > 0 
        ? this.notificationHistory[this.notificationHistory.length - 1].timestamp 
        : null,
    };
  }

  // Get next available notification time
  getNextAvailableTime() {
    const limits = this.tierLimits[this.userTier];
    const now = Date.now();

    // Check daily limit
    const todayNotifications = this.getTodayNotifications();
    if (todayNotifications.length >= limits.maxPerDay) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime();
    }

    // Check hourly limit
    const hourAgo = now - (60 * 60 * 1000);
    const recentNotifications = this.notificationHistory.filter(
      notification => notification.timestamp > hourAgo
    );
    if (recentNotifications.length >= limits.maxPerHour) {
      const oldestRecent = Math.min(...recentNotifications.map(n => n.timestamp));
      return oldestRecent + (60 * 60 * 1000);
    }

    // Check cooldown
    if (this.notificationHistory.length > 0) {
      const lastNotification = this.notificationHistory[this.notificationHistory.length - 1];
      const minCooldown = limits.minCooldownMinutes * 60 * 1000;
      return lastNotification.timestamp + minCooldown;
    }

    // Check context delay
    if (this.lastListingViewTime) {
      const contextDelay = limits.contextDelayMinutes * 60 * 1000;
      return this.lastListingViewTime + contextDelay;
    }

    return now; // Available now
  }

  // Update user tier
  async updateTier(newTier) {
    if (this.tierLimits[newTier]) {
      this.userTier = newTier;
      await this.saveHistory();
    }
  }

  // Reset engagement score (for testing or user reset)
  async resetEngagementScore() {
    this.engagementScore = 100;
    this.ignoredCount = 0;
    await this.saveHistory();
  }
}

export default new NotificationThrottler();
