import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState } from 'react-native';
import { databaseService } from '../services/databaseService';
import { getToken, deleteToken } from '../services/authService';
import { AuthContext } from './AuthContext';
import { cancelStripeSubscription, reactivateStripeSubscription } from '../services/paymentService';

// Helper function to get subscription price
const getSubscriptionPrice = (tierId) => {
  const prices = {
    'free': 0,
    'prospector': 9.99,
    'investor': 29.99,
    'developer': 49.99
  };
  return prices[tierId] || 0;
};

// AsyncStorage keys
const STORAGE_KEYS = {
  SUBSCRIPTION_TIER: 'subscription_tier',
  SUBSCRIPTION_START_DATE: 'subscription_start_date',
  SUBSCRIPTION_END_DATE: 'subscription_end_date',
  SUBSCRIPTION_IS_CANCELLED: 'subscription_is_cancelled',
  TRIAL_START_DATE: 'trial_start_date',
  TRIAL_END_DATE: 'trial_end_date',
  IS_IN_TRIAL: 'is_in_trial',
  AUTO_RENEW: 'subscription_auto_renew',
};

const defaultSubscriptionState = {
  tier: 'free',
  startDate: null,
  endDate: null,
  isCancelled: false,
  trialStartDate: null,
  trialEndDate: null,
  isInTrial: false,
  autoRenew: false,
};

const clearSubscriptionStorage = async () => {
  try {
    await AsyncStorage.multiRemove([...Object.values(STORAGE_KEYS), 'user-profile']);
    console.log('🧹 [SUBSCRIPTION] Cleared subscription AsyncStorage; database is source of truth');
  } catch (error) {
    console.error('Failed to clear subscription AsyncStorage:', error);
  }
};

// Subscription state is server-authoritative. Keep this helper as a compatibility
// no-op for existing call sites, but remove any stale cached tier values.
const saveSubscriptionState = async () => {
  await clearSubscriptionStorage();
};

const loadSubscriptionState = async () => {
  try {
    await clearSubscriptionStorage();
    console.log('📖 [SUBSCRIPTION] Skipping subscription AsyncStorage load; using database/default state');
    return defaultSubscriptionState;
  } catch (error) {
    console.error('Failed to load subscription state:', error);
    return defaultSubscriptionState;
  }
};

const isProfileInTrial = (userProfile) => {
  const explicitTrial = userProfile?.IsInTrial ?? userProfile?.isInTrial;
  if (explicitTrial != null) return Boolean(explicitTrial);

  const subscriptionStatus = userProfile?.SubscriptionStatus || userProfile?.subscriptionStatus;
  if (String(subscriptionStatus || '').toLowerCase() === 'trialing') return true;

  const trialEndDate = userProfile?.TrialEndDate || userProfile?.trialEndDate;
  return trialEndDate ? new Date(trialEndDate) > new Date() : false;
};

// Check subscription validity and handle expiration
const checkSubscriptionValidity = async (subscriptionState) => {
  const { tier, endDate, autoRenew } = subscriptionState;
  
  if (tier === 'free') {
    return subscriptionState; // Free tier doesn't expire
  }
  
  if (endDate) {
    const now = new Date();
    const expirationDate = new Date(endDate);
    
    console.log('📅 [SUBSCRIPTION] Checking subscription validity:', {
      currentTier: tier,
      endDate: endDate,
      expirationDate: expirationDate.toISOString(),
      now: now.toISOString(),
      autoRenew: autoRenew,
      isExpired: now > expirationDate
    });
    
    if (now > expirationDate) {
      // Subscription has expired
      console.log('⏰ [SUBSCRIPTION] Subscription expired, reverting to free tier');
      
      // Update database to free tier
      try {
        const token = await getToken();
        if (token) {
          await databaseService.updateUserSubscription({
            SubscriptionLevelID: 'free',
            SubscriptionStartDate: now.toISOString(),
            SubscriptionEndDate: null,
            IsSubscriptionActive: true,
            AutoRenew: false
          });
        }
      } catch (error) {
        console.error('❌ [SUBSCRIPTION] Failed to update expired subscription in database:', error);
      }
      
      await clearSubscriptionStorage();
      
      // Return updated state
      return {
        ...subscriptionState,
        tier: 'free',
        startDate: now.toISOString(),
        endDate: null,
        isCancelled: false,
        autoRenew: false
      };
    }
  }
  
  return subscriptionState;
};

// Real plan configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: '£0',
    period: '/month',
    tagline: 'Discover properties around you and start your property journey.',
    bestFor: 'Casual browsing and first-time users.',
    description: 'Discover properties around you and start your property journey.',
    features: [
      'Browse nearby properties',
      'Search a location',
      'Interactive map',
      'Basic property filters',
      'Save up to 10 favourite properties',
      '1 Property Deck',
      '1 Shortlist',
      '1 Decision Board',
      'Basic property details',
      'Basic property notifications',
      'Preview premium features throughout the app',
    ],
    color: '#666',
    searchRadiusKm: 2,
    limits: {
      savedSearchesMax: 5,
      alertsEnabled: false,
      refreshPriority: 'normal',
      notificationsPerMonth: 5,
      arSearchesPerMonth: 10,
      adsEnabled: true,
      adsFrequency: 'always',
      propertyDecksMax: 1,
      shortlistsMax: 1,
      decisionBoardsMax: 1,
      decisionBoardPropertiesMax: 10,
      buyerWorkspaceItemsMax: 0,
    },
  },
  prospector: {
    id: 'prospector',
    name: 'Buyer',
    tagline: 'Everything you need to organise your home buying journey.',
    bestFor: 'Home buyers actively searching for their next home.',
    prices: {
      month: { amount: 999, display: '£9.99' },
      year: { amount: 9999, display: '£99.99', subtext: '2 months free' }
    },
    trial: {
      enabled: true,
      durationDays: 14,
      isDefaultEntryPoint: true
    },
    features: [
      'Everything in Free',
      'Unlimited Property Decks',
      'Unlimited Shortlists',
      'Decision Boards',
      'Buyer Workspace',
      'Up to 10 active properties per Decision Board',
      'AI Property Ranking',
      'Your Fit Ranking',
      'Property Comparison Board',
      'Viewing Timeline',
      'Viewing Notes',
      'Estate Agent Management',
      'Mortgage Broker Tracking',
      'Property Media & Documents',
      'Buying Checklists',
      'AI Buying Assistant',
      'Price Drop Alerts',
      'Ad-free experience'
    ],
    searchRadiusKm: 5,
    limits: {
      savedSearchesMax: 20,
      alertsEnabled: true,
      refreshPriority: 'high',
      notificationsPerMonth: 100,
      arSearchesPerMonth: 50,
      adsEnabled: false,
      adsFrequency: 'never',
      propertyDecksMax: 'Unlimited',
      shortlistsMax: 'Unlimited',
      decisionBoardsMax: 1,
      decisionBoardPropertiesMax: 10,
      buyerWorkspaceItemsMax: 1,
    },
    color: '#007AFF',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    tagline: 'Analyse opportunities and grow your portfolio.',
    bestFor: 'Property investors and landlords.',
    prices: {
      month: { amount: 2999, display: '£29.99' },
      year: { amount: 29999, display: '£299.99', subtext: '2 months free' }
    },
    trial: {
      enabled: true,
      durationDays: 14,
    },
    features: [
      'Everything in Buyer',
      'Multiple active Decision Boards',
      'Up to 20 properties per Decision Board',
      'Multiple Buyer Workspaces',
      'Investment Rankings',
      'Yield Estimates',
      'Comparable Property Analysis',
      'Rental Market Insights',
      'Growth Potential Scores',
      'Priority listing refresh',
      'Investor analytics (rolling out)'
    ],
    searchRadiusKm: 10,
    limits: {
      savedSearchesMax: 200,
      alertsEnabled: true,
      refreshPriority: 'priority',
      notificationsPerMonth: 500,
      arSearchesPerMonth: 200,
      adsEnabled: false,
      adsFrequency: 'never',
      propertyDecksMax: 'Unlimited',
      shortlistsMax: 'Unlimited',
      decisionBoardPropertiesMax: 20,
      buyerWorkspaceItemsMax: 5,
    },
    color: '#10B981',
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    tagline: 'Identify and manage development opportunities.',
    bestFor: 'Developers, builders and professional property businesses.',
    isAvailable: false,
    prices: {
      month: { amount: 4999, display: '£49.99', subtext: 'Coming soon' },
      year: { amount: 49999, display: '£499.99', subtext: 'Coming soon' }
    },
    features: [
      'Everything in Investor',
      'Planning Intelligence',
      'Development Opportunity Detection',
      'Land & Site Analysis',
      'Price per Sq Ft Intelligence',
      'GDV Tools',
      'Multi-user Collaboration',
      'Advanced Reporting',
      'Data Export',
      'API access (planned)'
    ],
    searchRadiusKm: 20,
    limits: {
      savedSearchesMax: 1000,
      alertsEnabled: true,
      refreshPriority: 'max',
      notificationsPerMonth: 'unlimited',
      arSearchesPerMonth: 'unlimited',
      adsEnabled: false,
      adsFrequency: 'never',
    },
    color: '#6366F1',
  },
};

// Action types
const SUBSCRIPTION_ACTIONS = {
  SET_SUBSCRIPTION: 'SET_SUBSCRIPTION',
  SET_USER_PROFILE: 'SET_USER_PROFILE',
  SET_SUBSCRIPTION_LEVELS: 'SET_SUBSCRIPTION_LEVELS',
  UPDATE_USAGE: 'UPDATE_USAGE',
  CLEAR_USAGE: 'CLEAR_USAGE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_TRIAL: 'SET_TRIAL',
};

// Initial state
const initialState = {
  currentTier: 'free',
  startDate: null,
  endDate: null,
  isCancelled: false,
  trialStartDate: null,
  trialEndDate: null,
  isInTrial: false,
  autoRenew: false,
  subscriptionLevels: [],
  userProfile: null,
  loading: false,
  error: null,
};

// Reducer
function subscriptionReducer(state, action) {
  switch (action.type) {
    case SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION:
      // Subscription state is server-authoritative. Do not persist tier/trial
      // values locally because Stripe/backend changes must win.
      return {
        ...state,
        currentTier: action.payload.tier,
        subscriptionStartDate: action.payload.startDate,
        subscriptionEndDate: action.payload.endDate,
        isCancelled: action.payload.isCancelled,
        trialStartDate: action.payload.trialStartDate,
        trialEndDate: action.payload.trialEndDate,
        isInTrial: action.payload.isInTrial,
        error: null,
      };
    
    case SUBSCRIPTION_ACTIONS.SET_TRIAL:
      const hasTrialData = action.payload.trialStartDate && action.payload.trialEndDate;
      
      if (hasTrialData) {
        clearSubscriptionStorage();
        console.log('🧹 [SUBSCRIPTION] Cleared local trial cache; database is source of truth');
      } else {
        console.log('📱 [SUBSCRIPTION] Trial state reset locally');
      }
      
      return {
        ...state,
        trialStartDate: action.payload.trialStartDate,
        trialEndDate: action.payload.trialEndDate,
        isInTrial: action.payload.isInTrial,
        error: null,
      };
    
    case SUBSCRIPTION_ACTIONS.SET_USER_PROFILE:
      return {
        ...state,
        userProfile: action.payload,
        currentTier: action.payload?.subscriptionLevel?.id || 'free',
        loading: false,
        error: null,
      };
    
    case SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION_LEVELS:
      return {
        ...state,
        subscriptionLevels: action.payload,
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
    
    case SUBSCRIPTION_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };
    
    case SUBSCRIPTION_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
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
  const { isLoggedIn } = useContext(AuthContext);

  // Load subscription levels and user profile on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        dispatch({ type: SUBSCRIPTION_ACTIONS.SET_LOADING, payload: true });
        
        // Try to load subscription levels in background (no token needed)
        // But make it truly optional - don't try if we know it will fail
        const tryLoadSubscriptionLevels = async () => {
          try {
            console.log('📊 [SUBSCRIPTION] Attempting to load subscription levels...');
            const subscriptionLevels = await databaseService.getSubscriptionLevels();
            console.log('📊 [SUBSCRIPTION] Subscription levels loaded:', subscriptionLevels?.length || 0);
            
            if (subscriptionLevels && Array.isArray(subscriptionLevels)) {
              // Parse JSON strings in subscription levels
              const normalizedLevels = subscriptionLevels.map(level => {
                const limits = typeof level.limits === 'string' ? JSON.parse(level.limits) : level.limits;
                const Limits = typeof level.Limits === 'string' ? JSON.parse(level.Limits) : level.Limits;
                const features = typeof level.features === 'string' ? JSON.parse(level.features) : level.features;
                const Features = typeof level.Features === 'string' ? JSON.parse(level.Features) : level.Features;

                // If this is the Free plan, set ads to always show
                const levelId = level.id || level.ID;
                if ((levelId === 'free' || levelId === 'Free') && limits) {
                  limits.adsEnabled = true;
                  limits.adsFrequency = 'always';
                }

                return {
                  ...level,
                  id: levelId,
                  name: (levelId === 'free' || levelId === 'Free') ? 'Free' : (level.name || level.Name),
                  Name: (levelId === 'free' || levelId === 'Free') ? 'Free' : (level.name || level.Name),
                  searchRadiusKm: level.SearchRadiusKm || level.searchRadiusKm || 2, // Map database property
                  limits: limits || {},
                  Limits: limits || {},
                  features,
                  Features: features,
                };
              });

              dispatch({
                type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION_LEVELS,
                payload: normalizedLevels
              });
              return true;
            } else {
              console.warn('⚠️ [SUBSCRIPTION] No subscription levels data received');
              dispatch({
                type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION_LEVELS,
                payload: []
              });
              return false;
            }
          } catch (err) {
            console.warn('⚠️ [SUBSCRIPTION] Could not load subscription levels (continuing without):', err.message);
            // Don't fail the app, just use empty levels and continue
            dispatch({
              type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION_LEVELS,
              payload: []
            });
            return false;
          }
        };

        // Try to load subscription levels, but don't block the app
        await tryLoadSubscriptionLevels();
        
        // Only load user profile if user is logged in (has token)
        const token = await getToken();
        console.log('🔑 [SUBSCRIPTION] Token check result:', token ? 'Token found' : 'No token (user not logged in)');
        
        if (token) {
          console.log('🔑 [SUBSCRIPTION] User is logged in, loading user profile from database...');
          
          // Extract user ID from JWT token
          let userId = 'current-user'; // fallback
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            console.log('🔑 [SUBSCRIPTION] Token payload:', tokenPayload);
            userId = tokenPayload.ID || tokenPayload.userId || tokenPayload.sub || 'current-user';
            console.log('🔑 [SUBSCRIPTION] Extracted userId:', userId);
          } catch (tokenError) {
            console.error('❌ [SUBSCRIPTION] Failed to parse token for user ID:', tokenError);
          }
          
          console.log('🔍 [SUBSCRIPTION] Calling getUserProfile with userId:', userId);
          
          try {
            const userProfile = await databaseService.getUserProfile(userId);
            console.log('👤 [SUBSCRIPTION] getUserProfile result:', userProfile ? 'Success' : 'Failed/Null');
            console.log('👤 [SUBSCRIPTION] User profile data:', userProfile ? JSON.stringify(userProfile, null, 2) : 'No data');
            
            if (userProfile) {
              console.log('👤 [SUBSCRIPTION] Loaded user profile from database:', userProfile.SubscriptionLevelID);
              
              dispatch({ 
                type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
                payload: userProfile 
              });
              
              // Get the subscription level ID (handle both camelCase and PascalCase)
              const subscriptionLevelId = userProfile.SubscriptionLevelID || userProfile.subscriptionLevelId;
              
              if (subscriptionLevelId) {
                console.log('🔄 [SUBSCRIPTION] Updating subscription tier from database:', subscriptionLevelId);
                
                const subscriptionData = {
                  tier: subscriptionLevelId.toLowerCase(), // Normalize to lowercase
                  startDate: userProfile.SubscriptionStartDate || userProfile.subscriptionStartDate || new Date().toISOString(),
                  endDate: userProfile.SubscriptionEndDate || userProfile.subscriptionEndDate || null,
                  isCancelled: !userProfile.IsSubscriptionActive,
                  trialStartDate: userProfile.TrialStartDate || userProfile.trialStartDate || null,
                  trialEndDate: userProfile.TrialEndDate || userProfile.trialEndDate || null,
                  isInTrial: isProfileInTrial(userProfile),
                };
                
                dispatch({
                  type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
                  payload: subscriptionData
                });
                
                await clearSubscriptionStorage();
              } else {
                console.log('⚠️ [SUBSCRIPTION] User profile has no subscriptionLevelId');
              }
            } else {
              console.log('👤 [SUBSCRIPTION] No user profile found in database; clearing local subscription cache');
              await clearSubscriptionStorage();
            }
          } catch (dbError) {
            console.error('❌ [SUBSCRIPTION] Database call error:', dbError);
            console.error('❌ [SUBSCRIPTION] Error details:', {
              message: dbError.message,
              stack: dbError.stack,
              name: dbError.name
            });
          }
        } else {
          console.log('🔑 [SUBSCRIPTION] User not logged in; clearing subscription cache and using Free defaults');
          await clearSubscriptionStorage();
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
            payload: defaultSubscriptionState,
          });
        }
        
        dispatch({ type: SUBSCRIPTION_ACTIONS.SET_LOADING, payload: false });
      } catch (error) {
        console.error('Error in subscription loading:', error);
        dispatch({ type: SUBSCRIPTION_ACTIONS.SET_LOADING, payload: false });
      }
    };

    loadData();
  }, []);

  // Reload subscription data when user logs in
  useEffect(() => {
    if (isLoggedIn === true) {
      console.log('🔑 [SUBSCRIPTION] User logged in, reloading subscription data...');
      const reloadAfterLogin = async () => {
        try {
          const token = await getToken();
          if (token) {
            console.log('🔑 [SUBSCRIPTION] Token found after login, loading user profile from database...');
            const userId = 'current-user';
            
            try {
              const userProfile = await databaseService.getUserProfile(userId);
              console.log('👤 [SUBSCRIPTION] getUserProfile result after login:', userProfile ? 'SUCCESS' : 'FAILED/NULL');
              
              if (userProfile) {
                console.log('👤 [SUBSCRIPTION] ===== DATABASE RESULT =====');
                console.log('👤 [SUBSCRIPTION] User profile data:', JSON.stringify(userProfile, null, 2));
                console.log('👤 [SUBSCRIPTION] SubscriptionLevelID:', userProfile.SubscriptionLevelID);
                console.log('👤 [SUBSCRIPTION] IsSubscriptionActive:', userProfile.IsSubscriptionActive);
                console.log('👤 [SUBSCRIPTION] =======================');
                
                dispatch({ 
                  type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
                  payload: userProfile 
                });
                
                // Get the subscription level ID (handle both camelCase and PascalCase)
                const subscriptionLevelId = userProfile.SubscriptionLevelID || userProfile.subscriptionLevelId;
                
                if (subscriptionLevelId) {
                  console.log('� [SUBSCRIPTION] Found subscriptionLevelId:', subscriptionLevelId);
                  
                  // Fetch subscription levels to get the full level object
                  console.log('🔄 [SUBSCRIPTION] Fetching subscription levels to get full level object...');
                  try {
                    const subscriptionLevels = await databaseService.getSubscriptionLevels();
                    console.log('🔄 [SUBSCRIPTION] Subscription levels loaded:', subscriptionLevels.length);
                    
                    // Normalize subscription levels (same as initial load)
                    const normalizedLevels = subscriptionLevels.map(level => {
                      const limits = typeof level.limits === 'string' ? JSON.parse(level.limits) : level.limits;
                      const Limits = typeof level.Limits === 'string' ? JSON.parse(level.Limits) : level.Limits;
                      const features = typeof level.features === 'string' ? JSON.parse(level.features) : level.features;
                      const Features = typeof level.Features === 'string' ? JSON.parse(level.Features) : level.Features;

                      const levelId = level.id || level.ID;

                      return {
                        ...level,
                        id: levelId,
                        name: (levelId === 'free' || levelId === 'Free') ? 'Free' : (level.name || level.Name),
                        searchRadiusKm: level.SearchRadiusKm || level.searchRadiusKm || 2,
                        limits: limits || {},
                        features,
                      };
                    });

                    // Find the matching subscription level (case-insensitive match)
                    const subscriptionLevel = normalizedLevels.find(
                      level => level.id.toLowerCase() === subscriptionLevelId.toLowerCase()
                    );
                    
                    console.log('🔄 [SUBSCRIPTION] Matched subscription level:', subscriptionLevel ? subscriptionLevel.id : 'Not found');
                    console.log('🔄 [SUBSCRIPTION] Search radius:', subscriptionLevel?.searchRadiusKm);
                    
                    if (subscriptionLevel) {
                      console.log('🔄 [SUBSCRIPTION] Updating subscription tier from database after login:', subscriptionLevelId);
                      
                      const subscriptionData = {
                        tier: subscriptionLevelId.toLowerCase(), // Normalize to lowercase
                        startDate: userProfile.SubscriptionStartDate || userProfile.subscriptionStartDate || new Date().toISOString(),
                        endDate: userProfile.SubscriptionEndDate || userProfile.subscriptionEndDate || null,
                        isCancelled: !userProfile.IsSubscriptionActive,
                        trialStartDate: userProfile.TrialStartDate || userProfile.trialStartDate || null,
                        trialEndDate: userProfile.TrialEndDate || userProfile.trialEndDate || null,
                        isInTrial: isProfileInTrial(userProfile),
                      };
                      
                      dispatch({
                        type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
                        payload: subscriptionData
                      });
                      
                      await clearSubscriptionStorage();
                    } else {
                      console.log('⚠️ [SUBSCRIPTION] Subscription level not found for ID:', subscriptionLevelId);
                    }
                  } catch (levelsError) {
                    console.error('❌ [SUBSCRIPTION] Failed to fetch subscription levels:', levelsError);
                  }
                } else {
                  console.log('⚠️ [SUBSCRIPTION] User profile has no subscriptionLevelId');
                }
              } else {
                console.log('👤 [SUBSCRIPTION] No user profile found in database after login');
              }
            } catch (dbError) {
              console.error('❌ [SUBSCRIPTION] Database call error after login:', dbError);
              console.error('❌ [SUBSCRIPTION] Error details:', {
                message: dbError.message,
                stack: dbError.stack,
                name: dbError.name
              });
            }
          } else {
            console.log('🔑 [SUBSCRIPTION] No token found after login');
          }
        } catch (error) {
          console.error('❌ [SUBSCRIPTION] Error reloading after login:', error);
        }
      };
      
      reloadAfterLogin();
    }
  }, [isLoggedIn]);

  // Check trial expiration when app starts or trial state changes
  useEffect(() => {
    const checkTrial = () => {
      if (state.isInTrial && state.trialEndDate) {
        const now = new Date();
        const trialEnd = new Date(state.trialEndDate);
        
        if (now > trialEnd) {
          console.log('🔔 Trial expired detected in useEffect');
          
          // Update to paid plan (remove trial status)
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
            payload: {
              tier: state.currentTier,
              startDate: state.subscriptionStartDate,
              endDate: null,
              isCancelled: false,
              trialStartDate: null,
              trialEndDate: null,
              isInTrial: false,
            }
          });
        }
      }
    };

    // Check immediately
    checkTrial();
    
    // Set up interval to check periodically (every hour)
    const interval = setInterval(checkTrial, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [state.isInTrial, state.trialEndDate, state.currentTier, state.subscriptionStartDate]);

  const value = {
    ...state,
    dispatch,
    plans: SUBSCRIPTION_PLANS,
    // Database-driven functions
    updateSubscription: async (subscriptionLevelId) => {
      try {
        // Get actual user ID from token
        let userId = 'current-user'; // fallback
        try {
          const token = await getToken();
          if (token) {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            userId = tokenPayload.ID || tokenPayload.userId || tokenPayload.sub || 'current-user';
            console.log('🔑 [SUBSCRIPTION] updateSubscription extracted userId:', userId);
          }
        } catch (tokenError) {
          console.error('❌ [SUBSCRIPTION] Failed to get user ID from token:', tokenError);
        }
        
        // In development mode, always use the fallback
        if (process.env.EXPO_PUBLIC_APP_ENV === 'development') {
          console.log('🔧 Development mode: Using fallback subscription update');
          
          // Find the subscription level
          const subscriptionLevel = Object.values(SUBSCRIPTION_PLANS).find(level => level.id === subscriptionLevelId);
          console.log('🔧 Found subscription level:', subscriptionLevel?.name);
          
          if (subscriptionLevel) {
            // Check if this is a trial-eligible plan
            const isTrialEligible = Boolean(subscriptionLevel.trial?.enabled);
            
            let trialStartDate = null;
            let trialEndDate = null;
            let isInTrial = false;
            
            if (isTrialEligible) {
              // Start configured trial
              const now = new Date();
              trialStartDate = now.toISOString();
              const trialDurationDays = subscriptionLevel.trial?.durationDays || 7;
              trialEndDate = new Date(now.getTime() + (trialDurationDays * 24 * 60 * 60 * 1000)).toISOString();
              isInTrial = true;
              
              console.log(`🎯 Starting ${trialDurationDays}-day trial for`, subscriptionLevelId);
              console.log('🎯 Trial period:', trialStartDate, 'to', trialEndDate);
            }
            
            // Create a mock user profile with the new subscription (as if it came from database)
            const mockProfile = {
              id: userId,
              subscriptionLevelId,
              subscriptionLevel,
              subscriptionStatus: 'active',
              subscriptionStartDate: new Date().toISOString(),
              isSubscriptionActive: true,
              // Add trial info to profile
              trialStartDate,
              trialEndDate,
              isInTrial,
              // Add other fields that would come from database
              name: 'Test User',
              email: 'test@example.com',
              phone: '+1234567890',
              address: '123 Test Street',
              city: 'Test City',
              postalCode: 'TE1 1ST',
              searchRadiusKm: subscriptionLevel.searchRadiusKm || 2,
              listingTypePreference: 'both',
              propertyTypePreferences: ['house', 'flat'],
              priceRangeMin: 100000,
              priceRangeMax: 500000,
            };
            
            console.log('🔧 Created mock profile, dispatching SET_USER_PROFILE');
            // Update user profile (as if from database)
            dispatch({ 
              type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
              payload: mockProfile 
            });
            
            console.log('🔧 Dispatching SET_SUBSCRIPTION');
            // Update current tier with trial info
            dispatch({
              type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
              payload: {
                tier: subscriptionLevelId,
                startDate: new Date().toISOString(),
                endDate: null,
                isCancelled: false,
                trialStartDate,
                trialEndDate,
                isInTrial,
              }
            });
            
            console.log('🔧 Development mode: Updated subscription to', subscriptionLevelId);
            console.log('🔧 Trial status:', isInTrial ? 'Active' : 'None');
            console.log('🔧 New search radius:', subscriptionLevel.searchRadiusKm, 'km');
            return true;
          } else {
            console.error('❌ Could not find subscription level:', subscriptionLevelId);
            return false;
          }
        }
        
        // Production mode - try real database
        try {
          console.log('🔗 Production mode: Attempting database update for subscription:', subscriptionLevelId);
          await databaseService.updateUserSubscription(userId, subscriptionLevelId);
          console.log('✅ Database update call succeeded');
          
          // Reload user profile to get updated subscription
          const userProfile = await databaseService.getUserProfile(userId);
          console.log('👤 Got user profile from database:', userProfile?.subscriptionLevelId);
          
          if (userProfile && userProfile.subscriptionLevelId) {
            console.log('📦 Dispatching SET_USER_PROFILE from database');
            dispatch({ 
              type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
              payload: userProfile 
            });
            
            // Also update the current tier based on the profile
            const tierId = userProfile.subscriptionLevelId || userProfile.subscriptionLevel?.id || 'free';
            console.log('🎯 Updating current tier to:', tierId);
            
            // Send subscription invoice email for paid plans
            if (tierId !== 'free') {
              try {
                const { sendSubscriptionInvoice } = require('./services/emailService');
                await sendSubscriptionInvoice(
                  {
                    SubscriptionLevelID: tierId,
                    BillingAmount: userProfile.BillingAmount || getSubscriptionPrice(tierId),
                    BillingInterval: userProfile.BillingInterval || 'month',
                    SubscriptionStartDate: userProfile.SubscriptionStartDate,
                    SubscriptionEndDate: userProfile.SubscriptionEndDate,
                    AutoRenew: userProfile.AutoRenew || false
                  },
                  userProfile
                );
                console.log('📧 Subscription invoice sent successfully');
              } catch (emailError) {
                console.error('❌ Failed to send subscription invoice:', emailError);
                // Don't fail the subscription if email fails
              }
            }
            
            dispatch({
              type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
              payload: {
                tier: tierId,
                startDate: userProfile.subscriptionStartDate || new Date().toISOString(),
                endDate: userProfile.subscriptionEndDate || null,
                isCancelled: !userProfile.isSubscriptionActive,
                trialStartDate: userProfile.trialStartDate || null,
                trialEndDate: userProfile.trialEndDate || null,
                isInTrial: isProfileInTrial(userProfile),
                autoRenew: userProfile.AutoRenew || false,
              }
            });
            
            console.log('✅ Database subscription updated to:', tierId);
            return true;
          } else {
            console.log('⚠️ No user profile returned from database');
            throw new Error('No user profile returned');
          }
        } catch (dbError) {
          console.error('Production database update failed:', dbError);
          throw dbError;
        }
        
        return true;
      } catch (error) {
        console.error('Failed to update subscription:', error);
        dispatch({ 
          type: SUBSCRIPTION_ACTIONS.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    },
    updateUserProfile: async (profileData) => {
      try {
        const userId = 'current-user'; // This should come from your auth system
        const updatedProfile = await databaseService.updateUserProfile(userId, profileData);
        
        dispatch({ 
          type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
          payload: updatedProfile 
        });
        return true;
      } catch (error) {
        console.error('Failed to update user profile:', error);
        dispatch({ 
          type: SUBSCRIPTION_ACTIONS.SET_ERROR, 
          payload: error.message 
        });
        return false;
      }
    },
    // Helper functions
    upgradeTier: async (tierId) => {
      return await value.updateSubscription(tierId);
    },
    cancelSubscription: async () => {
      try {
        let userId =
          state.userProfile?.UserID ||
          state.userProfile?.userId ||
          state.userProfile?.UserId ||
          'current-user';

        try {
          const token = await getToken();
          if (token) {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            userId = tokenPayload.ID || tokenPayload.UserID || tokenPayload.userId || tokenPayload.sub || userId;
            console.log('🔑 [SUBSCRIPTION] cancelSubscription extracted userId:', userId);
          }
        } catch (tokenError) {
          console.error('❌ [SUBSCRIPTION] Failed to get user ID from token:', tokenError);
        }

        const subscriptionId =
          state.userProfile?.StripeSubscriptionID ||
          state.userProfile?.stripeSubscriptionId ||
          null;

        console.log('🚫 [SUBSCRIPTION] Cancelling Stripe subscription:', { userId, subscriptionId });

        const result = await cancelStripeSubscription({
          userId,
          subscriptionId,
          cancelAtPeriodEnd: true,
        });

        if (!result.success) {
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_ERROR,
            payload: result.error || 'Failed to cancel subscription',
          });
          return false;
        }

        await clearSubscriptionStorage();
        await value.reloadSubscriptionData();

        console.log('🚫 [SUBSCRIPTION] Stripe cancellation completed');
        return true;
      } catch (error) {
        console.error('❌ Cancel subscription error:', error);
        dispatch({ 
          type: SUBSCRIPTION_ACTIONS.SET_ERROR, 
          payload: 'Failed to cancel subscription' 
        });
        return false;
      }
    },
    reactivateSubscription: async () => {
      try {
        let userId =
          state.userProfile?.UserID ||
          state.userProfile?.userId ||
          state.userProfile?.UserId ||
          'current-user';

        try {
          const token = await getToken();
          if (token) {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            userId = tokenPayload.ID || tokenPayload.UserID || tokenPayload.userId || tokenPayload.sub || userId;
            console.log('[SUBSCRIPTION] reactivateSubscription extracted userId:', userId);
          }
        } catch (tokenError) {
          console.error('[SUBSCRIPTION] Failed to get user ID from token:', tokenError);
        }

        const subscriptionId =
          state.userProfile?.StripeSubscriptionID ||
          state.userProfile?.stripeSubscriptionId ||
          null;

        console.log('[SUBSCRIPTION] Reactivating Stripe subscription:', { userId, subscriptionId });

        const result = await reactivateStripeSubscription({
          userId,
          subscriptionId,
        });

        if (!result.success) {
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_ERROR,
            payload: result.error || 'Failed to reactivate subscription',
          });
          return false;
        }

        await clearSubscriptionStorage();
        await value.reloadSubscriptionData();

        console.log('[SUBSCRIPTION] Stripe reactivation completed');
        return true;
      } catch (error) {
        console.error('Reactivate subscription error:', error);
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_ERROR,
          payload: 'Failed to reactivate subscription',
        });
        return false;
      }
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
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      
      if (!currentLevel || !currentLevel.limits) return true;
      
      const limitKey = {
        propertiesSearched: 'arSearchesPerMonth',
        propertiesSaved: 'savedSearchesMax',
        notificationsSent: 'notificationsPerMonth',
      }[action];
      
      const limit = currentLevel.limits[limitKey];
      return limit === 'Unlimited' || limit === -1 || count <= limit;
    },
    // Subscription-based feature controls
    getMaxSearchRadius: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.searchRadiusKm || 2;
    },
    getMaxNotifications: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.limits?.notificationsPerMonth || 5;
    },
    getMaxSavedSearches: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.limits?.savedSearchesMax || 5;
    },
    getMaxARSearches: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.limits?.arSearchesPerMonth || 10;
    },
    getRefreshPriority: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.limits?.refreshPriority || 'normal';
    },
    hasAlertsEnabled: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      return currentLevel?.limits?.alertsEnabled || false;
    },
    // Get current subscription level details
    getCurrentSubscriptionLevel: () => {
      return state.subscriptionLevels.find(
        level => (level.id?.toLowerCase() === state.currentTier?.toLowerCase()) || (level.ID?.toLowerCase() === state.currentTier?.toLowerCase())
      );
    },
    // Ad-related functions
    shouldShowAd: (action) => {
      const currentLevel = state.subscriptionLevels.find(
        level => (level.id || level.ID) === state.currentTier
      );

      const limits = currentLevel?.limits || currentLevel?.Limits || {};

      // If ads are not enabled, never show
      if (!limits.adsEnabled) return false;

      const frequency = limits.adsFrequency;

      // If frequency is 'always', always show ads
      if (frequency === 'always') return true;

      // For specific actions, check if the action matches
      switch (frequency) {
        case 'property_open':
          return action === 'property_open' || action === 'open_property';
        case 'search':
          return action === 'search';
        default:
          return false;
      }
    },
    getAdConfig: () => {
      const currentLevel = state.subscriptionLevels.find(
        level => level.id === state.currentTier
      );
      
      return {
        enabled: currentLevel?.limits?.adsEnabled || false,
        frequency: currentLevel?.limits?.adsFrequency || 'none',
        showUpgradePrompt: true,
        adMessage: 'Upgrade to Premium to remove ads and unlock more features!'
      };
    },
    // Trial management functions
    getTrialStatus: () => {
      if (!state.isInTrial || !state.trialEndDate) {
        return {
          isInTrial: false,
          trialStartDate: null,
          trialEndDate: null,
          daysRemaining: 0,
          isExpired: false,
        };
      }
      
      const now = new Date();
      const trialEnd = new Date(state.trialEndDate);
      const isExpired = now > trialEnd;
      const daysRemaining = isExpired ? 0 : Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      
      return {
        isInTrial: !isExpired,
        trialStartDate: state.trialStartDate,
        trialEndDate: state.trialEndDate,
        daysRemaining,
        isExpired,
      };
    },
    checkTrialExpiration: () => {
      const trialStatus = this.getTrialStatus();
      
      if (trialStatus.isExpired && state.isInTrial) {
        console.log('🔔 Trial expired, updating subscription to paid plan');
        
        // Update to paid plan (remove trial status)
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
          payload: {
            tier: state.currentTier,
            startDate: state.subscriptionStartDate,
            endDate: null,
            isCancelled: false,
            trialStartDate: null,
            trialEndDate: null,
            isInTrial: false,
          }
        });
        
        return true; // Trial just expired
      }
      
      return false; // Trial not expired
    },
    endTrialEarly: () => {
      if (state.isInTrial) {
        console.log('🔔 Ending trial early, converting to paid plan');
        
        // Convert to paid plan immediately
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
          payload: {
            tier: state.currentTier,
            startDate: state.subscriptionStartDate,
            endDate: null,
            isCancelled: false,
            trialStartDate: null,
            trialEndDate: null,
            isInTrial: false,
          }
        });
        
        return true;
      }
      
      return false;
    },
    clearSubscriptionData: async () => {
      try {
        console.log('🧹 clearSubscriptionData: Starting cleanup...');
        
        // Simple direct approach - clear all subscription-related keys
        const keysToRemove = [
          STORAGE_KEYS.SUBSCRIPTION_TIER,
          STORAGE_KEYS.SUBSCRIPTION_START_DATE,
          STORAGE_KEYS.SUBSCRIPTION_END_DATE,
          STORAGE_KEYS.SUBSCRIPTION_IS_CANCELLED,
          STORAGE_KEYS.TRIAL_START_DATE,
          STORAGE_KEYS.TRIAL_END_DATE,
          STORAGE_KEYS.IS_IN_TRIAL,
          'user-profile' // Also clear user profile
        ];
        
        console.log('🧹 Keys to remove:', keysToRemove);
        
        // Try direct removal first
        for (const key of keysToRemove) {
          try {
            await AsyncStorage.removeItem(key);
            console.log(`🧹 Removed key: ${key}`);
          } catch (keyError) {
            console.warn(`Failed to remove key ${key}:`, keyError);
          }
        }
        
        // Verify keys are actually removed
        console.log('🧹 Verifying keys are cleared...');
        for (const key of keysToRemove) {
          const value = await AsyncStorage.getItem(key);
          console.log(`🧹 Key ${key} after removal:`, value);
        }
        
        // Reset to initial state
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
          payload: {
            tier: 'free',
            startDate: null,
            endDate: null,
            isCancelled: false,
            trialStartDate: null,
            trialEndDate: null,
            isInTrial: false,
          }
        });
        
        // Clear user profile
        dispatch({
          type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE,
          payload: null
        });
        
        console.log('🧹 clearSubscriptionData: Completed successfully');
        return true;
      } catch (error) {
        console.error('clearSubscriptionData: Failed to clear subscription data:', error);
        // Don't throw the error, just log it and return false
        return false;
      }
    },
    clearAllAsyncStorage: async () => {
      try {
        console.log('🧹 clearAllAsyncStorage: Clearing everything...');
        await AsyncStorage.clear();
        console.log('🧹 clearAllAsyncStorage: All AsyncStorage cleared');
        return true;
      } catch (error) {
        console.error('clearAllAsyncStorage: Failed to clear AsyncStorage:', error);
        return false;
      }
    },
    reloadSubscriptionData: async () => {
      try {
        console.log('🔄 [RELOAD] reloadSubscriptionData: Starting reload...');
        
        // Try to load user profile first - this will override AsyncStorage if user is logged in
        const token = await getToken();
        console.log('🔄 [RELOAD] Token check result:', token ? 'Token found' : 'No token');
        console.log('🔄 [RELOAD] Token value (first 50 chars):', token ? token.substring(0, 50) + '...' : 'none');
        
        if (token) {
          console.log('🔄 [RELOAD] Token found, loading user profile from database...');
          const userId = 'current-user'; // This should come from your auth system
          console.log('🔄 [RELOAD] Calling getUserProfile with userId:', userId);
          
          try {
            const userProfile = await databaseService.getUserProfile(userId);
            console.log('🔄 [RELOAD] getUserProfile result:', userProfile ? 'Success' : 'Failed/Null');
            console.log('🔄 [RELOAD] User profile data:', userProfile ? JSON.stringify(userProfile, null, 2) : 'No data');
            
            if (userProfile) {
              const subscriptionLevelId = userProfile.SubscriptionLevelID || userProfile.subscriptionLevelId;
              const subscriptionStatus = userProfile.SubscriptionStatus || userProfile.subscriptionStatus;
              const trialStartDate = userProfile.TrialStartDate || userProfile.trialStartDate || null;
              const trialEndDate = userProfile.TrialEndDate || userProfile.trialEndDate || null;
              const isSubscriptionActive =
                userProfile.IsSubscriptionActive ?? userProfile.isSubscriptionActive ?? false;
              const isTrialingByStatus = String(subscriptionStatus || '').toLowerCase() === 'trialing';
              const isTrialingByDate = trialEndDate ? new Date(trialEndDate) > new Date() : false;
              const isInTrial = Boolean(userProfile.IsInTrial ?? userProfile.isInTrial ?? (isTrialingByStatus || isTrialingByDate));

              console.log('🔄 [RELOAD] Loaded user profile from database:', subscriptionLevelId);
              
              // Update user profile
              dispatch({ 
                type: SUBSCRIPTION_ACTIONS.SET_USER_PROFILE, 
                payload: userProfile 
              });
              
              // Update subscription tier based on database data (this overrides AsyncStorage)
              if (subscriptionLevelId) {
                const subscriptionData = {
                  tier: String(subscriptionLevelId).toLowerCase(),
                  startDate: userProfile.SubscriptionStartDate || userProfile.subscriptionStartDate || new Date().toISOString(),
                  endDate: userProfile.SubscriptionEndDate || userProfile.subscriptionEndDate || null,
                  isCancelled: !isSubscriptionActive,
                  trialStartDate,
                  trialEndDate,
                  isInTrial,
                  autoRenew: isSubscriptionActive,
                };

                console.log('🔄 [RELOAD] Updating subscription tier from database (overriding AsyncStorage):', subscriptionData);
                dispatch({
                  type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
                  payload: subscriptionData
                });

                await clearSubscriptionStorage();
              } else {
                console.log('⚠️ [RELOAD] User profile has no subscriptionLevelId');
              }
            } else {
              console.log('🔄 [RELOAD] No user profile found in database');
            }
          } catch (dbError) {
            console.error('❌ [RELOAD] Database call error:', dbError);
            console.error('❌ [RELOAD] Error details:', {
              message: dbError.message,
              stack: dbError.stack,
              name: dbError.name
            });
          }
        } else {
          console.log('🔄 [RELOAD] No token found; clearing cached subscription data and using default Free state');
          await clearSubscriptionStorage();
          dispatch({
            type: SUBSCRIPTION_ACTIONS.SET_SUBSCRIPTION,
            payload: defaultSubscriptionState,
          });
        }
        
        console.log('🔄 [RELOAD] reloadSubscriptionData: Completed');
        return true;
      } catch (error) {
        console.error('🔄 [RELOAD] reloadSubscriptionData: Failed to reload:', error);
        console.error('🔄 [RELOAD] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        return false;
      }
    },
  };

  useEffect(() => {
    if (isLoggedIn !== true) return undefined;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔄 [SUBSCRIPTION] App became active; refreshing subscription from database');
        value.reloadSubscriptionData();
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

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
