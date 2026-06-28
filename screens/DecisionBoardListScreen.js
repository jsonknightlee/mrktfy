import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  addDecisionBoardListing,
  BOARD_LIMITS,
  BOARD_TYPES,
  createDecisionBoard,
  getDecisionBoards,
} from '../services/DecisionBoardService';
import { getListingById } from '../services/listingApi';

const APP_PURPLE = '#6366F1';
const DECISION_BOARD_COUNT_LIMITS = {
  free: 1,
  prospector: 1,
  investor: 5,
  developer: 10,
};

const getDecisionBoardCountLimit = (tier) => {
  const normalizedTier = String(tier || 'free').toLowerCase();
  return DECISION_BOARD_COUNT_LIMITS[normalizedTier] ?? 0;
};

const getDefaultBoardType = (tier) => (
  String(tier || 'free').toLowerCase() === 'free' ? 'Free' : 'Buyer'
);

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

const getListingId = (listing) => (
  listing?.ID ??
  listing?.id ??
  listing?.ListingID ??
  listing?.listingId ??
  ''
);

const getListingTitle = (listing) => listing?.Title || listing?.title || listing?.Address || listing?.address || 'Property';
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

const getBoardListingPreview = (boardListing) => (
  boardListing?.listing ||
  boardListing?.Listing ||
  boardListing?.listingSummary ||
  boardListing?.ListingSummary ||
  boardListing?.property ||
  boardListing?.Property ||
  boardListing ||
  null
);

const getBoardListingId = (boardListing) => {
  const listing = getBoardListingPreview(boardListing);
  return boardListing?.listingId || boardListing?.ListingID || getListingId(listing);
};

const getBoardListingPreviewWithCache = (boardListing, cache) => {
  const listing = getBoardListingPreview(boardListing);
  const listingId = getBoardListingId(boardListing);
  const cachedListing = listingId ? cache?.get(String(listingId)) : null;

  if (!cachedListing) return listing;

  return {
    ...(listing || {}),
    ...cachedListing,
    ID: String(listingId),
  };
};

const getBoardLight = (board) => {
  if (board.status === 'Closed') return { color: '#EF4444', label: 'Closed' };
  if (board.status === 'Tentative') return { color: '#F97316', label: 'Tentative / on-hold' };
  return { color: '#22C55E', label: 'Active / open' };
};

export default function DecisionBoardListScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { currentTier } = useSubscription();
  const listingPreviewCacheRef = useRef(new Map());
  const pendingListing = route.params?.pendingListing || null;
  const pendingSource = route.params?.pendingSource || {};
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBoardId, setSavingBoardId] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardType, setBoardType] = useState(() => getDefaultBoardType(currentTier));
  const boardCountLimit = getDecisionBoardCountLimit(currentTier);

  const pendingImageUrl = useMemo(
    () => normalizeImageUrls(pendingListing?.ImageUrls || pendingListing?.imageUrls || pendingListing?.imageUrl)[0],
    [pendingListing]
  );

  const boardPreviewSignature = useMemo(() => (
    boards.map((board) => {
      const previewIds = (board.listings || [])
        .slice(0, 4)
        .map((boardListing) => getBoardListingId(boardListing) || '')
        .join(',');
      return `${board.id || ''}:${previewIds}`;
    }).join('|')
  ), [boards]);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    try {
      const nextBoards = await getDecisionBoards();
      setBoards(nextBoards);
    } catch (error) {
      Alert.alert('DecisionBoards unavailable', error?.response?.data?.error || error?.message || 'Could not load DecisionBoards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!boards.length) return;

    let isCancelled = false;

    const enrichBoardPreviews = async () => {
      const nextBoards = await Promise.all(boards.map(async (board) => {
        const listings = board.listings || [];
        let changed = false;
        const nextListings = [...listings];

        for (let index = 0; index < Math.min(listings.length, 4); index += 1) {
          const boardListing = listings[index];
          const listing = getBoardListingPreviewWithCache(boardListing, listingPreviewCacheRef.current);
          const existingImage = normalizeImageUrls(getListingImageValue(listing))[0];
          const listingId = getBoardListingId(boardListing);

          if (existingImage || !listingId) continue;

          try {
            let fullListing = listingPreviewCacheRef.current.get(String(listingId));
            if (!fullListing) {
              const result = await getListingById(listingId);
              fullListing = result?.listing || result?.Listing || result;
              if (fullListing) listingPreviewCacheRef.current.set(String(listingId), fullListing);
            }

            if (fullListing) {
              nextListings[index] = {
                ...boardListing,
                listing: {
                  ...(boardListing?.Listing || {}),
                  ...(boardListing?.listing || {}),
                  ...fullListing,
                  ID: String(listingId),
                },
              };
              changed = true;
            }
          } catch {}
        }

        return changed ? { ...board, listings: nextListings } : board;
      }));

      if (!isCancelled) setBoards(nextBoards);
    };

    enrichBoardPreviews();

    return () => {
      isCancelled = true;
    };
  }, [boardPreviewSignature]);

  useFocusEffect(useCallback(() => {
    loadBoards();
  }, [loadBoards]));

  useEffect(() => {
    if (pendingListing) {
      setBoardName(pendingSource.suggestedBoardName || `${getListingTitle(pendingListing).split(',')[0] || 'Property'} Search`);
    }
  }, [pendingListing, pendingSource.suggestedBoardName]);

  useEffect(() => {
    if (createModalVisible) {
      setBoardType(getDefaultBoardType(currentTier));
    }
  }, [createModalVisible, currentTier]);

  const addPendingListingToBoard = async (board) => {
    const listingId = getListingId(pendingListing);
    if (!listingId || !board?.id || savingBoardId) return;

    const activeCount = (board.listings || []).filter((item) => item.listingStatus !== 'Closed').length;
    if (activeCount >= board.maxProperties) {
      Alert.alert('Board limit reached', `${board.boardType} boards can hold ${board.maxProperties} active properties.`);
      return;
    }

    setSavingBoardId(board.id);
    try {
      await addDecisionBoardListing(board.id, {
        listingId,
        shortListListingId: pendingSource.shortListListingId,
        shortListId: pendingSource.shortListId,
        listingStatus: 'Active',
        trafficLightStatus: 'Green',
        userVerdict: 'Maybe',
      });
      const refreshedBoard = (await getDecisionBoards()).find((item) => item.id === board.id);
      navigation.navigate('DecisionBoard', {
        decisionBoardId: board.id,
        decisionBoard: refreshedBoard || board,
      });
    } catch (error) {
      Alert.alert('Property not added', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not add this property to the DecisionBoard.');
    } finally {
      setSavingBoardId(null);
    }
  };

  const openCreateBoard = () => {
    if (boardCountLimit <= 0) {
      Alert.alert(
        'Decision Board is a Buyer feature',
        'Upgrade to Buyer to create a Decision Board.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View plans', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }

    if (boards.length >= boardCountLimit) {
      const limitMessage = String(currentTier || 'free').toLowerCase() === 'free'
        ? 'Free includes 1 Decision Board. Upgrade to Buyer for the full buying workflow and Buyer Workspace.'
        : boardCountLimit === 1
          ? 'Buyer includes 1 Decision Board. Delete or close an existing board, or upgrade to Investor.'
          : `Your plan includes ${boardCountLimit} Decision Boards.`;

      Alert.alert(
        'Decision Board limit reached',
        limitMessage,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View plans', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }

    setCreateModalVisible(true);
  };

  const createBoard = async () => {
    const trimmedName = boardName.trim();
    if (!trimmedName) return;

    if (boardCountLimit <= 0 || boards.length >= boardCountLimit) {
      openCreateBoard();
      return;
    }

    setSavingBoardId('new');
    try {
      const board = await createDecisionBoard({
        boardName: trimmedName,
        boardType,
        status: 'Active',
        maxProperties: BOARD_LIMITS[boardType] || BOARD_LIMITS.Free,
      });

      if (pendingListing) {
        await addDecisionBoardListing(board.id, {
          listingId: getListingId(pendingListing),
          shortListListingId: pendingSource.shortListListingId,
          shortListId: pendingSource.shortListId,
          listingStatus: 'Active',
          trafficLightStatus: 'Green',
          userVerdict: 'Maybe',
        });
      }

      setCreateModalVisible(false);
      setBoardName('');
      const nextBoards = await getDecisionBoards();
      setBoards(nextBoards);
      navigation.navigate('DecisionBoard', {
        decisionBoardId: board.id,
        decisionBoard: nextBoards.find((item) => item.id === board.id) || board,
      });
    } catch (error) {
      Alert.alert('Board not created', error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Could not create this DecisionBoard.');
    } finally {
      setSavingBoardId(null);
    }
  };

  const renderBoard = ({ item }) => {
    const light = getBoardLight(item);
    const activeCount = (item.listings || []).filter((listing) => listing.listingStatus !== 'Closed').length;
    const isAdding = savingBoardId === item.id;

    return (
      <View style={styles.boardCard}>
        <View style={[styles.lightRail, { backgroundColor: light.color }]} />
        <View style={styles.boardCardBody}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('DecisionBoard', { decisionBoardId: item.id, decisionBoard: item })}
          >
            <View style={styles.boardTopRow}>
              <View style={styles.boardIcon}>
                <Ionicons name="flag-outline" size={22} color={APP_PURPLE} />
              </View>
              <View style={styles.boardText}>
                <Text style={styles.boardName}>{item.boardName}</Text>
                <Text style={styles.boardMeta}>{item.boardType} / {light.label}</Text>
              </View>
              <Text style={styles.boardCount}>{activeCount}/{item.maxProperties}</Text>
            </View>
            <View style={styles.propertyPreviewRow}>
              {(item.listings || []).slice(0, 4).map((boardListing, index) => {
                const listing = getBoardListingPreviewWithCache(boardListing, listingPreviewCacheRef.current);
                const imageUrl = normalizeImageUrls(getListingImageValue(listing))[0];
                return imageUrl ? (
                  <Image key={boardListing.id || `${item.id}-${index}`} source={{ uri: imageUrl }} style={styles.previewThumb} />
                ) : (
                  <View key={boardListing.id || `${item.id}-${index}`} style={[styles.previewThumb, styles.previewThumbEmpty]}>
                    <Ionicons name="home-outline" size={15} color="#CBD5E1" />
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
          {pendingListing ? (
            <TouchableOpacity
              style={[styles.addToBoardButton, isAdding && styles.disabledButton]}
              onPress={() => addPendingListingToBoard(item)}
              disabled={isAdding}
            >
              <Ionicons name="add-circle-outline" size={18} color={isAdding ? '#94A3B8' : '#FFFFFF'} />
              <Text style={[styles.addToBoardButtonText, isAdding && styles.disabledButtonText]}>
                {isAdding ? 'Adding...' : 'Add property to this board'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Decision Boards</Text>
          <Text style={styles.headerSubtitle}>Active property acquisition projects</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={openCreateBoard}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {pendingListing ? (
        <View style={styles.pendingPanel}>
          {pendingImageUrl ? (
            <Image source={{ uri: pendingImageUrl }} style={styles.pendingImage} />
          ) : (
            <View style={[styles.pendingImage, styles.previewThumbEmpty]}>
              <Ionicons name="home-outline" size={22} color="#CBD5E1" />
            </View>
          )}
          <View style={styles.pendingBody}>
            <Text style={styles.pendingEyebrow}>Add property to Decision Board</Text>
            <Text style={styles.pendingTitle} numberOfLines={2}>{getListingTitle(pendingListing)}</Text>
            <Text style={styles.pendingPrice}>{String(getListingPrice(pendingListing))}</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={APP_PURPLE} />
        </View>
      ) : (
        <FlatList
          data={boards}
          renderItem={renderBoard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Decision Boards yet</Text>
              <Text style={styles.emptyText}>Create a board for a purchase, investment, or development project.</Text>
            </View>
          }
        />
      )}

      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Decision Board</Text>
              <TouchableOpacity style={styles.headerIconButton} onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                value={boardName}
                onChangeText={setBoardName}
                placeholder="Board name"
                placeholderTextColor="#94A3B8"
              />
              <View style={styles.typeRow}>
                {BOARD_TYPES.map((type) => {
                  const selected = boardType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, selected && styles.typeButtonSelected]}
                      onPress={() => setBoardType(type)}
                    >
                      <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>
                        {type} ({BOARD_LIMITS[type]})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.modalCreateButton, savingBoardId === 'new' && styles.disabledButton]}
                onPress={createBoard}
                disabled={savingBoardId === 'new' || !boardName.trim()}
              >
                <Text style={[styles.modalCreateButtonText, savingBoardId === 'new' && styles.disabledButtonText]}>
                  {pendingListing ? 'Create and add property' : 'Create board'}
                </Text>
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
  header: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12 },
  headerIconButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  headerText: { flex: 1 },
  headerTitle: { color: '#111827', fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  createButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  pendingPanel: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', padding: 14 },
  pendingImage: { backgroundColor: '#EEF2F7', borderRadius: 8, height: 70, width: 78 },
  pendingBody: { flex: 1, marginLeft: 12 },
  pendingEyebrow: { color: APP_PURPLE, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  pendingTitle: { color: '#111827', fontSize: 14, fontWeight: '900', lineHeight: 19, marginTop: 3 },
  pendingPrice: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 4 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 34 },
  boardCard: { backgroundColor: '#FFFFFF', borderRadius: 8, flexDirection: 'row', marginBottom: 12, overflow: 'hidden' },
  lightRail: { width: 7 },
  boardCardBody: { flex: 1, padding: 13 },
  boardTopRow: { alignItems: 'center', flexDirection: 'row' },
  boardIcon: { alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 8, height: 42, justifyContent: 'center', marginRight: 10, width: 42 },
  boardText: { flex: 1 },
  boardName: { color: '#111827', fontSize: 16, fontWeight: '900' },
  boardMeta: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  boardCount: { color: APP_PURPLE, fontSize: 13, fontWeight: '900' },
  propertyPreviewRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  previewThumb: { backgroundColor: '#EEF2F7', borderRadius: 7, height: 42, width: 48 },
  previewThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  addToBoardButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', marginTop: 12, minHeight: 40 },
  addToBoardButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 7 },
  disabledButton: { backgroundColor: '#E5E7EB' },
  disabledButtonText: { color: '#94A3B8' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 70 },
  emptyTitle: { color: '#111827', fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' },
  modalOverlay: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  modalHeader: { alignItems: 'center', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  modalBody: { padding: 16 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, color: '#111827', fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  typeButton: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  typeButtonSelected: { backgroundColor: '#EEF2FF', borderColor: APP_PURPLE },
  typeButtonText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  typeButtonTextSelected: { color: APP_PURPLE },
  modalCreateButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, justifyContent: 'center', marginTop: 16, minHeight: 46 },
  modalCreateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
