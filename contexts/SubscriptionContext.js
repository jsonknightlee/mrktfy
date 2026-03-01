import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Real plan configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: '£0',
    period: '/month',
    description: 'Basic property search with limited features',
    features: [
      '✅ Search up to 10 properties',
      '✅ Basic map view',
      '✅ Save up to 10 properties',
      '✅ Limited notifications',
    ],
    color: '#666',
    limits: {
      savedSearchesMax: 5,
      alertsEnabled: false,
      refreshPriority: 'normal',
      notificationsPerMonth: 5,
      arSearchesPerMonth: 10,
    },
  },
  prospector: {
    id: 'prospector',
    name: 'Prospector',
    tagline: 'Find deals before others do',
    bestFor: 'Active house-hunting',
    prices: {
      month: { amount: 999, display: '£9.99' },
      year: { amount: 9999, display: '£99.99', subtext: '2 months free' }
    },
    trial: {
      enabled: true,
      durationDays: 7,
      isDefaultEntryPoint: true
    },
    features: [
      'Advanced filters',
      'Saved searches',
      'Unlimited favourites',
      'Price-drop alerts',
      'Faster listing refresh',
      'Enhanced AR highlights'
    ],
    limits: {
      savedSearchesMax: 20,
      alertsEnabled: true,
      refreshPriority: 'high',
      notificationsPerMonth: 100,
      arSearchesPerMonth: 50,
    },
    color: '#007AFF',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    tagline: 'Track, analyse, and act at scale',
    bestFor: 'Deal hunters & landlords',
    prices: {
      month: { amount: 2999, display: '£29.99' },
      year: { amount: 29999, display: '£299.99', subtext: '2 months free' }
    },
    features: [
      'Multi-area tracking',
      'Watchlists & collections',
      'Stronger deal signals',
      'Priority listing refresh',
      'Export & sharing tools',
      'Investor analytics (rolling out)'
    ],
    limits: {
      savedSearchesMax: 200,
      alertsEnabled: true,
      refreshPriority: 'priority',
      notificationsPerMonth: 500,
      arSearchesPerMonth: 200,
    },
    color: '#10B981',
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    tagline: 'Build, scale, and automate',
    bestFor: 'Builders, agencies & large portfolios',
    isAvailable: false,
    prices: {
      month: { amount: 4999, display: '£49.99', subtext: 'Coming soon' },
      year: { amount: 49999, display: '£499.99', subtext: 'Coming soon' }
    },
    features: [
      'Bulk area & land tracking',
      'Planning & zoning overlays',
      'Development opportunity signals',
      'Multi-user access',
      'Advanced reporting & exports',
      'API access (planned)'
    ],
    limits: {
      alertsEnabled: true,
      refreshPriority: 'max',
      notificationsPerMonth: 'Unlimited',
      arSearchesPerMonth: 'Unlimited',
    },
    color: '#6366F1',
  },
};

// Action types
const SUBSCRIPTION_ACTIONS = {
  SET_SUBSCRIPTION: 'SET_SUBSCRIPTION',
  UPDATE_USAGE: 'UPDATE_USAGE',
  CLEAR_USAGE: 'CLEAR_USAGE',
};

// Initial state
const initialState = {
  currentTier: SUBSCRIPTION_PLANS.free.id,
  usage: {
    propertiesSearched: 0,
    propertiesSaved: 0,
    notificationsSent: 0,
    lastReset: new Date().toISOString(),
  },
  subscriptionStart: null,
  subscriptionEnd: null,
  isCancelled: false,
};

// Reducer
function subscriptionReducer(state, action) {
  switch (action.type) {
    case SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION:
      return {
        ...state,
        currentTier: action.payload.tier,
        subscriptionStart: action.payload.startDate,
        subscriptionEnd: action.payload.endDate,
        isCancelled: false,
      };
    
    case SUBSCRIPTION_ACTIONS.UPDATE_USAGE:
      return {
        ...state,
        usage: {
          ...state.usage,
          ...action.payload,
        },
      };
    
    case SUBSCRIPTION_ACTIONS.CLEAR_USAGE:
      return {
        ...state,
        usage: {
          propertiesSearched: 0,
          propertiesSaved: 0,
          notificationsSent: 0,
          lastReset: new Date().toISOString(),
        },
      };
    
    default:
      return state;
  }
}

// Create context
const SubscriptionContext = createContext();

// Provider component
export function SubscriptionProvider({ children }) {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);

  // Load subscription from AsyncStorage on mount
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const stored = await AsyncStorage.getItem('subscription');
        if (stored) {
          const subscription = JSON.parse(stored);
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
            payload: subscription,
          });
        }
      } catch (error) {
        console.error('Failed to load subscription:', error);
      }
    };

    loadSubscription();
  }, []);

  // Save subscription to AsyncStorage whenever it changes
  useEffect(() => {
    const saveSubscription = async () => {
      try {
        await AsyncStorage.setItem(
          'subscription',
          JSON.stringify({
            tier: state.currentTier,
            startDate: state.subscriptionStart,
            endDate: state.subscriptionEnd,
          })
        );
      } catch (error) {
        console.error('Failed to save subscription:', error);
      }
    };

    saveSubscription();
  }, [state.currentTier, state.subscriptionStart, state.subscriptionEnd]);

  const value = {
    ...state,
    dispatch,
    plans: SUBSCRIPTION_PLANS,
    // Helper functions
    upgradeTier: (tierId) => {
      const tier = SUBSCRIPTION_PLANS[tierId];
      if (tier) {
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
          payload: {
            tier: tierId,
            startDate: new Date().toISOString(),
            endDate: null,
          },
        });
        return true;
      }
      return false;
    },
    cancelSubscription: () => {
      dispatch({
        type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
        payload: {
          tier: SUBSCRIPTION_PLANS.free.id,
          startDate: null,
          endDate: new Date().toISOString(),
        },
      });
    },
    trackUsage: (usageData) => {
      dispatch({
        type: SUBSCRIPTION_ACTIONS.UPDATE_USAGE,
        payload: usageData,
      });
    },
    resetUsage: () => {
      dispatch({ type: SUBSCRIPTION_ACTIONS.CLEAR_USAGE });
    },
    isWithinLimits: (action, count = 1) => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      if (!tier || !tier.limits) return true;
      
      const limitKey = {
        propertiesSearched: 'arSearchesPerMonth',
        propertiesSaved: 'savedSearchesMax',
        notificationsSent: 'notificationsPerMonth',
      }[action];
      
      const limit = tier.limits[limitKey];
      return limit === 'Unlimited' || limit === -1 || count <= limit;
    },
    // Subscription-based feature controls
    getMaxSearchRadius: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      const radiusLimits = {
        free: 2,    // 2km radius for free users
        prospector: 5, // 5km radius for prospector
        investor: 10, // 10km radius for investor
        developer: 20, // 20km radius for developer
      };
      return radiusLimits[state.currentTier] || 2;
    },
    getMaxNotifications: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      return tier?.limits?.notificationsPerMonth || 5;
    },
    getMaxSavedSearches: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      return tier?.limits?.savedSearchesMax || 5;
    },
    getMaxARSearches: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      return tier?.limits?.arSearchesPerMonth || 10;
    },
    getRefreshPriority: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      return tier?.limits?.refreshPriority || 'normal';
    },
    hasAlertsEnabled: () => {
      const tier = SUBSCRIPTION_PLANS[state.currentTier];
      return tier?.limits?.alertsEnabled || false;
    },
    // Mock current subscription for testing
    mockSubscription: (tierId) => {
      console.log('🔄 Mock subscription called with tier:', tierId);
      dispatch({
        type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
        payload: {
          tier: tierId,
          startDate: new Date().toISOString(),
          endDate: null,
        },
      });
      console.log('✅ Mock subscription completed for tier:', tierId);
    },
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Hook to use the context
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
