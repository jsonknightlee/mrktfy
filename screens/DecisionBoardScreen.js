import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDecisionBoardAgent,
  addDecisionBoardBroker,
  BOARD_STATUSES,
  BROKER_STATUSES,
  deleteDecisionBoardAgent,
  deleteDecisionBoardBroker,
  getDecisionBoard,
  updateDecisionBoard,
  updateDecisionBoardAgent,
  updateDecisionBoardBroker,
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

const EMPTY_CONTACT_FORM = {
  name: '',
  company: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
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
const getBoardAgentId = (agent) => String(agent?.decisionBoardAgentId || agent?.DecisionBoardAgentID || agent?.id || '');
const getBoardBrokerId = (broker) => String(broker?.decisionBoardBrokerId || broker?.DecisionBoardBrokerID || broker?.id || '');

export default function DecisionBoardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialBoard = route.params?.decisionBoard || null;
  const decisionBoardId = route.params?.decisionBoardId || initialBoard?.id;
  const [board, setBoard] = useState(initialBoard);
  const [loading, setLoading] = useState(!initialBoard);
  const [saving, setSaving] = useState(false);
  const [contactModal, setContactModal] = useState({ visible: false, type: 'agent', item: null });
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);

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

  const contactModalTitle = contactModal.type === 'agent'
    ? `${contactModal.item ? 'Edit' : 'Add'} agent`
    : `${contactModal.item ? 'Edit' : 'Add'} broker`;

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

  useFocusEffect(useCallback(() => {
    loadBoard();
  }, [loadBoard]));

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

  const openContactModal = (type, item = null) => {
    setContactForm({
      name: type === 'agent' ? item?.agentName || '' : item?.brokerName || '',
      company: item?.companyName || '',
      phone: item?.phone || '',
      email: item?.email || '',
      address: item?.address || '',
      notes: item?.notes || '',
    });
    setContactModal({ visible: true, type, item });
  };

  const closeContactModal = () => {
    setContactModal({ visible: false, type: 'agent', item: null });
    setContactForm(EMPTY_CONTACT_FORM);
  };

  const saveContact = async () => {
    const trimmedName = contactForm.name.trim();
    if (!board?.id || !trimmedName || saving) return;

    const payload = {
      companyName: contactForm.company.trim(),
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim(),
      address: contactForm.address.trim(),
      notes: contactForm.notes.trim(),
    };

    setSaving(true);
    try {
      if (contactModal.type === 'agent') {
        const decisionBoardAgentId = contactModal.item ? getBoardAgentId(contactModal.item) : null;
        const agentPayload = { ...payload, agentName: trimmedName };
        const agent = decisionBoardAgentId
          ? await updateDecisionBoardAgent(board.id, decisionBoardAgentId, agentPayload)
          : await addDecisionBoardAgent(board.id, agentPayload);

        setBoard((current) => ({
          ...current,
          agents: decisionBoardAgentId
            ? (current?.agents || []).map((item) => getBoardAgentId(item) === decisionBoardAgentId ? agent : item)
            : [agent, ...(current?.agents || [])],
        }));
      } else {
        const decisionBoardBrokerId = contactModal.item ? getBoardBrokerId(contactModal.item) : null;
        const brokerPayload = { ...payload, brokerName: trimmedName, status: contactModal.item?.status || 'Contacted' };
        const broker = decisionBoardBrokerId
          ? await updateDecisionBoardBroker(board.id, decisionBoardBrokerId, brokerPayload)
          : await addDecisionBoardBroker(board.id, brokerPayload);

        setBoard((current) => ({
          ...current,
          brokers: decisionBoardBrokerId
            ? (current?.brokers || []).map((item) => getBoardBrokerId(item) === decisionBoardBrokerId ? broker : item)
            : [broker, ...(current?.brokers || [])],
        }));
      }

      closeContactModal();
    } catch (error) {
      Alert.alert(
        contactModal.item ? 'Contact not updated' : 'Contact not added',
        error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not save this contact.'
      );
    } finally {
      setSaving(false);
    }
  };

  const isAgentInUse = (decisionBoardAgentId) => listings.some((listing) => (
    (listing.agents || []).some((agent) => getBoardAgentId(agent) === decisionBoardAgentId)
  ));

  const isBrokerInUse = (decisionBoardBrokerId) => listings.some((listing) => (
    (listing.brokers || []).some((broker) => getBoardBrokerId(broker) === decisionBoardBrokerId)
  ));

  const removeAgent = (agent) => {
    const decisionBoardAgentId = getBoardAgentId(agent);
    if (!board?.id || !decisionBoardAgentId || saving) return;

    if (isAgentInUse(decisionBoardAgentId)) {
      Alert.alert('Agent in use', 'This agent is linked to a property in this Decision Board. Unlink it from the property before deleting it.');
      return;
    }

    Alert.alert('Remove agent?', 'This removes the agent from this Decision Board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteDecisionBoardAgent(board.id, decisionBoardAgentId);
            setBoard((current) => ({
              ...current,
              agents: (current?.agents || []).filter((item) => getBoardAgentId(item) !== decisionBoardAgentId),
            }));
          } catch (error) {
            Alert.alert('Agent not removed', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not remove this agent.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const removeBroker = (broker) => {
    const decisionBoardBrokerId = getBoardBrokerId(broker);
    if (!board?.id || !decisionBoardBrokerId || saving) return;

    if (isBrokerInUse(decisionBoardBrokerId)) {
      Alert.alert('Broker in use', 'This broker is linked to a property in this Decision Board. Unlink it from the property before deleting it.');
      return;
    }

    Alert.alert('Remove broker?', 'This removes the broker from this Decision Board.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteDecisionBoardBroker(board.id, decisionBoardBrokerId);
            setBoard((current) => ({
              ...current,
              brokers: (current?.brokers || []).filter((item) => getBoardBrokerId(item) !== decisionBoardBrokerId),
            }));
          } catch (error) {
            Alert.alert('Broker not removed', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not remove this broker.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Agents</Text>
            <TouchableOpacity style={styles.sectionAddButton} onPress={() => openContactModal('agent')}>
              <Ionicons name="add" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {(board.agents || []).length ? (board.agents || []).map((agent) => (
            <View key={agent.id || `${agent.agentName}-${agent.companyName}`} style={styles.contactRow}>
              <Ionicons name="business-outline" size={20} color={APP_PURPLE} />
              <View style={styles.contactBody}>
                <Text style={styles.contactTitle}>{agent.agentName}</Text>
                <Text style={styles.contactMeta}>{agent.companyName || 'Estate agent'}</Text>
                {!!agent.phone && <Text style={styles.contactMeta}>{agent.phone}</Text>}
                {!!agent.email && <Text style={styles.contactMeta}>{agent.email}</Text>}
                {!!agent.address && <Text style={styles.contactMeta}>{agent.address}</Text>}
                {!!agent.notes && <Text style={styles.contactNotes}>{agent.notes}</Text>}
              </View>
              <TouchableOpacity style={styles.contactDeleteButton} onPress={() => openContactModal('agent', agent)} disabled={saving}>
                <Ionicons name="create-outline" size={18} color={APP_PURPLE} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactDeleteButton} onPress={() => removeAgent(agent)} disabled={saving}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={styles.emptyInline}>No agents added yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Mortgage brokers</Text>
            <TouchableOpacity style={styles.sectionAddButton} onPress={() => openContactModal('broker')}>
              <Ionicons name="add" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {(board.brokers || []).length ? (board.brokers || []).map((broker) => (
            <View key={broker.id || `${broker.brokerName}-${broker.companyName}`} style={styles.contactRow}>
              <Ionicons name="cash-outline" size={20} color={APP_PURPLE} />
              <View style={styles.contactBody}>
                <Text style={styles.contactTitle}>{broker.brokerName}</Text>
                <Text style={styles.contactMeta}>{broker.companyName || 'Mortgage broker'} / {broker.status || BROKER_STATUSES[0]}</Text>
                {!!broker.phone && <Text style={styles.contactMeta}>{broker.phone}</Text>}
                {!!broker.email && <Text style={styles.contactMeta}>{broker.email}</Text>}
                {!!broker.address && <Text style={styles.contactMeta}>{broker.address}</Text>}
                {!!broker.notes && <Text style={styles.contactNotes}>{broker.notes}</Text>}
              </View>
              <TouchableOpacity style={styles.contactDeleteButton} onPress={() => openContactModal('broker', broker)} disabled={saving}>
                <Ionicons name="create-outline" size={18} color={APP_PURPLE} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactDeleteButton} onPress={() => removeBroker(broker)} disabled={saving}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={styles.emptyInline}>No brokers added yet.</Text>
          )}
        </View>
      </ScrollView>
      <Modal visible={contactModal.visible} transparent animationType="slide" onRequestClose={closeContactModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{contactModalTitle}</Text>
              <TouchableOpacity style={styles.headerIconButton} onPress={closeContactModal}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput style={styles.input} value={contactForm.name} onChangeText={(name) => setContactForm((current) => ({ ...current, name }))} placeholder={contactModal.type === 'agent' ? 'Agent name' : 'Broker name'} placeholderTextColor="#94A3B8" />
              <TextInput style={styles.input} value={contactForm.company} onChangeText={(company) => setContactForm((current) => ({ ...current, company }))} placeholder="Company" placeholderTextColor="#94A3B8" />
              <TextInput style={styles.input} value={contactForm.phone} onChangeText={(phone) => setContactForm((current) => ({ ...current, phone }))} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
              <TextInput style={styles.input} value={contactForm.email} onChangeText={(email) => setContactForm((current) => ({ ...current, email }))} placeholder="Email" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={styles.input} value={contactForm.address} onChangeText={(address) => setContactForm((current) => ({ ...current, address }))} placeholder="Address" placeholderTextColor="#94A3B8" />
              <TextInput style={[styles.input, styles.notesField]} value={contactForm.notes} onChangeText={(notes) => setContactForm((current) => ({ ...current, notes }))} placeholder="Notes" placeholderTextColor="#94A3B8" multiline textAlignVertical="top" />
              <TouchableOpacity style={[styles.modalSaveButton, saving && styles.disabledButton]} onPress={saveContact} disabled={saving || !contactForm.name.trim()}>
                <Text style={[styles.modalSaveButtonText, saving && styles.disabledButtonText]}>{saving ? 'Saving...' : 'Save contact'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionAddButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
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
  notesField: { minHeight: 72, paddingTop: 10 },
  inlineButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: APP_PURPLE, borderRadius: 8, flexDirection: 'row', marginTop: 10, minHeight: 40, paddingHorizontal: 13 },
  inlineButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 6 },
  disabledButton: { backgroundColor: '#E5E7EB' },
  disabledButtonText: { color: '#94A3B8' },
  contactRow: { alignItems: 'center', borderTopColor: '#E5E7EB', borderTopWidth: 1, flexDirection: 'row', marginTop: 10, paddingTop: 10 },
  contactBody: { flex: 1, marginLeft: 10 },
  contactTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  contactMeta: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 3 },
  contactNotes: { color: '#475569', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 5 },
  contactDeleteButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  emptyPanel: { backgroundColor: '#F8FAFC', borderRadius: 8, marginTop: 12, padding: 13 },
  emptyPanelTitle: { color: '#111827', fontSize: 13, fontWeight: '900' },
  emptyPanelText: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 4 },
  emptyInline: { color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 12 },
  emptyTitle: { color: '#111827', fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  modalOverlay: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  modalHeader: { alignItems: 'center', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  modalBody: { gap: 8, padding: 16 },
  modalSaveButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, justifyContent: 'center', marginTop: 6, minHeight: 44 },
  modalSaveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
