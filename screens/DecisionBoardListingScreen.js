import React, { useEffect, useMemo, useState } from 'react';
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
  addDecisionBoardTask,
  addDecisionBoardTimelineEvent,
  deleteDecisionBoardTask,
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
const getTaskDone = (task) => String(task?.status || '').toLowerCase() === 'completed';
const statusToTrafficLight = (status) => (status === 'Closed' ? 'Red' : status === 'Tentative' ? 'Orange' : 'Green');

export default function DecisionBoardListingScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const board = route.params?.decisionBoard || null;
  const [decisionListing, setDecisionListing] = useState(route.params?.decisionBoardListing || null);
  const [fullListing, setFullListing] = useState(decisionListing?.listing || null);
  const [loadingListing, setLoadingListing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState(decisionListing?.notes || '');
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
  const taskCounts = useMemo(() => ({
    complete: tasks.filter(getTaskDone).length,
    total: tasks.length,
  }), [tasks]);

  useEffect(() => {
    const listingId = decisionListing?.listingId || decisionListing?.ListingID || listing?.ID;
    if (!listingId) return;

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

  const patchListing = async (payload) => {
    if (!board?.id || !decisionListing?.id) return;

    setSaving(true);
    try {
      const updated = await updateDecisionBoardListing(board.id, decisionListing.id, payload);
      setDecisionListing((current) => ({ ...current, ...updated, listing: current?.listing }));
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.error || error?.message || 'Could not update this property.');
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = () => patchListing({ notes: notesDraft });

  const setListingStatus = (listingStatus) => patchListing({
    listingStatus,
    trafficLightStatus: statusToTrafficLight(listingStatus),
  });

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
              const selected = selectedAgentId === agent.id;
              return (
                <TouchableOpacity key={agent.id || agent.agentName} style={[styles.dropdownItem, selected && styles.dropdownItemSelected]} onPress={() => setSelectedAgentId(agent.id)}>
                  <Ionicons name="business-outline" size={18} color={selected ? APP_PURPLE : '#64748B'} />
                  <View style={styles.dropdownText}>
                    <Text style={styles.dropdownTitle}>{agent.agentName || 'Agent'}</Text>
                    <Text style={styles.dropdownMeta}>{agent.companyName || 'Estate agent'}</Text>
                  </View>
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
              const selected = selectedBrokerId === broker.id;
              return (
                <TouchableOpacity key={broker.id || broker.brokerName} style={[styles.dropdownItem, selected && styles.dropdownItemSelected]} onPress={() => setSelectedBrokerId(broker.id)}>
                  <Ionicons name="cash-outline" size={18} color={selected ? APP_PURPLE : '#64748B'} />
                  <View style={styles.dropdownText}>
                    <Text style={styles.dropdownTitle}>{broker.brokerName || 'Broker'}</Text>
                    <Text style={styles.dropdownMeta}>{broker.companyName || 'Mortgage broker'} / {broker.status || 'Contacted'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!(board?.brokers || []).length ? <Text style={styles.emptyInline}>Add mortgage brokers from the Decision Board.</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Add viewing notes, concerns, agent feedback, or next-step context."
            placeholderTextColor="#94A3B8"
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.inlineButton} onPress={saveNotes} disabled={saving}>
            <Ionicons name="save-outline" size={17} color="#FFFFFF" />
            <Text style={styles.inlineButtonText}>Save notes</Text>
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
  emptyInline: { color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 8 },
  notesInput: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 14, lineHeight: 20, marginTop: 12, minHeight: 112, padding: 12 },
  inlineButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: APP_PURPLE, borderRadius: 8, flexDirection: 'row', marginTop: 10, minHeight: 40, paddingHorizontal: 13 },
  inlineButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 6 },
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
