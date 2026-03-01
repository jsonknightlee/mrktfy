class ProspectorRulesEngine {
  constructor() {
    this.tierConfigs = {
      prospector: {
        radius: 5000, // 5km in meters
        maxDailyNotifications: 5,
        maxHourlyNotifications: 2,
        minMatchScore: 40, // Lowered for testing to show more matches
        features: ['basic_matching', 'location_alerts'],
      },
      investor: {
        radius: 20000, // 20km in meters
        maxDailyNotifications: 20,
        maxHourlyNotifications: 5,
        minMatchScore: 60,
        features: ['basic_matching', 'location_alerts', 'early_alerts', 'price_drops'],
      },
      developer: {
        radius: 50000, // 50km in meters
        maxDailyNotifications: Infinity,
        maxHourlyNotifications: Infinity,
        minMatchScore: 50,
        features: ['basic_matching', 'location_alerts', 'early_alerts', 'price_drops', 'api_access', 'heatmaps'],
      },
    };

    this.userTier = 'prospector';
    this.userFilters = null;
    this.scoringWeights = {
      price_match: 30,
      bedroom_match: 25,
      location_match: 20,
      recency: 15,
      engagement: 10,
    };
  }

  // Initialize with user data
  initialize(userTier = 'prospector', userFilters = {}) {
    this.userTier = userTier;
    this.userFilters = this.normalizeFilters(userFilters);
  }

  // Normalize and validate user filters
  normalizeFilters(filters) {
    return {
      priceMin: filters.priceMin || 0,
      priceMax: filters.priceMax || Infinity,
      bedrooms: filters.bedrooms || null,
      propertyTypes: filters.propertyTypes || [],
      locations: filters.locations || [],
      keywords: filters.keywords || [],
    };
  }

  // Check if listing matches user criteria
  matchesUserCriteria(listing) {
    if (!this.userFilters) return true;

    // Price match
    const price = listing.Price || 0;
    if (price < this.userFilters.priceMin || price > this.userFilters.priceMax) {
      return false;
    }

    // Bedroom match
    if (this.userFilters.bedrooms && listing.Beds) {
      if (listing.Beds !== this.userFilters.bedrooms) {
        return false;
      }
    }

    // Property type match
    if (this.userFilters.propertyTypes.length > 0 && listing.PropertyType) {
      if (!this.userFilters.propertyTypes.includes(listing.PropertyType)) {
        return false;
      }
    }

    // Keywords match
    if (this.userFilters.keywords.length > 0) {
      const searchText = `${listing.Title || ''} ${listing.Description || ''}`.toLowerCase();
      const hasKeyword = this.userFilters.keywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    return true;
  }

  // Calculate match score for a listing
  calculateMatchScore(listing, userLocation = null) {
    let score = 0;

    // Price match (30% weight)
    const price = listing.Price || 0;
    const priceScore = this.calculatePriceScore(price);
    score += priceScore * this.scoringWeights.price_match / 100;

    // Bedroom match (25% weight)
    if (this.userFilters.bedrooms && listing.Beds) {
      const bedroomScore = listing.Beds === this.userFilters.bedrooms ? 100 : 50;
      score += bedroomScore * this.scoringWeights.bedroom_match / 100;
    } else {
      score += 50 * this.scoringWeights.bedroom_match / 100; // Neutral score
    }

    // Location match (20% weight)
    if (userLocation && listing.Latitude && listing.Longitude) {
      const distance = this.calculateDistance(
        userLocation.latitude, 
        userLocation.longitude,
        listing.Latitude, 
        listing.Longitude
      );
      const maxDistance = this.tierConfigs[this.userTier].radius;
      const locationScore = Math.max(0, 100 - (distance / maxDistance) * 100);
      score += locationScore * this.scoringWeights.location_match / 100;
    } else {
      score += 50 * this.scoringWeights.location_match / 100;
    }

    // Recency (15% weight)
    const recencyScore = this.calculateRecencyScore(listing.ListingDate || listing.CreatedAt);
    score += recencyScore * this.scoringWeights.recency / 100;

    // Engagement (10% weight)
    const engagementScore = this.calculateEngagementScore(listing);
    score += engagementScore * this.scoringWeights.engagement / 100;

    return Math.round(score);
  }

  // Calculate price match score
  calculatePriceScore(price) {
    if (!this.userFilters || !this.userFilters.priceMax) return 50;

    // Handle price strings like "£650,000"
    let numericPrice = price;
    if (typeof price === 'string') {
      numericPrice = parseInt(price.replace(/[^0-9]/g, '')) || 0;
    }

    const range = this.userFilters.priceMax - this.userFilters.priceMin;
    const midpoint = this.userFilters.priceMin + (range / 2);
    
    // Perfect score at midpoint, decreasing towards edges
    const deviation = Math.abs(numericPrice - midpoint);
    const maxDeviation = range / 2;
    
    return Math.max(0, 100 - (deviation / maxDeviation) * 100);
  }

  // Calculate recency score (newer is better)
  calculateRecencyScore(listingDate) {
    if (!listingDate) return 50;

    const now = new Date();
    const listing = new Date(listingDate);
    const daysDiff = (now - listing) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 1) return 100; // Today
    if (daysDiff <= 3) return 90;  // Last 3 days
    if (daysDiff <= 7) return 80;  // Last week
    if (daysDiff <= 14) return 60; // Last 2 weeks
    if (daysDiff <= 30) return 40; // Last month
    
    return 20; // Older than 1 month
  }

  // Calculate engagement score based on other users' activity
  calculateEngagementScore(listing) {
    // This would typically come from your backend analytics
    // For now, we'll simulate with available data
    let score = 50; // Base score

    if (listing.ViewCount) {
      // More views = higher engagement
      const views = parseInt(listing.ViewCount) || 0;
      score += Math.min(30, views / 10);
    }

    if (listing.SavedCount) {
      // More saves = higher engagement
      const saves = parseInt(listing.SavedCount) || 0;
      score += Math.min(20, saves * 5);
    }

    return Math.min(100, score);
  }

  // Filter and score listings based on user criteria
  filterAndScoreListings(listings, userLocation = null) {
    const config = this.tierConfigs[this.userTier];
    
    return listings
      .filter(listing => this.matchesUserCriteria(listing))
      .map(listing => ({
        ...listing,
        matchScore: this.calculateMatchScore(listing, userLocation),
      }))
      .filter(listing => listing.matchScore >= config.minMatchScore)
      .sort((a, b) => b.matchScore - a.matchScore); // Highest score first
  }

  // Check if listing is within user's radius
  isWithinRadius(listing, userLocation) {
    if (!userLocation || !listing.Latitude || !listing.Longitude) {
      return false;
    }

    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      listing.Latitude,
      listing.Longitude
    );

    const maxRadius = this.tierConfigs[this.userTier].radius;
    return distance <= maxRadius;
  }

  // Calculate distance between two points
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

  // Get tier configuration
  getTierConfig() {
    return this.tierConfigs[this.userTier];
  }

  // Update user tier
  updateTier(newTier) {
    if (this.tierConfigs[newTier]) {
      this.userTier = newTier;
    }
  }

  // Update user filters
  updateFilters(newFilters) {
    this.userFilters = this.normalizeFilters(newFilters);
  }

  // Check if feature is available for current tier
  hasFeature(feature) {
    const config = this.tierConfigs[this.userTier];
    return config && config.features.includes(feature);
  }

  // Get radius for current tier
  getRadius() {
    return this.tierConfigs[this.userTier].radius;
  }

  // Get minimum match score for current tier
  getMinMatchScore() {
    return this.tierConfigs[this.userTier].minMatchScore;
  }

  // Get notification limits for current tier
  getNotificationLimits() {
    const config = this.tierConfigs[this.userTier];
    return {
      maxDaily: config.maxDailyNotifications,
      maxHourly: config.maxHourlyNotifications,
    };
  }
}

export default new ProspectorRulesEngine();
