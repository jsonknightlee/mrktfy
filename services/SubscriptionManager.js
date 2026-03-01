import AsyncStorage from '@react-native-async-storage/async-storage';

class SubscriptionManager {
  constructor() {
    this.tiers = {
      prospector: {
        id: 'prospector',
        name: 'Prospector',
        price: 9.99,
        billing: 'monthly',
        features: {
          radius: 5000, // 5km
          maxDailyNotifications: 5,
          maxHourlyNotifications: 2,
          minMatchScore: 75,
          realTimeAlerts: true,
          priceDropAlerts: false,
          earlyAccess: false,
          apiAccess: false,
          heatmaps: false,
          advancedFilters: false,
        },
        description: 'Perfect for property hunters starting their search',
        popular: true,
      },
      investor: {
        id: 'investor',
        name: 'Investor',
        price: 29.99,
        billing: 'monthly',
        features: {
          radius: 20000, // 20km
          maxDailyNotifications: 20,
          maxHourlyNotifications: 5,
          minMatchScore: 60,
          realTimeAlerts: true,
          priceDropAlerts: true,
          earlyAccess: true,
          apiAccess: false,
          heatmaps: false,
          advancedFilters: true,
        },
        description: 'For serious investors and property professionals',
        popular: false,
      },
      developer: {
        id: 'developer',
        name: 'Developer',
        price: 99.99,
        billing: 'monthly',
        features: {
          radius: 50000, // 50km
          maxDailyNotifications: Infinity,
          maxHourlyNotifications: Infinity,
          minMatchScore: 50,
          realTimeAlerts: true,
          priceDropAlerts: true,
          earlyAccess: true,
          apiAccess: true,
          heatmaps: true,
          advancedFilters: true,
        },
        description: 'For developers and agencies with API needs',
        popular: false,
      },
    };

    this.currentSubscription = null;
    this.trialStatus = null;
    this.usage = {
      notificationsSentToday: 0,
      notificationsSentThisHour: 0,
      lastResetTime: Date.now(),
    };
  }

  // Initialize subscription manager
  async initialize() {
    await this.loadSubscriptionData();
    await this.loadUsageData();
    this.resetUsageIfNeeded();
  }

  // Load subscription data from storage
  async loadSubscriptionData() {
    try {
      const stored = await AsyncStorage.getItem('subscriptionData');
      if (stored) {
        const data = JSON.parse(stored);
        this.currentSubscription = data.currentSubscription;
        this.trialStatus = data.trialStatus;
      }

      // Check for trial expiration
      if (this.trialStatus && this.trialStatus.expiresAt) {
        if (Date.now() > this.trialStatus.expiresAt) {
          this.trialStatus = null;
          await this.saveSubscriptionData();
        }
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    }
  }

  // Save subscription data to storage
  async saveSubscriptionData() {
    try {
      const data = {
        currentSubscription: this.currentSubscription,
        trialStatus: this.trialStatus,
      };
      await AsyncStorage.setItem('subscriptionData', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save subscription data:', error);
    }
  }

  // Load usage data from storage
  async loadUsageData() {
    try {
      const stored = await AsyncStorage.getItem('subscriptionUsage');
      if (stored) {
        this.usage = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    }
  }

  // Save usage data to storage
  async saveUsageData() {
    try {
      await AsyncStorage.setItem('subscriptionUsage', JSON.stringify(this.usage));
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  // Reset usage counters if needed (daily/hourly)
  resetUsageIfNeeded() {
    const now = Date.now();
    const lastReset = this.usage.lastResetTime;
    
    // Reset hourly counter
    if (now - lastReset > 60 * 60 * 1000) { // 1 hour
      this.usage.notificationsSentThisHour = 0;
    }
    
    // Reset daily counter
    const today = new Date().toDateString();
    const lastResetDate = new Date(lastReset).toDateString();
    
    if (today !== lastResetDate) {
      this.usage.notificationsSentToday = 0;
      this.usage.notificationsSentThisHour = 0;
      this.usage.lastResetTime = now;
    }
  }

  // Start free trial
  async startTrial() {
    if (this.trialStatus) {
      throw new Error('Trial already active');
    }

    this.trialStatus = {
      tier: 'prospector',
      startedAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
    };

    this.currentSubscription = {
      tier: 'prospector',
      isTrial: true,
      startedAt: this.trialStatus.startedAt,
    };

    await this.saveSubscriptionData();
    return this.trialStatus;
  }

  // Upgrade subscription
  async upgradeTier(tierId) {
    if (!this.tiers[tierId]) {
      throw new Error('Invalid tier');
    }

    // This would typically integrate with your payment provider
    // For now, we'll simulate the upgrade
    this.currentSubscription = {
      tier: tierId,
      isTrial: false,
      startedAt: Date.now(),
      billingCycle: 'monthly',
    };

    this.trialStatus = null; // Cancel trial if upgrading
    await this.saveSubscriptionData();
    
    return this.currentSubscription;
  }

  // Check if user can send notification
  canSendNotification() {
    this.resetUsageIfNeeded();

    if (!this.currentSubscription) {
      return { allowed: false, reason: 'no_subscription' };
    }

    const tier = this.tiers[this.currentSubscription.tier];
    const features = tier.features;

    // Check daily limit
    if (this.usage.notificationsSentToday >= features.maxDailyNotifications) {
      return { allowed: false, reason: 'daily_limit_exceeded' };
    }

    // Check hourly limit
    if (this.usage.notificationsSentThisHour >= features.maxHourlyNotifications) {
      return { allowed: false, reason: 'hourly_limit_exceeded' };
    }

    return { allowed: true };
  }

  // Record notification sent
  async recordNotificationSent() {
    this.resetUsageIfNeeded();
    
    this.usage.notificationsSentToday++;
    this.usage.notificationsSentThisHour++;
    await this.saveUsageData();
  }

  // Get current tier features
  getCurrentTierFeatures() {
    if (!this.currentSubscription) {
      return null;
    }

    const tierId = this.currentSubscription.tier;
    return {
      ...this.tiers[tierId],
      isTrial: this.currentSubscription.isTrial || false,
    };
  }

  // Check if feature is available
  hasFeature(feature) {
    if (!this.currentSubscription) {
      return false;
    }

    const tier = this.tiers[this.currentSubscription.tier];
    return tier.features[feature] === true;
  }

  // Get available tiers
  getAvailableTiers() {
    return Object.values(this.tiers);
  }

  // Get subscription status
  getSubscriptionStatus() {
    const isTrial = this.currentSubscription?.isTrial || false;
    const trialDaysLeft = this.trialStatus 
      ? Math.ceil((this.trialStatus.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      isActive: !!this.currentSubscription,
      tier: this.currentSubscription?.tier || null,
      isTrial,
      trialDaysLeft: isTrial ? Math.max(0, trialDaysLeft) : 0,
      trialExpiresAt: this.trialStatus?.expiresAt || null,
      features: this.getCurrentTierFeatures(),
      usage: {
        ...this.usage,
        dailyLimit: this.tiers[this.currentSubscription?.tier]?.features.maxDailyNotifications || 0,
        hourlyLimit: this.tiers[this.currentSubscription?.tier]?.features.maxHourlyNotifications || 0,
      },
    };
  }

  // Get upgrade suggestions
  getUpgradeSuggestions() {
    if (!this.currentSubscription) {
      return {
        suggestedTier: 'prospector',
        reason: 'Start with a free trial to unlock location-based alerts',
        urgency: 'high',
      };
    }

    const currentTierId = this.currentSubscription.tier;
    const currentTier = this.tiers[currentTierId];
    
    // Check if user is hitting limits
    const usageRatio = this.usage.notificationsSentToday / currentTier.features.maxDailyNotifications;
    
    if (usageRatio > 0.8) {
      if (currentTierId === 'prospector') {
        return {
          suggestedTier: 'investor',
          reason: 'You\'re using 80% of your daily notifications. Upgrade for more alerts and price drop notifications.',
          urgency: 'medium',
        };
      } else if (currentTierId === 'investor') {
        return {
          suggestedTier: 'developer',
          reason: 'Maximize your property search with unlimited notifications and API access.',
          urgency: 'low',
        };
      }
    }

    return null;
  }

  // Cancel subscription
  async cancelSubscription() {
    // This would integrate with your payment provider
    // For now, we'll just clear the local data
    this.currentSubscription = null;
    this.trialStatus = null;
    await this.saveSubscriptionData();
  }

  // Get billing information
  getBillingInfo() {
    if (!this.currentSubscription) {
      return null;
    }

    const tier = this.tiers[this.currentSubscription.tier];
    return {
      nextBillingDate: this.getNextBillingDate(),
      amount: tier.price,
      currency: 'GBP',
      billingCycle: tier.billing,
      tier: tier.name,
    };
  }

  // Calculate next billing date
  getNextBillingDate() {
    if (!this.currentSubscription) {
      return null;
    }

    const startedAt = this.currentSubscription.startedAt;
    const nextBilling = new Date(startedAt);
    
    // Add one month (simplified)
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    
    return nextBilling;
  }

  // Export subscription data for backup
  exportData() {
    return {
      currentSubscription: this.currentSubscription,
      trialStatus: this.trialStatus,
      usage: this.usage,
      exportedAt: Date.now(),
    };
  }

  // Import subscription data
  async importData(data) {
    this.currentSubscription = data.currentSubscription;
    this.trialStatus = data.trialStatus;
    this.usage = data.usage;
    
    await this.saveSubscriptionData();
    await this.saveUsageData();
  }
}

export default new SubscriptionManager();
