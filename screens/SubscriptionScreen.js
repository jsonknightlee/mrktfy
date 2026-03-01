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
        "Enhanced AR highlights"
      ],
      limits: {
        savedSearchesMax: 20,
        alertsEnabled: true,
        refreshPriority: "high",
        notificationsPerMonth: 100,
        arSearchesPerMonth: 50
      },
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
  const [selectedTier, setSelectedTier] = useState(null);
  const [billingInterval, setBillingInterval] = useState(planConfig.defaultInterval);

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

  const renderTierCard = (tier) => {
    const price = tier.prices[billingInterval];
    const isComingSoon = !tier.isAvailable;
    
    return (
      <View
        style={[
          styles.tierCard,
          selectedTier?.key === tier.key && styles.selectedTierCard,
          isComingSoon && styles.comingSoonCard,
          { borderLeftColor: tier.key === 'prospector' ? '#007AFF' : tier.key === 'investor' ? '#10B981' : '#6366F1' },
        ]}
      >
        {/* Badges */}
        <View style={styles.badgesContainer}>
          {tier.badges?.map((badge, index) => (
            <View 
              key={index}
              style={[
                styles.badge,
                { backgroundColor: badge === 'Recommended' ? '#FF6B6B' : badge === 'Coming soon' ? '#666' : '#007AFF' }
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
            <Text key={index} style={[styles.feature, { color: isComingSoon ? '#999' : '#333' }]}>
              {feature}
            </Text>
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { 
              backgroundColor: isComingSoon ? '#ccc' : tier.key === 'prospector' ? '#007AFF' : tier.key === 'investor' ? '#10B981' : '#6366F1',
              opacity: isComingSoon ? 0.6 : 1
            }
          ]}
          onPress={() => handleSubscribe(tier)}
          disabled={isComingSoon}
        >
          <Text style={styles.subscribeButtonText}>
            {isComingSoon ? tier.cta.label : tier.cta.label}
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
        <Text style={styles.headerTitle}>{planConfig.uiCopy?.planScreenTitle || 'Choose your plan'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Billing Interval Toggle */}
      <View style={styles.billingToggle}>
        <TouchableOpacity
          style={[
            styles.billingOption,
            billingInterval === 'month' && styles.billingOptionActive
          ]}
          onPress={() => setBillingInterval('month')}
        >
          <Text style={[
            styles.billingOptionText,
            billingInterval === 'month' && styles.billingOptionTextActive
          ]}>
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.billingOption,
            billingInterval === 'year' && styles.billingOptionActive
          ]}
          onPress={() => setBillingInterval('year')}
        >
          <Text style={[
            styles.billingOptionText,
            billingInterval === 'year' && styles.billingOptionTextActive
          ]}>
            Yearly
          </Text>
        </TouchableOpacity>
      </View>

      {/* Trial Banner */}
      {planConfig.trial?.enabled && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerTitle}>{planConfig.trial.trialCopy}</Text>
        </View>
      )}

      {/* Subscription Tiers */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tiersContainer}
      >
        {planConfig.plans.map((tier) => (
          <View key={tier.key} style={styles.tierWrapper}>
            {renderTierCard(tier)}
          </View>
        ))}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.compareButton}
          onPress={() => Alert.alert('Compare Plans', 'Detailed comparison feature coming soon!')}
        >
          <Ionicons name="git-compare" size={20} color="#007AFF" />
          <Text style={styles.compareButtonText}>Compare All Plans</Text>
        </TouchableOpacity>
      </View>
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
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 20,
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
  billingOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  billingOptionTextActive: {
    color: '#fff',
  },
  trialBanner: {
    backgroundColor: '#e8f5e8',
    marginHorizontal: 20,
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
    padding: 20,
    gap: 16,
  },
  tierWrapper: {
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderLeftWidth: 4,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedTierCard: {
    borderColor: '#007AFF',
    shadowOpacity: 0.2,
    elevation: 8,
  },
  comingSoonCard: {
    opacity: 0.7,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
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
    marginBottom: 16,
  },
  tierNameContainer: {
    flex: 1,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  period: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  subtext: {
    fontSize: 12,
    marginTop: 4,
  },
  bestFor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  featuresContainer: {
    gap: 8,
  },
  feature: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  subscribeButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
