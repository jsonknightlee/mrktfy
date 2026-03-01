// screens/ProfileScreen.js
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';
import { AuthContext } from '../contexts/AuthContext';
import { getFavorites, getHistory } from '../services/activityApi'; // ✅ use activityApi
import { useFavorites } from '../contexts/FavoritesContext';        // 🔔 listen for activity changes

// Minimal helper: safely get the first image URL from ImageUrls/ imageUrl (array/JSON/delimited/string)
const getFirstImageUrl = (val) => {
  if (!val) return null;
  if (Array.isArray(val)) return val.find(Boolean) || null;
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    // try JSON array
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"[') && s.endsWith(']"'))) {
      try {
        const arr = JSON.parse(s.replace(/^"+|"+$/g, ''));
        return Array.isArray(arr) ? (arr.find(Boolean) || null) : null;
      } catch {/* fall through */}
    }
    // delimited or single
    const parts = s.split(/[,|;]+/).map(t => t.trim()).filter(Boolean);
    return parts[0] || null;
  }
  return null;
};

// Safe number formatting for Price fields that might be string/number
const formatNumber = (v) => {
  if (v === 0) return '0';
  if (typeof v === 'number' && Number.isFinite(v)) return v.toLocaleString();
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n.toLocaleString() : '';
  }
  return '';
};

export default function ProfileScreen({ navigation }) {
  const { setIsLoggedIn } = useContext(AuthContext);
  const { activityTick = 0 } = useFavorites(); // 🔔 will increment when favorites/views change elsewhere

  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tab, setTab] = useState('profile'); // 'profile' | 'activity'
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return setIsLoggedIn(false);
        const profile = await fetchUserProfile(); // ✅ interceptor adds token
        setUser(profile);
      } catch {
        await deleteToken();
        setIsLoggedIn(false);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [setIsLoggedIn]);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      // ✅ use activityApi (which already cleans images/prices)
      const [favs, hist] = await Promise.all([getFavorites(), getHistory(20)]);
      setFavorites(favs ?? []);
      setHistory(hist ?? []);
    } catch (e) {
      Alert.alert('Error', 'Could not load activity.');
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  // Load when switching to Activity tab
  useEffect(() => {
    if (tab === 'activity') loadActivity();
  }, [tab, loadActivity]);

  // 🔁 Reload Activity whenever favorites/views change anywhere (heart toggle, view events, etc.)
  useEffect(() => {
    if (tab === 'activity') loadActivity();
  }, [activityTick, tab, loadActivity]);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await deleteToken();
      setIsLoggedIn(false);
    } catch {
      Alert.alert('Logout failed', 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const openListing = (item) => {
    // Pass through to detail; your ListingDetailScreen normalizes fields
    navigation?.navigate?.('ListingDetail', { listing: item });
  };

  const Row = ({ item, subtitle }) => {
    const imageUrl = getFirstImageUrl(item.ImageUrls ?? item.imageUrl);
    const title = item.Title ?? item.title ?? '';
    const priceStr = formatNumber(item.Price ?? item.price);
    const beds = item.Beds ?? item.bedrooms ?? item.Bedrooms;

    return (
      <TouchableOpacity style={styles.card} onPress={() => openListing(item)}>
        {!!imageUrl && <Image style={styles.thumb} source={{ uri: imageUrl }} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {priceStr ? `${priceStr}` : ''}{beds ? ` • ${beds} bed` : ''}
            {subtitle ? ` • ${subtitle}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab('profile')} style={[styles.tab, tab==='profile' && styles.tabActive]}>
          <Text style={[styles.tabText, tab==='profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('activity')} style={[styles.tab, tab==='activity' && styles.tabActive]}>
          <Text style={[styles.tabText, tab==='activity' && styles.tabTextActive]}>Activity</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'profile' ? (
        <View style={styles.profilePane}>
          <Text style={styles.title}>Your Profile</Text>
          {loadingProfile ? (
            <ActivityIndicator />
          ) : user ? (
            <>
              <Text style={styles.label}>Name: {user.Firstname} {user.Lastname}</Text>
              <Text style={styles.label}>Email: {user.Username}</Text>

              <TouchableOpacity
                style={[styles.logoutButton, loggingOut && { opacity: 0.6 }]}
                onPress={onLogout}
                disabled={loggingOut}
              >
                <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Logout'}</Text>
              </TouchableOpacity>

              {/* Subscription Button */}
              <TouchableOpacity
                style={styles.subscriptionButton}
                onPress={() => navigation.navigate('Subscription')}
              >
                <Ionicons name="card" size={20} color="#007AFF" />
                <Text style={styles.subscriptionButtonText}>Upgrade Plan</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text>Couldn’t load profile.</Text>
          )}
        </View>
      ) : (
        <View style={styles.activityPane}>
          {loadingActivity ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <>
              {/* ⭐ Favorites: fixed-height (half the pane), list scrolls inside */}
              <View style={styles.sectionWrap}>
                <Text style={styles.section}>⭐ Favorites</Text>
                <FlatList
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={favorites}
                  keyExtractor={(x) => String(x.ID ?? x.id)}
                  renderItem={({ item }) => (
                    <Row
                      item={item}
                      subtitle={item.favoritedAt ? new Date(item.favoritedAt).toLocaleString() : undefined}
                    />
                  )}
                  ListEmptyComponent={<Text style={styles.empty}>No favorites yet.</Text>}
                  nestedScrollEnabled
                />
              </View>

              {/* 👀 Recently Viewed: fixed-height (half the pane), list scrolls inside */}
              <View style={styles.sectionWrap}>
                <Text style={styles.section}>👀 Recently Viewed</Text>
                <FlatList
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={history}
                  keyExtractor={(x) => String(x.ID ?? x.id)}
                  renderItem={({ item }) => (
                    <Row
                      item={item}
                      subtitle={item.lastViewedAt ? new Date(item.lastViewedAt).toLocaleString() : undefined}
                    />
                  )}
                  ListEmptyComponent={<Text style={styles.empty}>Nothing viewed yet.</Text>}
                  nestedScrollEnabled
                />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', marginTop: 50 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#111' },
  tabText: { fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#111' },

  profilePane: { flex: 1, padding: 24, alignItems: 'center' },

  // Activity pane takes the rest of the screen; each section gets half height and its FlatList scrolls
  activityPane: { flex: 1, paddingBottom: 8 },
  sectionWrap: { flex: 1, paddingTop: 8 },
  list: { flex: 1 },
  listContent: { paddingBottom: 8 },

  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 10 },
  label: { fontSize: 16, marginBottom: 8 },

  logoutButton: { marginTop: 20, backgroundColor: '#f33', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  subscriptionButton: { 
    marginTop: 12, 
    backgroundColor: '#007AFF', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600', 
    marginLeft: 8 
  },
  logoutText: { color: '#fff', fontWeight: 'bold' },

  section: { fontWeight: '700', fontSize: 16, marginTop: 4, marginBottom: 6, marginLeft: 12 },
  card: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#f2f2f2' },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 10, backgroundColor: '#f5f5f5' },
  titleText: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 3 },
  empty: { color: '#888', marginHorizontal: 12, marginVertical: 8 },

  // note: duplicates kept as-is from your template
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
});
