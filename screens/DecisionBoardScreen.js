import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDecisionBoardAgent,
  addDecisionBoardBroker,
  BOARD_STATUSES,
  BROKER_STATUSES,
  getDecisionBoard,
  updateDecisionBoard,
  updateDecisionBoardListing,
} from '../services/DecisionBoardService';

const APP_PURPLE = '#6366F1';
const FLOW_STEPS = [
  { key: 'deck', label: 'Property Deck' },
  { key: 'shortlist', label: 'Shortlist' },
  { key: 'board', label: 'Board' },
  { key: 'decision', label: 'Decision' },
];

const TRAFFIC_LIGHT = {
  Green: { color: '#22C55E', label: 'Active' },
  Orange: { color: '#F97316', label: 'Tentative' },
  Red: { color: '#EF4444', label: 'Closed' },
};

const normalizeImageUrls = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return trimmed.split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
};

const getListingTitle = (listing) => listing?.Title || listing?.title || listing?.Address || listing?.address || 'Decision property';
const getListingPrice = (listing) => listing?.Price || listing?.price || '';
const getListingImageValue = (listing) => (
  listing?.ImageUrls ||
  listing?.imageUrls ||
  listing?.Images ||
  listing?.images ||
  listing?.ImageUrl ||
  listing?.imageUrl ||
  listing?.PrimaryImageUrl ||
  listing?.primaryImageUrl ||
  listing?.MainImageUrl ||
  listing?.mainImageUrl ||
  listing?.PhotoUrl ||
  listing?.photoUrl ||
  listing?.ThumbnailUrl ||
  listing?.thumbnailUrl
);
const statusToTrafficLight = (status) => (status === 'Closed' ? 'Red' : status === 'Tentative' ? 'Orange' : 'Green');

export default function DecisionBoardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialBoard = route.params?.decisionBoard || null;
  const decisionBoardId = route.params?.decisionBoardId || initialBoard?.id;
  const [board, setBoard] = useState(initialBoard);
  const [loading, setLoading] = useState(!initialBoard);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentCompany, setAgentCompany] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerCompany, setBrokerCompany] = useState('');

  const listings = board?.listings || [];
  const activeCount = listings.filter((item) => item.listingStatus !== 'Closed').length;
  const progressPercent = board?.maxProperties ? Math.round((activeCount / board.maxProperties) * 100) : 0;

  const statusCounts = useMemo(() => (
    listings.reduce((acc, item) => {
      const status = item.trafficLightStatus || statusToTrafficLight(item.listingStatus);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { Green: 0, Orange: 0, Red: 0 })
  ), [listings]);

  const loadBoard = useCallback(async () => {
    if (!decisionBoardId) return;

    setLoading(true);
    try {
      setBoard(await getDecisionBoard(decisionBoardId));
    } catch (error) {
      Alert.alert('Decision Board unavailable', error?.response?.data?.error || error?.message || 'Could not load this Decision Board.');
    } finally {
      setLoading(false);
    }
  }, [decisionBoardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const setBoardStatus = async (status) => {
    if (!board?.id) return;

    setSaving(true);
    try {
      setBoard(await updateDecisionBoard(board.id, { status }));
    } catch (error) {
      Alert.alert('Status update failed', error?.response?.data?.error || error?.message || 'Could not update board status.');
    } finally {
      setSaving(false);
    }
  };

  const setListingStatus = async (item, listingStatus) => {
    if (!board?.id || !item?.id) return;

    const trafficLightStatus = statusToTrafficLight(listingStatus);
    setBoard((current) => ({
      ...current,
      listings: (current?.listings || []).map((listing) => (
        listing.id === item.id ? { ...listing, listingStatus, trafficLightStatus } : listing
      )),
    }));

    try {
      await updateDecisionBoardListing(board.id, item.id, { listingStatus, trafficLightStatus });
    } catch (error) {
      Alert.alert('Property update failed', error?.response?.data?.error || error?.message || 'Could not update this property.');
      loadBoard();
    }
  };

  const addAgent = async () => {
    const trimmedName = agentName.trim();
    if (!board?.id || !trimmedName) return;

    setSaving(true);
    try {
      const agent = await addDecisionBoardAgent(board.id, {
        agentName: trimmedName,
        companyName: agentCompany.trim(),
      });
      setBoard((current) => ({ ...current, agents: [agent, ...(current?.agents || [])] }));
      setAgentName('');
      setAgentCompany('');
    } catch (error) {
      Alert.alert('Agent not added', error?.response?.data?.error || error?.message || 'Could not add this agent.');
    } finally {
      setSaving(false);
    }
  };

  const addBroker = async () => {
    const trimmedName = brokerName.trim();
    if (!board?.id || !trimmedName) return;

    setSaving(true);
    try {
      const broker = await addDecisionBoardBroker(board.id, {
        brokerName: trimmedName,
        companyName: brokerCompany.trim(),
        status: 'Contacted',
      });
      setBoard((current) => ({ ...current, brokers: [broker, ...(current?.brokers || [])] }));
      setBrokerName('');
      setBrokerCompany('');
    } catch (error) {
      Alert.alert('Broker not added', error?.response?.data?.error || error?.message || 'Could not add this broker.');
    } finally {
      setSaving(false);
    }
  };

  const renderFlowSteps = () => (
    <View style={styles.flowStepsContainer}>
      {FLOW_STEPS.map((step, index) => {
        const isActive = index === FLOW_STEPS.length - 1;
        const isComplete = index < FLOW_STEPS.length - 1;

        return (
          <View key={step.key} style={styles.flowStepItem}>
            <View style={styles.flowStepTopRow}>
              <View style={[
                styles.flowStepDot,
                isComplete && styles.flowStepDotComplete,
                isActive && styles.flowStepDotActive,
              ]}>
                {isComplete ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.flowStepNumber, isActive && styles.flowStepNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < FLOW_STEPS.length - 1 && (
                <View style={[styles.flowStepLine, isComplete && styles.flowStepLineActive]} />
              )}
            </View>
            <Text style={[styles.flowStepLabel, isActive && styles.flowStepLabelActive]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderDecisionListing = (item) => {
    const listing = item.listing || item;
    const imageUrl = normalizeImageUrls(getListingImageValue(listing))[0];
    const lightKey = item.trafficLightStatus || statusToTrafficLight(item.listingStatus);
    const light = TRAFFIC_LIGHT[lightKey] || TRAFFIC_LIGHT.Green;

    return (
      <TouchableOpacity
        key={item.id || item.listingId}
        style={styles.propertyCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DecisionBoardListing', {
          decisionBoard: board,
          decisionBoardListing: item,
        })}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.propertyImage} />
        ) : (
          <View style={[styles.propertyImage, styles.placeholderImage]}>
            <Ionicons name="home-outline" size={22} color="#CBD5E1" />
          </View>
        )}

        <View style={styles.propertyBody}>
          <Text style={styles.propertyPrice}>{String(getListingPrice(listing))}</Text>
          <Text style={styles.propertyTitle} numberOfLines={2}>{getListingTitle(listing)}</Text>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: light.color }]} />
            <Text style={styles.propertyMeta}>{light.label}</Text>
          </View>
          <View style={styles.miniStatusRow}>
            {['Active', 'Tentative', 'Closed'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.miniStatusButton, item.listingStatus === status && styles.miniStatusButtonSelected]}
                onPress={() => setListingStatus(item, status)}
              >
                <Text style={[styles.miniStatusText, item.listingStatus === status && styles.miniStatusTextSelected]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" style={styles.propertyChevron} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={APP_PURPLE} />
        <Text style={styles.loadingText}>Loading Decision Board</Text>
      </View>
    );
  }

  if (!board) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="albums-outline" size={44} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Decision Board unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{board.boardName}</Text>
          <Text style={styles.headerSubtitle}>{board.boardType} / {activeCount} of {board.maxProperties} active properties</Text>
        </View>
      </View>

      {renderFlowSteps()}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Board status</Text>
              <Text style={styles.sectionHint}>Green {statusCounts.Green} / Orange {statusCounts.Orange} / Red {statusCounts.Red}</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{Math.min(progressPercent, 100)}%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
          </View>
          <View style={styles.chipWrap}>
            {BOARD_STATUSES.map((status) => {
              const selected = board.status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setBoardStatus(status)}
                  disabled={saving}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{status}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decision Board Listings</Text>
          {listings.length ? listings.map(renderDecisionListing) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyPanelTitle}>No properties yet</Text>
              <Text style={styles.emptyPanelText}>Use Pursue from a property to add it to this Decision Board.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estate agents</Text>
          <View style={styles.inputGrid}>
            <TextInput style={styles.input} value={agentName} onChangeText={setAgentName} placeholder="Agent name" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={agentCompany} onChangeText={setAgentCompany} placeholder="Company" placeholderTextColor="#94A3B8" />
          </View>
          <TouchableOpacity style={styles.inlineButton} onPress={addAgent} disabled={saving || !agentName.trim()}>
            <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />
            <Text style={styles.inlineButtonText}>Add agent</Text>
          </TouchableOpacity>
          {(board.agents || []).map((agent) => (
            <View key={agent.id || `${agent.agentName}-${agent.companyName}`} style={styles.contactRow}>
              <Ionicons name="business-outline" size={20} color={APP_PURPLE} />
              <View style={styles.contactBody}>
                <Text style={styles.contactTitle}>{agent.agentName}</Text>
                <Text style={styles.contactMeta}>{agent.companyName || 'Estate agent'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mortgage brokers</Text>
          <View style={styles.inputGrid}>
            <TextInput style={styles.input} value={brokerName} onChangeText={setBrokerName} placeholder="Broker name" placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} value={brokerCompany} onChangeText={setBrokerCompany} placeholder="Company" placeholderTextColor="#94A3B8" />
          </View>
          <TouchableOpacity style={styles.inlineButton} onPress={addBroker} disabled={saving || !brokerName.trim()}>
            <Ionicons name="briefcase-outline" size={17} color="#FFFFFF" />
            <Text style={styles.inlineButtonText}>Add broker</Text>
          </TouchableOpacity>
          {(board.brokers || []).map((broker) => (
            <View key={broker.id || `${broker.brokerName}-${broker.companyName}`} style={styles.contactRow}>
              <Ionicons name="cash-outline" size={20} color={APP_PURPLE} />
              <View style={styles.contactBody}>
                <Text style={styles.contactTitle}>{broker.brokerName}</Text>
                <Text style={styles.contactMeta}>{broker.companyName || 'Mortgage broker'} / {broker.status || BROKER_STATUSES[0]}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7F8FB', flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '800', marginTop: 12 },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerIconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerText: { flex: 1, paddingHorizontal: 6 },
  headerTitle: { color: '#111827', fontSize: 21, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  flowStepsContainer: { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 12 },
  flowStepItem: { flex: 1 },
  flowStepTopRow: { alignItems: 'center', flexDirection: 'row' },
  flowStepDot: { alignItems: 'center', backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderRadius: 999, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  flowStepDotActive: { backgroundColor: APP_PURPLE, borderColor: APP_PURPLE },
  flowStepDotComplete: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  flowStepNumber: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  flowStepNumberActive: { color: '#FFFFFF' },
  flowStepLine: { backgroundColor: '#E5E7EB', flex: 1, height: 3, marginHorizontal: 6 },
  flowStepLineActive: { backgroundColor: APP_PURPLE },
  flowStepLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '900', marginTop: 6 },
  flowStepLabelActive: { color: '#111827' },
  content: { padding: 16, paddingBottom: 34 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 8, marginBottom: 14, padding: 14 },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  progressBadge: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  progressBadgeText: { color: APP_PURPLE, fontSize: 12, fontWeight: '900' },
  progressTrack: { backgroundColor: '#E5E7EB', borderRadius: 999, height: 10, marginTop: 12, overflow: 'hidden' },
  progressFill: { backgroundColor: APP_PURPLE, height: '100%' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#EEF2FF', borderColor: APP_PURPLE },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  chipTextSelected: { color: APP_PURPLE },
  propertyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, flexDirection: 'row', marginTop: 10, overflow: 'hidden' },
  propertyImage: { backgroundColor: '#EEF2F7', height: 92, width: 70 },
  placeholderImage: { alignItems: 'center', justifyContent: 'center' },
  propertyBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  propertyPrice: { color: APP_PURPLE, fontSize: 13, fontWeight: '900' },
  propertyTitle: { color: '#111827', fontSize: 12, fontWeight: '800', lineHeight: 16, marginTop: 3 },
  statusLine: { alignItems: 'center', flexDirection: 'row', marginTop: 6 },
  statusDot: { borderRadius: 999, height: 9, marginRight: 6, width: 9 },
  propertyMeta: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  propertyChevron: { marginRight: 10 },
  miniStatusRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  miniStatusButton: { backgroundColor: '#F1F5F9', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  miniStatusButtonSelected: { backgroundColor: '#EEF2FF' },
  miniStatusText: { color: '#64748B', fontSize: 10, fontWeight: '900' },
  miniStatusTextSelected: { color: APP_PURPLE },
  inputGrid: { gap: 8, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 14, minHeight: 42, paddingHorizontal: 11 },
  inlineButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: APP_PURPLE, borderRadius: 8, flexDirection: 'row', marginTop: 10, minHeight: 40, paddingHorizontal: 13 },
  inlineButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 6 },
  contactRow: { alignItems: 'center', borderTopColor: '#E5E7EB', borderTopWidth: 1, flexDirection: 'row', marginTop: 10, paddingTop: 10 },
  contactBody: { flex: 1, marginLeft: 10 },
  contactTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  contactMeta: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 3 },
  emptyPanel: { backgroundColor: '#F8FAFC', borderRadius: 8, marginTop: 12, padding: 13 },
  emptyPanelTitle: { color: '#111827', fontSize: 13, fontWeight: '900' },
  emptyPanelText: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 4 },
  emptyTitle: { color: '#111827', fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
});
