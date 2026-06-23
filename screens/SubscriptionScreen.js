import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../contexts/SubscriptionContext';

// Real plan configuration
const planConfig = {
  currency: "GBP",
  billingIntervals: ["month", "year"],
  defaultInterval: "month",
  trial: {
    enabled: true,
    durationDays: 7,
    appliesToPlanKeys: ["prospector"],
    trialCopy: "Start your 7-day free trial"
  },
  plans: [
    {
      key: "free",
      name: "Free",
      tagline: "Basic property search",
      bestFor: "Casual browsing",
      isAvailable: true,
      badges: ["Always free"],
      prices: {
        month: { "amount": 0, "display": "£0" },
        year: { "amount": 0, "display": "£0" }
      },
      trial: {
        enabled: false,
      },
      features: [
        "Basic property search",
        "Limited property details",
        "Save up to 10 properties",
        "Map view",
        "Basic filters",
        "Ads supported"
      ],
      limits: {
        savedSearchesMax: 5,
        alertsEnabled: false,
        refreshPriority: 'normal',
        notificationsPerMonth: 5,
        arSearchesPerMonth: 10,
        adsEnabled: true,
        adsFrequency: 'always',
      },
      color: "#666",
      searchRadiusKm: 2,
      cta: {
        type: "current_plan",
        label: "Current plan"
      }
    },
    {
      key: "prospector",
      name: "Prospector",
      tagline: "Find deals before others do",
      bestFor: "Active house-hunting",
      isAvailable: true,
      badges: ["Recommended", "7-day free trial"],
      prices: {
        month: { "amount": 999, "display": "£9.99" },
        year: { "amount": 9999, "display": "£99.99", "subtext": "2 months free" }
      },
      trial: {
        enabled: true,
        durationDays: 7,
        isDefaultEntryPoint: true
      },
      features: [
        "Advanced filters",
        "Saved searches",
        "Unlimited favourites",
        "Price-drop alerts",
        "Faster listing refresh",
        "Enhanced AR highlights",
        "Ad-free experience"
      ],
      limits: {
        savedSearchesMax: 20,
        alertsEnabled: true,
        refreshPriority: "high",
        notificationsPerMonth: 100,
        arSearchesPerMonth: 50,
        adsEnabled: false,
        adsFrequency: 'never',
      },
      color: "#007AFF",
      searchRadiusKm: 5,
      cta: {
        type: "start_trial_or_manage",
        label: "Start 7-day free trial"
      }
    },
    {
      key: "investor",
      name: "Investor",
      tagline: "Track, analyse, and act at scale",
      bestFor: "Deal hunters & landlords",
      isAvailable: true,
      badges: ["Power user"],
      prices: {
        month: { "amount": 2999, "display": "£29.99" },
        year: { "amount": 29999, "display": "£299.99", "subtext": "2 months free" }
      },
      trial: {
        enabled: false
      },
      features: [
        "Multi-area tracking",
        "Watchlists & collections",
        "Stronger deal signals",
        "Priority listing refresh",
        "Export & sharing tools",
        "Investor analytics (rolling out)"
      ],
      limits: {
        savedSearchesMax: 200,
        alertsEnabled: true,
        refreshPriority: "priority",
        notificationsPerMonth: 500,
        arSearchesPerMonth: 200
      },
      cta: {
        type: "upgrade_or_manage",
        label: "Upgrade to Investor"
      }
    },
    {
      key: "developer",
      name: "Developer",
      tagline: "Build, scale, and automate",
      bestFor: "Builders, agencies & large portfolios",
      isAvailable: false,
      badges: ["Coming soon"],
      overlay: {
        enabled: true,
        label: "Coming soon"
      },
      prices: {
        month: { "amount": 4999, "display": "£49.99", "subtext": "Coming soon" },
        year: { "amount": 49999, "display": "£499.99", "subtext": "Coming soon" }
      },
      trial: {
        enabled: false
      },
      features: [
        "Bulk area & land tracking",
        "Planning & zoning overlays",
        "Development opportunity signals",
        "Multi-user access",
        "Advanced reporting & exports",
        "API access (planned)"
      ],
      limits: {
        alertsEnabled: true,
        refreshPriority: "max",
        notificationsPerMonth: "Unlimited",
        arSearchesPerMonth: "Unlimited"
      },
      cta: {
        type: "coming_soon",
        label: "Coming soon"
      }
    }
  ]
};

export default function SubscriptionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentTier, cancelSubscription, reactivateSubscription, reloadSubscriptionData, userProfile } = useSubscription();
  const [selectedTier, setSelectedTier] = useState(null);
  const [billingInterval, setBillingInterval] = useState(planConfig.defaultInterval);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const normalizedCurrentTier = String(currentTier || 'free').toLowerCase();
  const isSubscriptionCancelled = Boolean(
    userProfile?.IsCancelled ??
    userProfile?.isCancelled ??
    userProfile?.CancelledAt ??
    userProfile?.cancelledAt ??
    false
  );
  const isAnySubscriptionActionProcessing = isCancelling || isReactivating;

  const getPlanCTA = (plan) => {
    const planKey = String(plan.key || '').toLowerCase();
    const isCurrentPlan = planKey === normalizedCurrentTier;

    if (!plan.isAvailable) {
      return { type: 'coming_soon', label: 'Coming soon' };
    }

    if (isCurrentPlan) {
      if (planKey === 'free') {
        return { type: 'current_plan', label: 'Current plan' };
      }

      return isSubscriptionCancelled
        ? { type: 'reactivate', label: 'Reactivate subscription' }
        : { type: 'cancel', label: 'Cancel subscription' };
    }

    if (planKey === 'free') {
      return isSubscriptionCancelled
        ? { type: 'pending_free', label: 'Free after current period' }
        : { type: 'cancel_to_free', label: 'Cancel to Free' };
    }

    if (plan.trial?.enabled) {
      return { type: 'trial', label: `Start ${plan.trial.durationDays}-day trial` };
    }

    return { type: 'subscribe', label: `Subscribe to ${plan.name}` };
  };

  // Update plan CTAs based on actual current tier
  const plansWithCTA = planConfig.plans.map(plan => ({
    ...plan,
    cta: getPlanCTA(plan)
  }));

  const handleTierSelect = (tier) => {
    if (!tier.isAvailable) {
      Alert.alert('Coming Soon', `${tier.name} plan will be available soon!`);
      return;
    }
    setSelectedTier(tier);
  };

  const handleSubscribe = (tier) => {
    if (!tier.isAvailable) {
      Alert.alert('Coming Soon', `${tier.name} plan will be available soon!`);
      return;
    }

    if (String(tier.key).toLowerCase() === normalizedCurrentTier) {
      if (normalizedCurrentTier !== 'free' && isSubscriptionCancelled) {
        handleReactivateSubscription(tier);
        return;
      }

      if (normalizedCurrentTier !== 'free' && !isSubscriptionCancelled) {
        handleCancelSubscription(tier);
      }
      return;
    }

    if (tier.key === 'free') {
      if (normalizedCurrentTier !== 'free') {
        if (isSubscriptionCancelled) {
          Alert.alert('Already scheduled', 'Your paid subscription is already set to end at the current billing period.');
          return;
        }

        handleCancelSubscription({ ...tier, name: 'paid plan' });
        return;
      }

      Alert.alert(
        'Free Plan',
        'You\'re already on the Free plan! Enjoy basic property search with ads.',
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
      return;
    }

    const price = tier.prices[billingInterval];
    const message = tier.trial?.enabled 
      ? `Start your ${tier.trial.durationDays}-day free trial of ${tier.name}.\n\nAfter the trial, you'll be charged ${price.display}${billingInterval === 'month' ? '/month' : '/year'}.`
      : `You've selected the ${tier.name} plan at ${price.display}${billingInterval === 'month' ? '/month' : '/year'}.\n\nThis will redirect to payment processing.`;

    Alert.alert(
      tier.trial?.enabled ? 'Start Free Trial' : 'Subscribe to ' + tier.name,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: tier.trial?.enabled ? 'Start Trial' : 'Continue',
          onPress: () => {
            // Navigate to payment screen with selected tier
            navigation.navigate('Payment', { tier, billingInterval });
          },
        },
      ]
    );
  };

  const handleCancelSubscription = (tier) => {
    Alert.alert(
      'Cancel subscription',
      `Cancel your ${tier.name} subscription at the end of the current billing period?`,
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const success = await cancelSubscription();
              if (success) {
                await reloadSubscriptionData();
                Alert.alert('Subscription cancelled', 'Your subscription has been updated.');
              } else {
                Alert.alert('Cancellation failed', 'Please try again.');
              }
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleReactivateSubscription = (tier) => {
    Alert.alert(
      'Reactivate subscription',
      `Reactivate your ${tier.name} subscription? Your original trial and billing dates will be reused.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setIsReactivating(true);
            try {
              const success = await reactivateSubscription();
              if (success) {
                await reloadSubscriptionData();
                Alert.alert('Subscription reactivated', 'Your subscription has been reactivated.');
              } else {
                Alert.alert('Reactivation failed', 'Please try again.');
              }
            } finally {
              setIsReactivating(false);
            }
          },
        },
      ]
    );
  };

  const renderTierCard = (tier) => {
    const price = tier.prices[billingInterval];
    const isComingSoon = !tier.isAvailable;
    const isCurrentPlan = String(tier.key).toLowerCase() === normalizedCurrentTier;
    const isCurrentFreePlan = isCurrentPlan && normalizedCurrentTier === 'free';
    const isCurrentPaidPlan = isCurrentPlan && normalizedCurrentTier !== 'free';
    const isCancelledCurrentPlan = isCurrentPaidPlan && isSubscriptionCancelled;
    const isPendingFreePlan = tier.cta?.type === 'pending_free';
    const isProcessingCurrentPlan = isCurrentPaidPlan && isAnySubscriptionActionProcessing;
    const isDisabled = isComingSoon || isCurrentFreePlan || isPendingFreePlan || isProcessingCurrentPlan || (!isCurrentPaidPlan && isAnySubscriptionActionProcessing);
    
    return (
      <View
        style={[
          styles.tierCard,
          selectedTier?.key === tier.key && styles.selectedTierCard,
          isComingSoon && styles.comingSoonCard,
          { borderLeftColor: tier.key === 'free' ? '#666' : tier.key === 'prospector' ? '#007AFF' : tier.key === 'investor' ? '#10B981' : '#6366F1' },
        ]}
      >
        {/* Badges */}
        <View style={styles.badgesContainer}>
          {tier.badges?.map((badge, index) => (
            <View 
              key={index}
              style={[
                styles.badge,
                { backgroundColor: badge === 'Recommended' ? '#FF6B6B' : badge === 'Coming soon' ? '#666' : badge === 'Always free' ? '#10B981' : '#007AFF' }
              ]}
            >
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ))}
        </View>

        {/* Coming Soon Overlay */}
        {isComingSoon && tier.overlay?.enabled && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>{tier.overlay.label}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.tierHeader}>
          <View style={styles.tierNameContainer}>
            <Text style={[styles.tierName, { color: isComingSoon ? '#999' : tier.key === 'prospector' ? '#007AFF' : tier.key === 'investor' ? '#10B981' : '#6366F1' }]}>
              {tier.name}
            </Text>
            <Text style={styles.tagline}>{tier.tagline}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: isComingSoon ? '#999' : '#333' }]}>{price.display}</Text>
            <Text style={[styles.period, { color: isComingSoon ? '#999' : '#666' }]}>
              {billingInterval === 'month' ? '/month' : '/year'}
            </Text>
            {price.subtext && (
              <Text style={[styles.subtext, { color: isComingSoon ? '#999' : '#007AFF' }]}>
                {price.subtext}
              </Text>
            )}
          </View>
        </View>

        {/* Best For */}
        <Text style={styles.bestFor}>Best for: {tier.bestFor}</Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <Text key={`feature-${tier.key}-${index}`} style={[styles.feature, { color: isComingSoon ? '#999' : '#333' }]}>
              {feature}
            </Text>
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            isCurrentFreePlan && styles.currentPlanButton,
            isCurrentPaidPlan && styles.cancelSubscriptionButton,
            isCancelledCurrentPlan && styles.reactivateSubscriptionButton,
            { 
              backgroundColor: isCancelledCurrentPlan
                ? '#10B981'
                : isCurrentPaidPlan ? '#dc2626' : isDisabled ? '#d1d5db' : tier.key === 'free' ? '#666' : tier.key === 'prospector' ? '#007AFF' : tier.key === 'investor' ? '#10B981' : '#6366F1',
              opacity: isDisabled ? 0.75 : 1
            }
          ]}
          onPress={() => handleSubscribe(tier)}
          disabled={isDisabled}
          accessibilityState={{ disabled: isDisabled }}
        >
          <Text style={[styles.subscribeButtonText, isCurrentFreePlan && styles.currentPlanButtonText]}>
            {isReactivating && isCancelledCurrentPlan
              ? 'Reactivating...'
              : isCancelling && isCurrentPaidPlan
                ? 'Cancelling...'
                : tier.cta.label}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plans</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tiersContainer}
      >
        <Text style={styles.subtitle}>Choose the plan that fits your needs</Text>
        
        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[styles.billingOption, billingInterval === 'month' && styles.billingOptionActive]}
            onPress={() => setBillingInterval('month')}
          >
            <Text style={[styles.billingText, billingInterval === 'month' && styles.billingTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.billingOption, billingInterval === 'year' && styles.billingOptionActive]}
            onPress={() => setBillingInterval('year')}
          >
            <Text style={[styles.billingText, billingInterval === 'year' && styles.billingTextActive]}>Yearly</Text>
          </TouchableOpacity>
        </View>

        {/* Plans */}
        {plansWithCTA.map((tier) => (
          <View key={tier.key} style={styles.tierWrapper}>
            {renderTierCard(tier)}
          </View>
        ))}

        {/* Trial Banner */}
        {planConfig.trial?.enabled && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerTitle}>{planConfig.trial.trialCopy}</Text>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  billingOptionActive: {
    backgroundColor: '#007AFF',
  },
  billingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  billingTextActive: {
    color: '#fff',
  },
  trialBanner: {
    backgroundColor: '#e8f5e8',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  trialBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d6a2d',
  },
  tiersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  tierWrapper: {
    marginBottom: 0,
  },
  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  selectedTierCard: {
    borderColor: '#007AFF',
    shadowOpacity: 0.15,
    elevation: 8,
  },
  comingSoonCard: {
    opacity: 0.6,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  overlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  tierNameContainer: {
    flex: 1,
  },
  tierName: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    letterSpacing: -1,
  },
  period: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  subtext: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  bestFor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontWeight: '500',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  featuresContainer: {
    gap: 10,
  },
  feature: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#e9ecef',
  },
  subscribeButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentPlanButton: {
    borderWidth: 1,
    borderColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  cancelSubscriptionButton: {
    shadowColor: '#991b1b',
  },
  reactivateSubscriptionButton: {
    shadowColor: '#065f46',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  currentPlanButtonText: {
    color: '#374151',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  compareButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
