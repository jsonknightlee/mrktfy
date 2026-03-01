import AsyncStorage from '@react-native-async-storage/async-storage';

class NaturalTimingEngine {
  constructor() {
    this.timingStrategies = {
      immediate: {
        delay: 0,
        description: 'Send immediately',
        useCase: 'high-priority alerts',
      },
      dwell: {
        delay: 180000, // 3 minutes
        description: 'Send after user dwells in area',
        useCase: 'contextual suggestions',
      },
      smart_delay: {
        minDelay: 120000, // 2 minutes
        maxDelay: 300000, // 5 minutes
        description: 'Smart delay based on user behavior',
        useCase: 'new listings in area',
      },
      batch: {
        delay: 3600000, // 1 hour
        description: 'Batch multiple notifications',
        useCase: 'digest-style updates',
      },
    };

    this.userBehavior = {
      averageSessionDuration: 0,
      lastAppOpenTime: null,
      lastNotificationInteraction: null,
      preferredTimes: [], // User's active hours
      ignoredCount: 0,
      engagedCount: 0,
    };

    this.activeTimers = new Map(); // Track active delay timers
  }

  // Initialize with user behavior data
  async initialize(userBehaviorData = {}) {
    this.userBehavior = { ...this.userBehavior, ...userBehaviorData };
    await this.loadUserPreferences();
  }

  // Load user's notification preferences
  async loadUserPreferences() {
    try {
      // This would load from your backend or local storage
      // For now, we'll use sensible defaults
      this.userBehavior.preferredTimes = [
        { start: 8, end: 12 }, // Morning: 8am - 12pm
        { start: 18, end: 21 }, // Evening: 6pm - 9pm
      ];
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
  }

  // Determine optimal timing strategy based on context
  determineStrategy(context) {
    const {
      triggerType,
      listingCount,
      userActivity,
      timeOfDay,
      listingScore,
    } = context;

    // High-priority scenarios
    if (listingScore > 90 || triggerType === 'price_drop') {
      return 'immediate';
    }

    // User is currently active in app
    if (userActivity?.isAppActive) {
      return 'batch'; // Don't interrupt, batch for later
    }

    // User just opened app recently
    if (userActivity?.recentAppOpen) {
      return 'smart_delay'; // Give them time to explore
    }

    // Multiple listings
    if (listingCount > 3) {
      return 'batch';
    }

    // User is dwelling in area
    if (triggerType === 'dwell') {
      return 'dwell';
    }

    // Default for new listings
    return 'smart_delay';
  }

  // Calculate smart delay based on user behavior and context
  calculateSmartDelay(context) {
    const strategy = this.determineStrategy(context);
    const baseStrategy = this.timingStrategies[strategy];

    if (strategy === 'immediate') {
      return 0;
    }

    if (strategy === 'dwell') {
      return baseStrategy.delay;
    }

    if (strategy === 'batch') {
      return baseStrategy.delay;
    }

    // Smart delay logic
    let delay = baseStrategy.minDelay;
    const { userActivity, timeOfDay, listingScore } = context;

    // Adjust based on time of day
    const currentHour = new Date().getHours();
    const isInPreferredTime = this.userBehavior.preferredTimes.some(
      period => currentHour >= period.start && currentHour <= period.end
    );

    if (!isInPreferredTime) {
      delay *= 1.5; // Increase delay outside preferred hours
    }

    // Adjust based on user engagement
    const engagementRatio = this.userBehavior.engagedCount / 
      Math.max(1, this.userBehavior.engagedCount + this.userBehavior.ignoredCount);

    if (engagementRatio < 0.3) {
      delay *= 1.3; // Increase delay for low-engagement users
    } else if (engagementRatio > 0.7) {
      delay *= 0.8; // Reduce delay for high-engagement users
    }

    // Adjust based on listing score
    if (listingScore > 85) {
      delay *= 0.7; // Faster for high-quality listings
    } else if (listingScore < 70) {
      delay *= 1.2; // Slower for lower-quality listings
    }

    // Adjust based on recent app activity
    if (userActivity?.recentAppOpen) {
      delay += 60000; // Add 1 minute if user just opened app
    }

    // Ensure within bounds
    return Math.min(Math.max(delay, baseStrategy.minDelay), baseStrategy.maxDelay);
  }

  // Schedule notification with natural timing
  scheduleNotification(notificationId, context, callback) {
    // Cancel any existing timer for this notification
    if (this.activeTimers.has(notificationId)) {
      clearTimeout(this.activeTimers.get(notificationId));
    }

    const delay = this.calculateSmartDelay(context);
    
    if (delay === 0) {
      // Send immediately
      callback(notificationId, context);
      return;
    }

    // Schedule delayed notification
    const timer = setTimeout(() => {
      callback(notificationId, context);
      this.activeTimers.delete(notificationId);
    }, delay);

    this.activeTimers.set(notificationId, timer);

    return {
      scheduledFor: Date.now() + delay,
      strategy: this.determineStrategy(context),
      delay,
    };
  }

  // Cancel scheduled notification
  cancelNotification(notificationId) {
    if (this.activeTimers.has(notificationId)) {
      clearTimeout(this.activeTimers.get(notificationId));
      this.activeTimers.delete(notificationId);
      return true;
    }
    return false;
  }

  // Check if it's a good time to send notifications
  isGoodTimeToSend() {
    const currentHour = new Date().getHours();
    const isInPreferredTime = this.userBehavior.preferredTimes.some(
      period => currentHour >= period.start && currentHour <= period.end
    );

    // Avoid very early morning or late night
    if (currentHour < 7 || currentHour > 22) {
      return false;
    }

    return isInPreferredTime;
  }

  // Record user engagement for learning
  recordUserEngagement(triggerType, engagementType) {
    try {
      // Update user behavior based on engagement
      const now = new Date();
      const hour = now.getHours();
      
      // Track when user engages with notifications
      if (!this.userBehavior.engagementTimes) {
        this.userBehavior.engagementTimes = [];
      }
      
      this.userBehavior.engagementTimes.push({
        timestamp: now,
        hour,
        triggerType,
        engagementType, // 'read', 'tap', 'dismiss'
      });
      
      // Keep only last 100 engagements
      if (this.userBehavior.engagementTimes.length > 100) {
        this.userBehavior.engagementTimes = this.userBehavior.engagementTimes.slice(-100);
      }
      
      // Update preferred times based on engagement
      this.updatePreferredTimes();
      
      // Save to storage
      this.saveUserBehavior();
      
      console.log(`📊 Recorded ${engagementType} engagement for ${triggerType} at ${hour}:00`);
    } catch (error) {
      console.error('Failed to record user engagement:', error);
    }
  }

  // Save user behavior to storage
  async saveUserBehavior() {
    try {
      await AsyncStorage.setItem('natural_timing_user_behavior', JSON.stringify(this.userBehavior));
    } catch (error) {
      console.error('Failed to save user behavior:', error);
    }
  }

  // Update preferred times based on engagement patterns
  updatePreferredTimes() {
    const engagements = this.userBehavior.engagementTimes || [];
    if (engagements.length < 10) return; // Need enough data
    
    // Count engagements by hour
    const hourCounts = {};
    engagements.forEach(engagement => {
      const hour = engagement.hour;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    // Find top engagement hours
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    if (sortedHours.length > 0) {
      // Create preferred time periods around top engagement hours
      this.userBehavior.preferredTimes = sortedHours.map(hour => ({
        start: Math.max(7, hour - 1), // 1 hour before
        end: Math.min(22, hour + 1), // 1 hour after
        strength: hourCounts[hour] / engagements.length
      }));
      
      console.log('🕐 Updated preferred times based on engagement patterns');
    }
  }
  getNextOptimalTime() {
    const currentHour = new Date().getHours();
    const now = new Date();

    for (const period of this.userBehavior.preferredTimes) {
      if (currentHour < period.start) {
        // Next preferred period is today
        const nextTime = new Date(now);
        nextTime.setHours(period.start, 0, 0, 0);
        return nextTime;
      }
    }

    // Next preferred period is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.userBehavior.preferredTimes[0].start, 0, 0, 0);
    return tomorrow;
  }

  // Build contextual notification message
  buildMessage(context) {
    const {
      triggerType,
      listingCount,
      listings,
      userLocation,
    } = context;

    const priceRange = this.getPriceRange(listings);
    const areaName = this.getAreaName(userLocation);

    switch (triggerType) {
      case 'hot_zone':
        return listingCount === 1 
          ? `New property near ${areaName} matches your search${priceRange ? ` (${priceRange})` : ''}`
          : `${listingCount} new properties near ${areaName} match your search${priceRange ? ` (${priceRange})` : ''}`;

      case 'dwell':
        return listingCount === 1
          ? `You're near a property that matches your criteria${priceRange ? ` around ${priceRange}` : ''}`
          : `You're near ${listingCount} properties matching your filters${priceRange ? ` around ${priceRange}` : ''}`;

      case 'price_drop':
        return listingCount === 1
          ? `Price drop on property you viewed${priceRange ? ` - now ${priceRange}` : ''}`
          : `${listingCount} properties you viewed had price drops`;

      case 'batch':
        return `${listingCount} property updates since your last visit`;

      default:
        return `${listingCount} properties match your criteria`;
    }
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

  // Get area name from coordinates (simplified)
  getAreaName(userLocation) {
    if (!userLocation) return 'your area';
    
    // This would typically use a reverse geocoding service
    // For now, return a generic description
    return 'your current area';
  }

  // Record user interaction with notification
  recordInteraction(notificationId, action, context) {
    if (action === 'tapped') {
      this.userBehavior.engagedCount++;
    } else if (action === 'dismissed' || action === 'ignored') {
      this.userBehavior.ignoredCount++;
    }

    this.userBehavior.lastNotificationInteraction = {
      notificationId,
      action,
      timestamp: Date.now(),
      context,
    };
  }

  // Get user behavior insights
  getUserInsights() {
    const totalInteractions = this.userBehavior.engagedCount + this.userBehavior.ignoredCount;
    const engagementRate = totalInteractions > 0 
      ? (this.userBehavior.engagedCount / totalInteractions) * 100 
      : 0;

    return {
      engagementRate: Math.round(engagementRate),
      totalEngaged: this.userBehavior.engagedCount,
      totalIgnored: this.userBehavior.ignoredCount,
      preferredTimes: this.userBehavior.preferredTimes,
      activeTimers: this.activeTimers.size,
    };
  }

  // Update user preferences
  updatePreferences(preferences) {
    if (preferences.preferredTimes) {
      this.userBehavior.preferredTimes = preferences.preferredTimes;
    }
  }

  // Clean up old timers
  cleanup() {
    for (const [notificationId, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}

export default new NaturalTimingEngine();
