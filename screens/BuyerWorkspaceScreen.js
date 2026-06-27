import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getBuyerWorkspaceItems,
  getBuyerWorkspaceLimit,
  removeBuyerWorkspaceItem,
} from '../services/BuyerWorkspaceStorageService';

const APP_PURPLE = '#6366F1';

const formatDate = (value) => {
  if (!value) return 'Recently moved';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently moved';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function BuyerWorkspaceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { currentTier } = useSubscription();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const focusWorkspaceItemId = route?.params?.focusWorkspaceItemId || null;
  const workspaceLimit = useMemo(() => getBuyerWorkspaceLimit(currentTier), [currentTier]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setItems(await getBuyerWorkspaceItems());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadItems();
  }, [loadItems, focusWorkspaceItemId]));

  const openWorkspaceItem = (item) => {
    navigation.navigate('Deck', {
      openMode: 'buy',
      openDeckId: item.propertyDeckId || undefined,
      buyerWorkspaceContext: {
        buyerWorkspaceItemId: item.id,
        decisionBoard: item.decisionBoard,
        decisionBoardListing: item.decisionBoardListing,
        listing: item.listing,
      },
    });
  };

  const addWorkspaceItem = () => {
    if (workspaceLimit <= 0) {
      Alert.alert(
        'Buyer Workspace is a Buyer feature',
        'Upgrade to Buyer to move Decision Board listings into the buying journey.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }

    if (items.length >= workspaceLimit) {
      Alert.alert(
        'Buyer Workspace limit reached',
        workspaceLimit === 1
          ? 'Buyer includes 1 active Buyer Workspace property. Delete it to move another property, or upgrade to Investor.'
          : `Your plan includes ${workspaceLimit} active Buyer Workspace properties.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View plans', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }

    navigation.navigate('DecisionBoards');
  };

  const deleteWorkspaceItem = async (item) => {
    const nextItems = await removeBuyerWorkspaceItem(item.id);
    setItems(nextItems);
  };

  const renderItem = ({ item }) => {
    const isFocused = focusWorkspaceItemId && String(item.id) === String(focusWorkspaceItemId);

    return (
      <TouchableOpacity
        style={[styles.workspaceCard, isFocused && styles.workspaceCardFocused]}
        activeOpacity={0.9}
        onPress={() => openWorkspaceItem(item)}
      >
        {item.listingImageUrl ? (
          <Image source={{ uri: item.listingImageUrl }} style={styles.workspaceImage} />
        ) : (
          <View style={[styles.workspaceImage, styles.workspaceImageEmpty]}>
            <Ionicons name="home-outline" size={24} color="#CBD5E1" />
          </View>
        )}
        <View style={styles.workspaceBody}>
          <Text style={styles.workspaceEyebrow}>{item.boardName || 'Decision Board'}</Text>
          <Text style={styles.workspaceTitle} numberOfLines={2}>{item.listingTitle || 'Decision property'}</Text>
          <Text style={styles.workspaceMeta} numberOfLines={1}>
            {item.listingPrice ? `${item.listingPrice} / ` : ''}{item.listingStatus || 'Active'} / {formatDate(item.movedToBuyAt)}
          </Text>
          <View style={styles.workspaceActions}>
            <View style={styles.openPill}>
              <Ionicons name="sparkles-outline" size={14} color={APP_PURPLE} />
              <Text style={styles.openPillText}>Open AI workspace</Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => deleteWorkspaceItem(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Buyer Workspace</Text>
          <Text style={styles.headerSubtitle}>Listings moved from Decision into the buying journey</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addWorkspaceItem}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={APP_PURPLE} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Buyer Workspace items yet</Text>
              <Text style={styles.emptyText}>Open a Decision Board listing and tap Move to Buy when a property is ready for the buying journey.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7F8FB', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12 },
  headerText: { flex: 1, paddingRight: 12 },
  headerTitle: { color: '#111827', fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 3 },
  addButton: { alignItems: 'center', backgroundColor: APP_PURPLE, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 34 },
  workspaceCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 12, padding: 10 },
  workspaceCardFocused: { borderColor: APP_PURPLE },
  workspaceImage: { backgroundColor: '#EEF2F7', borderRadius: 8, height: 92, width: 96 },
  workspaceImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  workspaceBody: { flex: 1, marginLeft: 11 },
  workspaceEyebrow: { color: APP_PURPLE, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  workspaceTitle: { color: '#111827', fontSize: 15, fontWeight: '900', lineHeight: 20, marginTop: 4 },
  workspaceMeta: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 5 },
  workspaceActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  openPill: { alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 8, flexDirection: 'row', minHeight: 30, paddingHorizontal: 9 },
  openPillText: { color: APP_PURPLE, fontSize: 11, fontWeight: '900', marginLeft: 5 },
  removeButton: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 80 },
  emptyTitle: { color: '#111827', fontSize: 17, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' },
});
