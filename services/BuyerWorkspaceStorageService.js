import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const BUYER_WORKSPACE_ITEMS_KEY = 'mrktfy_buyer_workspace_items';

const readItems = async () => {
  try {
    const value = await AsyncStorage.getItem(BUYER_WORKSPACE_ITEMS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeItems = async (items) => {
  await AsyncStorage.setItem(BUYER_WORKSPACE_ITEMS_KEY, JSON.stringify(items));
};

const getWorkspaceItemId = (item = {}) => (
  item.id ||
  [
    item.decisionBoardId || 'board',
    item.decisionBoardListingId || item.listingId || Date.now(),
  ].join('-')
);

export const getBuyerWorkspaceItems = async () => {
  try {
    const { data } = await api.get('/api/buyer-workspace/items');
    const items = Array.isArray(data?.items) ? data.items : [];
    await writeItems(items);
    return items;
  } catch {
    return readItems();
  }
};

export const saveBuyerWorkspaceItem = async (item = {}) => {
  try {
    const { data } = await api.post('/api/buyer-workspace/items', {
      decisionBoardListingId: item.decisionBoardListingId,
    });
    if (data?.item) {
      const items = await readItems();
      await writeItems([
        data.item,
        ...items.filter((existing) => getWorkspaceItemId(existing) !== getWorkspaceItemId(data.item)),
      ]);
      return data.item;
    }
  } catch {}

  const items = await readItems();
  const id = getWorkspaceItemId(item);
  const nextItem = {
    ...item,
    id,
    movedToBuyAt: item.movedToBuyAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const nextItems = [
    nextItem,
    ...items.filter((existing) => getWorkspaceItemId(existing) !== id),
  ];

  await writeItems(nextItems);
  return nextItem;
};

export const removeBuyerWorkspaceItem = async (itemId) => {
  try {
    const { data } = await api.delete(`/api/buyer-workspace/items/${itemId}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    await writeItems(items);
    return items;
  } catch {}

  const items = await readItems();
  const nextItems = items.filter((item) => getWorkspaceItemId(item) !== itemId);
  await writeItems(nextItems);
  return nextItems;
};
