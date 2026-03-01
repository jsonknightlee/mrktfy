import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationThrottler from './NotificationThrottler';
import NotificationService from './NotificationService';
import NotificationStorageService from './NotificationStorageService';
import ProspectorRulesEngine from './ProspectorRulesEngine';
import NaturalTimingEngine from './NaturalTimingEngine';

class LocationTriggerEngine {
  constructor() {
    this.lastKnownLocation = null;
    this.lastNotificationTime = null;
    this.dailyNotificationCount = 0;
    this.isTracking = false;
    this.dwellTimer = null;
    this.movementThreshold = 500; // 500 meters minimum movement
    this.dwellTimeThreshold = 180000; // 3 minutes in milliseconds
    this.maxSpeedThreshold = 2.5; // m/s - walking speed
  }

  // Initialize location tracking
  async initialize() {
    try {
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        console.warn('Location services are disabled on device');
        return false;
      }

      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return false;
      }

      // Request background permission for continuous tracking
      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('Background location permission denied - alerts will only work when app is active');
        }
      } catch (backgroundError) {
        console.warn('Background location permission not available:', backgroundError.message);
      }

      // Load stored state
      await this.loadStoredState();
      
      // Start location tracking
      this.startLocationTracking();
      
      console.log('✅ LocationTriggerEngine initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ LocationTriggerEngine initialization failed:', error.message);
      return false;
    }
  }

  // Load stored state from AsyncStorage
  async loadStoredState() {
    try {
      const stored = await AsyncStorage.getItem('locationTriggerState');
      if (stored) {
        const state = JSON.parse(stored);
        this.lastKnownLocation = state.lastKnownLocation;
        this.lastNotificationTime = state.lastNotificationTime;
        this.dailyNotificationCount = state.dailyNotificationCount || 0;
        
        // Reset daily count if it's a new day
        const today = new Date().toDateString();
        if (state.lastDate !== today) {
          this.dailyNotificationCount = 0;
        }
      }
    } catch (error) {
      console.error('Failed to load stored state:', error);
    }
  }

  // Save current state to AsyncStorage
  async saveState() {
    try {
      const state = {
        lastKnownLocation: this.lastKnownLocation,
        lastNotificationTime: this.lastNotificationTime,
        dailyNotificationCount: this.dailyNotificationCount,
        lastDate: new Date().toDateString()
      };
      await AsyncStorage.setItem('locationTriggerState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  // Start location tracking
  startLocationTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    
    // Watch for location changes
    this.locationWatcher = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 300000, // 5 minutes
        distanceInterval: this.movementThreshold, // 500 meters
      },
      this.handleLocationUpdate.bind(this)
    );
  }

  // Stop location tracking
  async stopTracking() {
    this.isTracking = false;
    if (this.locationWatcher) {
      await this.locationWatcher.remove();
    }
    if (this.dwellTimer) {
      clearTimeout(this.dwellTimer);
    }
  }

  // Handle location updates
  async handleLocationUpdate(location) {
    const { latitude, longitude, speed } = location.coords;
    const currentLocation = { latitude, longitude, timestamp: Date.now() };

    // Check if user is moving (not stationary)
    const isMoving = speed > this.maxSpeedThreshold;

    if (isMoving) {
      // Clear any existing dwell timer if user is moving
      if (this.dwellTimer) {
        clearTimeout(this.dwellTimer);
        this.dwellTimer = null;
      }

      // Check for significant movement
      if (this.hasSignificantMovement(currentLocation)) {
        await this.checkHotZoneTrigger(currentLocation);
      }
    } else {
      // User is stationary, start dwell timer
      if (!this.dwellTimer) {
        this.dwellTimer = setTimeout(() => {
          this.checkDwellTrigger(currentLocation);
        }, this.dwellTimeThreshold);
      }
    }

    this.lastKnownLocation = currentLocation;
    await this.saveState();
  }

  // Check if movement is significant enough
  hasSignificantMovement(newLocation) {
    if (!this.lastKnownLocation) return true;

    const distance = this.calculateDistance(
      this.lastKnownLocation.latitude,
      this.lastKnownLocation.longitude,
      newLocation.latitude,
      newLocation.longitude
    );

    return distance >= this.movementThreshold;
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Check for hot zone trigger (user enters new area with listings)
  async checkHotZoneTrigger(location) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/location/check-hot-zone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_API_KEY,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          radius: 5000, // 5km for Prospector tier
          lastKnownLocation: this.lastKnownLocation,
        }),
      });

      // Check if response is valid JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Hot zone check: Non-JSON response received');
        return;
      }

      const data = await response.json();
      
      if (data.shouldNotify && data.listings) {
        await this.triggerNotification(data.listings, 'hot_zone');
      }
    } catch (error) {
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('Hot zone check: Invalid JSON response - API may not be available');
      } else {
        console.error('Hot zone check failed:', error);
      }
    }
  }

  // Check for dwell trigger (user stays in area)
  async checkDwellTrigger(location) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/location/check-dwell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_API_KEY,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          radius: 5000,
        }),
      });

      // Check if response is valid JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Dwell check: Non-JSON response received');
        return;
      }

      const data = await response.json();
      
      if (data.shouldNotify && data.listings) {
        await this.triggerNotification(data.listings, 'dwell');
      }
    } catch (error) {
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('Dwell check: Invalid JSON response - API may not be available');
      } else {
        console.error('Dwell check failed:', error);
      }
    }
  }

  // Trigger notification with throttling
  async triggerNotification(listings, triggerType) {
    // Check throttling rules
    if (!this.canSendNotification()) {
      console.log('Notification throttled');
      return false;
    }

    try {
      // Send notification via your notification service
      await this.sendPushNotification(listings, triggerType);
      
      // Update tracking
      this.lastNotificationTime = Date.now();
      this.dailyNotificationCount++;
      await this.saveState();
      
      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // Check if notification can be sent based on throttling rules
  canSendNotification() {
    const now = Date.now();
    
    // Check minimum cooldown (15 minutes)
    if (this.lastNotificationTime) {
      const timeSinceLastNotification = now - this.lastNotificationTime;
      if (timeSinceLastNotification < 15 * 60 * 1000) { // 15 minutes
        return false;
      }
    }

    // Check daily limit (5 per day for Prospector)
    if (this.dailyNotificationCount >= 5) {
      return false;
    }

    return true;
  }

  // Send push notification
  async sendPushNotification(listings, triggerType) {
    try {
      // Use Natural Timing Engine to determine optimal send time
      const timingStrategy = NaturalTimingEngine.getOptimalTiming(triggerType, listings.length);
      
      if (timingStrategy.shouldDelay) {
        // Schedule delayed notification
        const delay = timingStrategy.delayMs;
        console.log(`⏰ Scheduling ${triggerType} notification with ${delay}ms delay`);
        
        setTimeout(async () => {
          await this.executeNotification(listings, triggerType);
        }, delay);
        
        return true; // Scheduled successfully
      } else {
        // Send immediately
        return await this.executeNotification(listings, triggerType);
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  // Execute the actual notification sending
  async executeNotification(listings, triggerType) {
    try {
      // Create notification content
      const { title, body } = NotificationService.createPropertyNotification(
        listings, 
        triggerType, 
        this.lastKnownLocation
      );

      // Send push notification
      const notificationSent = await NotificationService.sendPropertyNotification(
        listings, 
        triggerType, 
        this.lastKnownLocation
      );

      if (notificationSent) {
        // Save notification to storage
        await NotificationStorageService.saveNotification({
          type: 'property_alert',
          triggerType,
          title,
          body,
          listings,
          listingIds: listings.map(l => l.ID),
          data: {
            type: 'property_alert',
            triggerType,
            listingIds: listings.map(l => l.ID),
            timestamp: Date.now(),
            userLocation: this.lastKnownLocation,
          },
        });

        // Update Natural Timing Engine with engagement data
        NaturalTimingEngine.recordNotificationSent(triggerType, listings.length);

        console.log(`📱 ${triggerType} notification sent and saved: ${title}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to execute notification:', error);
      return false;
    }
  }
}

export default new LocationTriggerEngine();
