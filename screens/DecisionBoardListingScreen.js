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
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDecisionBoardNote,
  addDecisionBoardTask,
  addDecisionBoardTimelineEvent,
  attachDecisionBoardListingAgent,
  attachDecisionBoardListingBroker,
  deleteDecisionBoardTask,
  deleteDecisionBoardNote,
  detachDecisionBoardListingAgent,
  detachDecisionBoardListingBroker,
  getDecisionBoard,
  updateDecisionBoardNote,
  updateDecisionBoardListing,
  updateDecisionBoardTask,
  USER_VERDICTS,
} from '../services/DecisionBoardService';
import { getListingById } from '../services/listingApi';

const APP_PURPLE = '#6366F1';
const LISTING_STATUSES = ['Active', 'Tentative', 'Closed'];
const TRAFFIC_LIGHT = {
  Active: { color: '#22C55E', label: 'Active / Green' },
  Tentative: { color: '#F97316', label: 'Tentative / Orange' },
  Closed: { color: '#EF4444', label: 'Closed / Red' },
};

const normalizeImageUrls = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (
        typeof item === 'string'
          ? item
          : item?.url || item?.Url || item?.URL || item?.src || item?.uri || item?.Uri
      ))
      .filter(Boolean);
  }
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

const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const getListingTitle = (listing) => listing?.Title || listing?.title || listing?.Address || listing?.address || 'Decision property';
const getListingPrice = (listing) => listing?.Price || listing?.price || '';
const getListingImageValue = (listing) => (
  listing?.ImageUrls ||
  listing?.imageUrls ||
  listing?.image_urls ||
  listing?.Images ||
  listing?.images ||
  listing?.ImageUrl ||
  listing?.imageUrl ||
  listing?.image_url ||
  listing?.PrimaryImageUrl ||
  listing?.primaryImageUrl ||
  listing?.primary_image_url ||
  listing?.MainImageUrl ||
  listing?.mainImageUrl ||
  listing?.main_image_url ||
  listing?.PhotoUrl ||
  listing?.photoUrl ||
  listing?.photo_url ||
  listing?.ThumbnailUrl ||
  listing?.thumbnailUrl ||
  listing?.thumbnail_url
);
const getTaskDone = (task) => String(task?.status || '').toLowerCase() === 'completed';
const statusToTrafficLight = (status) => (status === 'Closed' ? 'Red' : status === 'Tentative' ? 'Orange' : 'Green');
const splitSavedNotes = (notes) => (
  String(notes || '')
    .split(/\n{2,}/)
    .map((note) => note.trim())
    .filter(Boolean)
);
const getAgentSelectionId = (agent) => String(
  agent?.decisionBoardAgentId ||
  agent?.DecisionBoardAgentID ||
  agent?.realEstateAgentId ||
  agent?.RealEstateAgentID ||
  agent?.agentId ||
  agent?.AgentID ||
  agent?.id ||
  ''
);
const getBrokerSelectionId = (broker) => String(
  broker?.decisionBoardBrokerId ||
  broker?.DecisionBoardBrokerID ||
  broker?.brokerId ||
  broker?.BrokerID ||
  broker?.mortgageBrokerId ||
  broker?.MortgageBrokerID ||
  broker?.id ||
  ''
);
const getLinkedAgentSelectionId = (linkedAgent, boardAgents = []) => {
  const explicitBoardAgentId = linkedAgent?.decisionBoardAgentId || linkedAgent?.DecisionBoardAgentID;
  if (explicitBoardAgentId) return String(explicitBoardAgentId);

  const realEstateAgentId = linkedAgent?.realEstateAgentId || linkedAgent?.RealEstateAgentID;
  if (!realEstateAgentId) return '';

  const matchingBoardAgent = boardAgents.find((agent) => (
    String(agent?.realEstateAgentId || agent?.RealEstateAgentID || '') === String(realEstateAgentId)
  ));

  return matchingBoardAgent ? getAgentSelectionId(matchingBoardAgent) : '';
};
const getLinkedBrokerSelectionId = (linkedBroker, boardBrokers = []) => {
  const explicitBoardBrokerId = linkedBroker?.decisionBoardBrokerId || linkedBroker?.DecisionBoardBrokerID;
  if (explicitBoardBrokerId) return String(explicitBoardBrokerId);

  const brokerId = linkedBroker?.brokerId || linkedBroker?.BrokerID || linkedBroker?.mortgageBrokerId || linkedBroker?.MortgageBrokerID;
  if (!brokerId) return '';

  const matchingBoardBroker = boardBrokers.find((broker) => (
    String(broker?.brokerId || broker?.BrokerID || broker?.mortgageBrokerId || broker?.MortgageBrokerID || '') === String(brokerId)
  ));

  return matchingBoardBroker ? getBrokerSelectionId(matchingBoardBroker) : '';
};
const getAgentLinkId = (linkedAgent) => String(
  linkedAgent?.decisionBoardListingAgentId ||
  linkedAgent?.DecisionBoardListingAgentID ||
  linkedAgent?.listingAgentId ||
  linkedAgent?.ListingAgentID ||
  linkedAgent?.linkId ||
  linkedAgent?.LinkID ||
  linkedAgent?.id ||
  ''
);
const getBrokerLinkId = (linkedBroker) => String(
  linkedBroker?.decisionBoardListingBrokerId ||
  linkedBroker?.DecisionBoardListingBrokerID ||
  linkedBroker?.listingBrokerId ||
  linkedBroker?.ListingBrokerID ||
  linkedBroker?.linkId ||
  linkedBroker?.LinkID ||
  linkedBroker?.id ||
  ''
);
const findLinkedAgentForBoardAgentId = (decisionBoardAgentId, linkedAgents = [], boardAgents = []) => {
  const boardAgent = boardAgents.find((agent) => getAgentSelectionId(agent) === String(decisionBoardAgentId));
  const boardRealEstateAgentId = boardAgent?.realEstateAgentId || boardAgent?.RealEstateAgentID;

  return linkedAgents.find((linkedAgent) => {
    const linkedBoardAgentId = linkedAgent?.decisionBoardAgentId || linkedAgent?.DecisionBoardAgentID;
    if (linkedBoardAgentId && String(linkedBoardAgentId) === String(decisionBoardAgentId)) return true;

    const linkedRealEstateAgentId = linkedAgent?.realEstateAgentId || linkedAgent?.RealEstateAgentID;
    return Boolean(
      boardRealEstateAgentId &&
      linkedRealEstateAgentId &&
      String(boardRealEstateAgentId) === String(linkedRealEstateAgentId)
    );
  });
};
const findLinkedBrokerForBoardBrokerId = (decisionBoardBrokerId, linkedBrokers = [], boardBrokers = []) => {
  const boardBroker = boardBrokers.find((broker) => getBrokerSelectionId(broker) === String(decisionBoardBrokerId));
  const boardBrokerId = boardBroker?.brokerId || boardBroker?.BrokerID || boardBroker?.mortgageBrokerId || boardBroker?.MortgageBrokerID;

  return linkedBrokers.find((linkedBroker) => {
    const linkedBoardBrokerId = linkedBroker?.decisionBoardBrokerId || linkedBroker?.DecisionBoardBrokerID;
    if (linkedBoardBrokerId && String(linkedBoardBrokerId) === String(decisionBoardBrokerId)) return true;

    const linkedBrokerId = linkedBroker?.brokerId || linkedBroker?.BrokerID || linkedBroker?.mortgageBrokerId || linkedBroker?.MortgageBrokerID;
    return Boolean(
      boardBrokerId &&
      linkedBrokerId &&
      String(boardBrokerId) === String(linkedBrokerId)
    );
  });
};

export default function DecisionBoardListingScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const board = route.params?.decisionBoard || null;
  const [decisionListing, setDecisionListing] = useState(route.params?.decisionBoardListing || null);
  const [fullListing, setFullListing] = useState(decisionListing?.listing || null);
  const [loadingListing, setLoadingListing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [taskName, setTaskName] = useState('');
  const [timelineNote, setTimelineNote] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');

  const listing = fullListing || decisionListing?.listing || {};
  const imageUrl = normalizeImageUrls(getListingImageValue(listing))[0];
  const statusMeta = TRAFFIC_LIGHT[decisionListing?.listingStatus || 'Active'] || TRAFFIC_LIGHT.Active;
  const tasks = decisionListing?.tasks || [];
  const timeline = decisionListing?.timeline || [];
  const media = decisionListing?.media || [];
  const savedNotes = useMemo(() => {
    const listingNotes = decisionListing?.listingNotes || [];
    if (listingNotes.length) return listingNotes;

    return splitSavedNotes(decisionListing?.notes).map((note, index) => ({
      id: `legacy-${index}`,
      noteText: note,
      createdAt: decisionListing?.updatedAt || decisionListing?.createdAt,
      updatedAt: decisionListing?.updatedAt || decisionListing?.createdAt,
      isLegacy: true,
    }));
  }, [decisionListing?.listingNotes, decisionListing?.notes, decisionListing?.createdAt, decisionListing?.updatedAt]);
  const linkedAgents = useMemo(() => decisionListing?.agents || [], [decisionListing?.agents]);
  const linkedBrokers = useMemo(() => decisionListing?.brokers || [], [decisionListing?.brokers]);
  const taskCounts = useMemo(() => ({
    complete: tasks.filter(getTaskDone).length,
    total: tasks.length,
  }), [tasks]);

  useFocusEffect(useCallback(() => {
    let isActive = true;

    const refreshDecisionListing = async () => {
      if (!board?.id || !decisionListing?.id) return;

      try {
        const refreshedBoard = await getDecisionBoard(board.id);
        const refreshedListing = (refreshedBoard?.listings || []).find((item) => String(item.id) === String(decisionListing.id));

        if (isActive && refreshedListing) {
          setDecisionListing((current) => ({
            ...current,
            ...refreshedListing,
            listing: current?.listing || refreshedListing.listing,
            listingNotes: refreshedListing.listingNotes || current?.listingNotes || [],
          }));
        }
      } catch {}
    };

    refreshDecisionListing();

    return () => {
      isActive = false;
    };
  }, [board?.id, decisionListing?.id]));

  useEffect(() => {
    const firstLinkedAgentId = getLinkedAgentSelectionId(linkedAgents[0], board?.agents || []);
    setSelectedAgentId(firstLinkedAgentId);
  }, [linkedAgents, board?.agents]);

  useEffect(() => {
    const firstLinkedBrokerId = getLinkedBrokerSelectionId(linkedBrokers[0], board?.brokers || []);
    setSelectedBrokerId(firstLinkedBrokerId);
  }, [linkedBrokers, board?.brokers]);

  useEffect(() => {
    const listingId = decisionListing?.listingId || decisionListing?.ListingID || listing?.ID;
    if (!listingId) return;
    if (
      getListingTitle(decisionListing?.listing) !== 'Decision property' &&
      getListingPrice(decisionListing?.listing) &&
      normalizeImageUrls(getListingImageValue(decisionListing?.listing)).length
    ) {
      return;
    }

    setLoadingListing(true);
    getListingById(listingId)
      .then((result) => {
        const nextListing = result?.listing || result?.Listing || result;
        setFullListing({
          ...(decisionListing?.listing || {}),
          ...(nextListing || {}),
          ID: String(listingId),
        });
      })
      .catch(() => {
        setFullListing((current) => current || { ...(decisionListing?.listing || {}), ID: String(listingId) });
      })
      .finally(() => setLoadingListing(false));
  }, [decisionListing?.listingId]);

  const patchListing = async (payload, options = {}) => {
    if (!board?.id || !decisionListing?.id) return;

    setSaving(true);
    try {
      const updated = await updateDecisionBoardListing(board.id, decisionListing.id, payload);
      setDecisionListing((current) => ({
        ...current,
        ...updated,
        listing: current?.listing || updated?.listing,
        agents: current?.agents || updated?.agents || [],
        brokers: current?.brokers || updated?.brokers || [],
        timeline: current?.timeline || updated?.timeline || [],
        tasks: current?.tasks || updated?.tasks || [],
        listingNotes: current?.listingNotes || updated?.listingNotes || [],
        media: current?.media || updated?.media || [],
      }));
      if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
        setNotesDraft(options.clearNotesDraft ? '' : updated?.notes ?? payload.notes ?? '');
      }
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.error || error?.message || 'Could not update this property.');
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = () => {
    const trimmed = notesDraft.trim();
    if (!decisionListing?.id || !trimmed) return;

    const request = editingNote?.id && !editingNote.isLegacy
      ? updateDecisionBoardNote(decisionListing.id, editingNote.id, { noteText: trimmed })
      : addDecisionBoardNote(decisionListing.id, { noteText: trimmed });

    setSaving(true);
    request
      .then((note) => {
        setDecisionListing((current) => {
          const currentNotes = current?.listingNotes || [];
          const nextNotes = editingNote?.id && !editingNote.isLegacy
            ? currentNotes.map((item) => String(item.id) === String(editingNote.id) ? note : item)
            : [note, ...currentNotes];

          return {
            ...current,
            listingNotes: nextNotes,
          };
        });
        setNotesDraft('');
        setEditingNote(null);
      })
      .catch((error) => {
        Alert.alert('Note not saved', error?.response?.data?.error || error?.message || 'Could not save this note.');
      })
      .finally(() => setSaving(false));
  };

  const editNote = (note) => {
    setEditingNote(note);
    setNotesDraft(note.noteText || '');
  };

  const removeNote = async (note) => {
    if (!decisionListing?.id || !note?.id || note.isLegacy) return;

    setDecisionListing((current) => ({
      ...current,
      listingNotes: (current?.listingNotes || []).filter((item) => String(item.id) !== String(note.id)),
    }));

    try {
      await deleteDecisionBoardNote(decisionListing.id, note.id);
      if (editingNote?.id && String(editingNote.id) === String(note.id)) {
        setEditingNote(null);
        setNotesDraft('');
      }
    } catch (error) {
      Alert.alert('Note delete failed', error?.response?.data?.error || error?.message || 'Could not delete this note.');
    }
  };

  const cancelNoteEdit = () => {
    setEditingNote(null);
    setNotesDraft('');
  };

  const setListingStatus = (listingStatus) => patchListing({
    listingStatus,
    trafficLightStatus: statusToTrafficLight(listingStatus),
  });

  const applyDecisionListingUpdate = (updated) => {
    setDecisionListing((current) => ({
      ...current,
      ...updated,
      listing: current?.listing || updated?.listing,
      agents: updated?.agents || current?.agents || [],
      brokers: updated?.brokers || current?.brokers || [],
      timeline: updated?.timeline || current?.timeline || [],
      tasks: updated?.tasks || current?.tasks || [],
      listingNotes: updated?.listingNotes || current?.listingNotes || [],
      media: updated?.media || current?.media || [],
    }));
  };
  const applyLinkedAgentUpdate = (linkedAgent, fallbackAgent, isDetaching) => {
    setDecisionListing((current) => ({
      ...current,
      agents: isDetaching ? [] : [{
        ...fallbackAgent,
        ...linkedAgent,
        decisionBoardAgentId: linkedAgent?.decisionBoardAgentId || getAgentSelectionId(fallbackAgent),
      }],
    }));
  };
  const applyLinkedBrokerUpdate = (linkedBroker, fallbackBroker, isDetaching) => {
    setDecisionListing((current) => ({
      ...current,
      brokers: isDetaching ? [] : [{
        ...fallbackBroker,
        ...linkedBroker,
        decisionBoardBrokerId: linkedBroker?.decisionBoardBrokerId || getBrokerSelectionId(fallbackBroker),
      }],
    }));
  };

  const selectAgent = async (agent) => {
    const decisionBoardAgentId = getAgentSelectionId(agent);
    if (!decisionListing?.id || !decisionBoardAgentId || saving) return;

    const currentAgentId = selectedAgentId;
    const isDetaching = currentAgentId === decisionBoardAgentId;
    const currentLinkedAgent = findLinkedAgentForBoardAgentId(currentAgentId, linkedAgents, board?.agents || []);
    const nextLinkedAgent = findLinkedAgentForBoardAgentId(decisionBoardAgentId, linkedAgents, board?.agents || []);
    const currentListingAgentId = getAgentLinkId(currentLinkedAgent);
    const nextListingAgentId = getAgentLinkId(nextLinkedAgent);

    setSelectedAgentId(isDetaching ? '' : decisionBoardAgentId);
    setSaving(true);

    try {
      let updated;
      if (isDetaching) {
        if (!nextListingAgentId) {
          throw new Error('Agent link is missing. Refresh the board and try again.');
        }
        updated = await detachDecisionBoardListingAgent(decisionListing.id, nextListingAgentId);
      } else {
        if (currentAgentId && !currentListingAgentId) {
          throw new Error('Current agent link is missing. Refresh the board and try again.');
        }
        if (currentListingAgentId) {
          await detachDecisionBoardListingAgent(decisionListing.id, currentListingAgentId);
        }
        updated = await attachDecisionBoardListingAgent(decisionListing.id, { decisionBoardAgentId });
      }

      if (updated?.agents || updated?.listing) {
        applyDecisionListingUpdate(updated);
      } else {
        applyLinkedAgentUpdate(updated, agent, isDetaching);
      }
    } catch (error) {
      setSelectedAgentId(currentAgentId);
      Alert.alert('Agent update failed', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not update the estate agent for this property.');
    } finally {
      setSaving(false);
    }
  };

  const selectBroker = async (broker) => {
    const decisionBoardBrokerId = getBrokerSelectionId(broker);
    if (!decisionListing?.id || !decisionBoardBrokerId || saving) return;

    const currentBrokerId = selectedBrokerId;
    const isDetaching = currentBrokerId === decisionBoardBrokerId;
    const currentLinkedBroker = findLinkedBrokerForBoardBrokerId(currentBrokerId, linkedBrokers, board?.brokers || []);
    const nextLinkedBroker = findLinkedBrokerForBoardBrokerId(decisionBoardBrokerId, linkedBrokers, board?.brokers || []);
    const currentListingBrokerId = getBrokerLinkId(currentLinkedBroker);
    const nextListingBrokerId = getBrokerLinkId(nextLinkedBroker);

    setSelectedBrokerId(isDetaching ? '' : decisionBoardBrokerId);
    setSaving(true);

    try {
      let updated;
      if (isDetaching) {
        if (!nextListingBrokerId) {
          throw new Error('Broker link is missing. Refresh the board and try again.');
        }
        updated = await detachDecisionBoardListingBroker(decisionListing.id, nextListingBrokerId);
      } else {
        if (currentBrokerId && !currentListingBrokerId) {
          throw new Error('Current broker link is missing. Refresh the board and try again.');
        }
        if (currentListingBrokerId) {
          await detachDecisionBoardListingBroker(decisionListing.id, currentListingBrokerId);
        }
        updated = await attachDecisionBoardListingBroker(decisionListing.id, { decisionBoardBrokerId });
      }

      if (updated?.brokers || updated?.listing) {
        applyDecisionListingUpdate(updated);
      } else {
        applyLinkedBrokerUpdate(updated, broker, isDetaching);
      }
    } catch (error) {
      setSelectedBrokerId(currentBrokerId);
      Alert.alert('Broker update failed', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not update the mortgage broker for this property.');
    } finally {
      setSaving(false);
    }
  };

  const addTask = async () => {
    const trimmed = taskName.trim();
    if (!decisionListing?.id || !trimmed) return;

    setSaving(true);
    try {
      const task = await addDecisionBoardTask(decisionListing.id, {
        taskName: trimmed,
        taskType: 'general',
        status: 'pending',
      });
      setDecisionListing((current) => ({ ...current, tasks: [task, ...(current?.tasks || [])] }));
      setTaskName('');
    } catch (error) {
      Alert.alert('Task not added', error?.response?.data?.error || error?.message || 'Could not add this task.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task) => {
    if (!decisionListing?.id || !task?.id) return;

    const nextStatus = getTaskDone(task) ? 'pending' : 'completed';
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
    setDecisionListing((current) => ({
      ...current,
      tasks: (current?.tasks || []).map((item) => item.id === task.id ? { ...item, status: nextStatus, completedAt } : item),
    }));

    try {
      await updateDecisionBoardTask(decisionListing.id, task.id, { status: nextStatus, completedAt });
    } catch (error) {
      Alert.alert('Task update failed', error?.response?.data?.error || error?.message || 'Could not update this task.');
    }
  };

  const removeTask = async (task) => {
    if (!decisionListing?.id || !task?.id) return;

    setDecisionListing((current) => ({
      ...current,
      tasks: (current?.tasks || []).filter((item) => item.id !== task.id),
    }));

    try {
      await deleteDecisionBoardTask(decisionListing.id, task.id);
    } catch (error) {
      Alert.alert('Task delete failed', error?.response?.data?.error || error?.message || 'Could not delete this task.');
    }
  };

  const addTimelineNote = async () => {
    const trimmed = timelineNote.trim();
    if (!decisionListing?.id || !trimmed) return;

    setSaving(true);
    try {
      const event = await addDecisionBoardTimelineEvent(decisionListing.id, {
        stageName: decisionListing.listingStatus || 'Active',
        status: 'completed',
        notes: trimmed,
        eventDate: new Date().toISOString(),
      });
      setDecisionListing((current) => ({ ...current, timeline: [event, ...(current?.timeline || [])] }));
      setTimelineNote('');
    } catch (error) {
      Alert.alert('Timeline not updated', error?.response?.data?.error || error?.message || 'Could not add this timeline note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{getListingTitle(listing)}</Text>
          <Text style={styles.headerSubtitle}>{board?.boardName || 'Decision Board'} / {statusMeta.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.heroCard} activeOpacity={0.9} onPress={() => navigation.navigate('ListingDetail', { listing })}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <Ionicons name="home-outline" size={34} color="#CBD5E1" />
            </View>
          )}
          <View style={styles.heroBody}>
            <View style={styles.statusLine}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={styles.statusText}>{statusMeta.label}</Text>
            </View>
            <Text style={styles.heroPrice}>{String(getListingPrice(listing))}</Text>
            <Text style={styles.heroTitle}>{getListingTitle(listing)}</Text>
            {loadingListing ? <Text style={styles.loadingHint}>Loading full property details...</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.chipWrap}>
            {LISTING_STATUSES.map((status) => {
              const selected = decisionListing?.listingStatus === status;
              return (
                <TouchableOpacity key={status} style={[styles.chip, selected && styles.chipSelected]} onPress={() => setListingStatus(status)} disabled={saving}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{status}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verdict</Text>
          <View style={styles.chipWrap}>
            {USER_VERDICTS.map((verdict) => {
              const selected = decisionListing?.userVerdict === verdict;
              return (
                <TouchableOpacity key={verdict} style={[styles.chip, selected && styles.chipSelected]} onPress={() => patchListing({ userVerdict: verdict })} disabled={saving}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{verdict}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estate agent</Text>
          <View style={styles.dropdownList}>
            {(board?.agents || []).map((agent) => {
              const agentSelectionId = getAgentSelectionId(agent);
              const selected = selectedAgentId === agentSelectionId;
              return (
                <TouchableOpacity
                  key={agent.id || agent.realEstateAgentId || agent.agentName}
                  style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                  onPress={() => selectAgent(agent)}
                  disabled={saving}
                >
                  <Ionicons name="business-outline" size={18} color={selected ? APP_PURPLE : '#64748B'} />
                  <View style={styles.dropdownText}>
                    <Text style={styles.dropdownTitle}>{agent.agentName || 'Agent'}</Text>
                    <Text style={styles.dropdownMeta}>{selected ? 'Linked to this property' : agent.companyName || 'Estate agent'}</Text>
                  </View>
                  <Text style={[styles.linkActionText, selected && styles.linkActionTextSelected]}>
                    {selected ? 'Linked' : 'Link'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {!(board?.agents || []).length ? <Text style={styles.emptyInline}>Add estate agents from the Decision Board.</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mortgage broker</Text>
          <View style={styles.dropdownList}>
            {(board?.brokers || []).map((broker) => {
              const brokerSelectionId = getBrokerSelectionId(broker);
              const selected = selectedBrokerId === brokerSelectionId;
              return (
                <TouchableOpacity
                  key={broker.id || broker.brokerId || broker.brokerName}
                  style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                  onPress={() => selectBroker(broker)}
                  disabled={saving}
                >
                  <Ionicons name="cash-outline" size={18} color={selected ? APP_PURPLE : '#64748B'} />
                  <View style={styles.dropdownText}>
                    <Text style={styles.dropdownTitle}>{broker.brokerName || 'Broker'}</Text>
                    <Text style={styles.dropdownMeta}>{selected ? 'Linked to this property' : `${broker.companyName || 'Mortgage broker'} / ${broker.status || 'Contacted'}`}</Text>
                  </View>
                  <Text style={[styles.linkActionText, selected && styles.linkActionTextSelected]}>
                    {selected ? 'Linked' : 'Link'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {!(board?.brokers || []).length ? <Text style={styles.emptyInline}>Add mortgage brokers from the Decision Board.</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.noteList}>
            {savedNotes.map((note) => (
              <View key={note.id || `${note.noteText}-${note.createdAt}`} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View>
                    <Text style={styles.noteLabel}>{note.isLegacy ? 'Legacy note' : 'Saved note'}</Text>
                    <Text style={styles.noteDate}>
                      {formatDate(note.updatedAt || note.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.noteActions}>
                    <TouchableOpacity onPress={() => editNote(note)} style={styles.noteActionButton}>
                      <Text style={styles.noteActionText}>Edit</Text>
                    </TouchableOpacity>
                    {!note.isLegacy ? (
                      <TouchableOpacity onPress={() => removeNote(note)} style={styles.noteActionButton}>
                        <Text style={[styles.noteActionText, styles.noteDeleteText]}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.noteText}>{note.noteText}</Text>
              </View>
            ))}
            {!savedNotes.length ? <Text style={styles.emptyInline}>No notes added yet.</Text> : null}
          </View>
          <TextInput
            style={styles.notesInput}
            multiline
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Add viewing notes, concerns, agent feedback, or next-step context."
            placeholderTextColor="#94A3B8"
            textAlignVertical="top"
          />
          {editingNote ? (
            <TouchableOpacity style={styles.secondaryInlineButton} onPress={cancelNoteEdit} disabled={saving}>
              <Text style={styles.secondaryInlineButtonText}>Cancel edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.inlineButton} onPress={saveNotes} disabled={saving || !notesDraft.trim()}>
            <Ionicons name="save-outline" size={17} color="#FFFFFF" />
            <Text style={styles.inlineButtonText}>{editingNote ? 'Update note' : 'Save note'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <Text style={styles.sectionHint}>{taskCounts.complete}/{taskCounts.total} complete</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.rowInput} value={taskName} onChangeText={setTaskName} placeholder="Add task" placeholderTextColor="#94A3B8" />
            <TouchableOpacity style={styles.squareButton} onPress={addTask} disabled={saving || !taskName.trim()}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {tasks.map((task) => (
            <View key={task.id || task.taskName} style={styles.taskRow}>
              <TouchableOpacity style={styles.taskCheck} onPress={() => toggleTask(task)}>
                <Ionicons name={getTaskDone(task) ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={getTaskDone(task) ? '#22C55E' : '#94A3B8'} />
              </TouchableOpacity>
              <View style={styles.taskBody}>
                <Text style={[styles.taskName, getTaskDone(task) && styles.taskDone]}>{task.taskName}</Text>
                <Text style={styles.taskMeta}>{task.taskType || 'general'} / {task.status || 'pending'}</Text>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => removeTask(task)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.inputRow}>
            <TextInput style={styles.rowInput} value={timelineNote} onChangeText={setTimelineNote} placeholder="Add progress note" placeholderTextColor="#94A3B8" />
            <TouchableOpacity style={styles.squareButton} onPress={addTimelineNote} disabled={saving || !timelineNote.trim()}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {timeline.map((event) => (
            <View key={event.id || `${event.stageName}-${event.createdAt}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineBody}>
                <Text style={styles.timelineStage}>{event.stageName || 'Timeline event'}</Text>
                {!!event.notes && <Text style={styles.timelineNotes}>{event.notes}</Text>}
                <Text style={styles.timelineDate}>{formatDate(event.eventDate || event.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media & documents</Text>
          {media.length ? media.map((item) => (
            <View key={item.id || item.fileUrl} style={styles.mediaRow}>
              <Ionicons name="document-text-outline" size={20} color={APP_PURPLE} />
              <View style={styles.mediaBody}>
                <Text style={styles.mediaTitle}>{item.caption || item.mediaType || 'Media item'}</Text>
                <Text style={styles.mediaMeta}>{item.isPublic ? 'Public' : 'Private'} / {item.mediaType || 'Media'}</Text>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyInline}>Photos, videos, audio and documents will appear here.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7F8FB', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12 },
  headerIconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerText: { flex: 1, paddingHorizontal: 6 },
  headerTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  content: { padding: 16, paddingBottom: 34 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 8, marginBottom: 14, overflow: 'hidden' },
  heroImage: { backgroundColor: '#EEF2F7', height: 190, width: '100%' },
  placeholderImage: { alignItems: 'center', justifyContent: 'center' },
  heroBody: { padding: 14 },
  statusLine: { alignItems: 'center', flexDirection: 'row' },
  statusDot: { borderRadius: 999, height: 10, marginRight: 7, width: 10 },
  statusText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  heroPrice: { color: APP_PURPLE, fontSize: 20, fontWeight: '900', marginTop: 8 },
  heroTitle: { color: '#111827', fontSize: 16, fontWeight: '900', lineHeight: 22, marginTop: 5 },
  loadingHint: { color: '#94A3B8', fontSize: 12, fontWeight: '800', marginTop: 8 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 8, marginBottom: 14, padding: 14 },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#EEF2FF', borderColor: APP_PURPLE },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  chipTextSelected: { color: APP_PURPLE },
  dropdownList: { marginTop: 10 },
  dropdownItem: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginTop: 8, padding: 10 },
  dropdownItemSelected: { backgroundColor: '#EEF2FF', borderColor: APP_PURPLE },
  dropdownText: { flex: 1, marginLeft: 9 },
  dropdownTitle: { color: '#111827', fontSize: 13, fontWeight: '900' },
  dropdownMeta: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 2 },
  linkActionText: { color: APP_PURPLE, fontSize: 12, fontWeight: '900', marginLeft: 10, paddingHorizontal: 4, paddingVertical: 4 },
  linkActionTextSelected: { color: '#15803D' },
  emptyInline: { color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 8 },
  noteList: { marginTop: 10 },
  noteCard: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, marginTop: 8, padding: 10 },
  noteHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  noteLabel: { color: APP_PURPLE, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  noteDate: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginTop: 3 },
  noteActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  noteActionButton: { paddingHorizontal: 4, paddingVertical: 2 },
  noteActionText: { color: APP_PURPLE, fontSize: 12, fontWeight: '900' },
  noteDeleteText: { color: '#DC2626' },
  noteText: { color: '#334155', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  notesInput: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 14, lineHeight: 20, marginTop: 12, minHeight: 112, padding: 12 },
  inlineButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: APP_PURPLE, borderRadius: 8, flexDirection: 'row', marginTop: 10, minHeight: 40, paddingHorizontal: 13 },
  inlineButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 6 },
  secondaryInlineButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6 },
  secondaryInlineButtonText: { color: '#64748B', fontSize: 13, fontWeight: '900' },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rowInput: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, color: '#111827', flex: 1, fontSize: 14, minHeight: 42, paddingHorizontal: 11 },
  squareButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  taskRow: { alignItems: 'center', borderTopColor: '#E5E7EB', borderTopWidth: 1, flexDirection: 'row', marginTop: 10, paddingTop: 10 },
  taskCheck: { height: 38, justifyContent: 'center', width: 34 },
  taskBody: { flex: 1 },
  taskName: { color: '#111827', fontSize: 14, fontWeight: '800' },
  taskDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  taskMeta: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 3 },
  deleteButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  timelineRow: { flexDirection: 'row', marginTop: 14 },
  timelineDot: { backgroundColor: APP_PURPLE, borderRadius: 999, height: 10, marginRight: 10, marginTop: 5, width: 10 },
  timelineBody: { flex: 1 },
  timelineStage: { color: '#111827', fontSize: 14, fontWeight: '900' },
  timelineNotes: { color: '#475569', fontSize: 13, lineHeight: 19, marginTop: 4 },
  timelineDate: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginTop: 5 },
  mediaRow: { alignItems: 'center', borderTopColor: '#E5E7EB', borderTopWidth: 1, flexDirection: 'row', marginTop: 10, paddingTop: 10 },
  mediaBody: { flex: 1, marginLeft: 10 },
  mediaTitle: { color: '#111827', fontSize: 14, fontWeight: '800' },
  mediaMeta: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 3 },
});
