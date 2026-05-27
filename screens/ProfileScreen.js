// screens/ProfileScreen.js
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList, Image, ScrollView, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';
import { AuthContext } from '../contexts/AuthContext';
import { getFavorites, getHistory } from '../services/activityApi';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { databaseService } from '../services/databaseService';

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
  const { setIsLoggedIn, isLoggedIn: authIsLoggedIn } = useContext(AuthContext);
  const { toggleFavorite, getFavoriteStatus, setLastViewed, activityTick = 0 } = useFavorites();
  const { clearSubscriptionData, clearAllAsyncStorage, reloadSubscriptionData, currentTier, userProfile, loading, error, getCurrentSubscriptionLevel, updateUserProfile } = useSubscription();
  const [isLoggedIn, setIsLoggedInState] = useState(false);
  const [user, setUser] = useState(null);
  const [userInfo, setUserInfo] = useState(null); // Store token info
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tab, setTab] = useState('profile'); // 'profile' | 'activity' | 'settings'
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  // Edit mode for profile
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    listingTypePreference: 'both',
    bio: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return setIsLoggedInState(false);
        
        // Extract user info from JWT token
        try {
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔑 [PROFILE] Token payload:', tokenPayload);
          setUserInfo(tokenPayload);
        } catch (tokenError) {
          console.error('❌ [PROFILE] Failed to parse token:', tokenError);
        }
        
        const profile = await fetchUserProfile();
        setUser(profile);
      } catch {
        await deleteToken();
        setIsLoggedInState(false);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [setIsLoggedIn]);

  // Initialize edit form when user profile loads
  useEffect(() => {
    if (userProfile && !editMode) {
      console.log('👤 [PROFILE] Available fields in userProfile:', userProfile ? Object.keys(userProfile).join(', ') : 'No profile');
      console.log('👤 [PROFILE] FirstName:', userProfile.FirstName);
      console.log('👤 [PROFILE] LastName:', userProfile.LastName);
      
      setEditForm({
        firstName: userProfile.firstName || userProfile.FirstName || userInfo?.FirstName || '',
        lastName: userProfile.lastName || userProfile.LastName || userInfo?.LastName || '',
        phone: userProfile.phone || userProfile.Phone || '',
        address: userProfile.address || userProfile.Address || '',
        city: userProfile.city || userProfile.City || '',
        postalCode: userProfile.postalCode || userProfile.PostalCode || '',
        listingTypePreference: userProfile.listingTypePreference || userProfile.ListingTypePreference || 'both',
        bio: userProfile.bio || userProfile.Bio || ''
      });
    }
  }, [userProfile, editMode, userInfo]);

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
      
      // Nuclear option - clear ALL AsyncStorage
      try {
        const result = await clearAllAsyncStorage();
        console.log('🧹 Logout: All AsyncStorage cleared, result:', result);
      } catch (subscriptionError) {
        console.error('Logout: Failed to clear AsyncStorage:', subscriptionError);
      }
      
      setIsLoggedInState(false);
      setIsLoggedIn(false); // Also update context
      console.log('🔒 Logout completed');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout failed', 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const onSaveProfile = async () => {
    try {
      const success = await updateUserProfile(editForm);
      if (success) {
        setEditMode(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const openListing = (item) => {
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
        <TouchableOpacity onPress={() => setTab('settings')} style={[styles.tab, tab==='settings' && styles.tabActive]}>
          <Text style={[styles.tabText, tab==='settings' && styles.tabTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'profile' ? (
        <ScrollView style={styles.profilePane}>
          <Text style={styles.title}>Your Profile</Text>
          
          {/* Subscription Info */}
          {loading ? (
            <ActivityIndicator />
          ) : error ? (
            <Text style={styles.errorText}>Error loading subscription: {error}</Text>
          ) : (
            <View style={styles.subscriptionCard}>
              <Text style={styles.subscriptionTitle}>
                Current Plan: {getCurrentSubscriptionLevel()?.name || 'Free'}
              </Text>
              <Text style={styles.subscriptionInfo}>
                Search Radius: {getCurrentSubscriptionLevel()?.searchRadiusKm || 2}km
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => navigation.navigate('Subscription')}
              >
                <Ionicons name="card" size={20} color="#007AFF" />
                <Text style={styles.upgradeButtonText}>Manage Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Profile Info */}
          {loadingProfile ? (
            <ActivityIndicator />
          ) : userProfile ? (
            <View style={styles.profileSection}>
              <View style={styles.profileHeader}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditMode(!editMode)}
                >
                  <Ionicons name={editMode ? "checkmark" : "create"} size={20} color="#007AFF" />
                  <Text style={styles.editButtonText}>{editMode ? 'Save' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>

              {editMode ? (
                <View style={styles.editForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    value={editForm.firstName}
                    onChangeText={(text) => setEditForm({...editForm, firstName: text})}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    value={editForm.lastName}
                    onChangeText={(text) => setEditForm({...editForm, lastName: text})}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone"
                    value={editForm.phone}
                    onChangeText={(text) => setEditForm({...editForm, phone: text})}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Address"
                    value={editForm.address}
                    onChangeText={(text) => setEditForm({...editForm, address: text})}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    value={editForm.city}
                    onChangeText={(text) => setEditForm({...editForm, city: text})}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Postal Code"
                    value={editForm.postalCode}
                    onChangeText={(text) => setEditForm({...editForm, postalCode: text})}
                  />
                  
                  <Text style={styles.label}>Property Type Preference:</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>For Sale</Text>
                    <Switch
                      value={editForm.listingTypePreference === 'both' || editForm.listingTypePreference === 'for-sale'}
                      onValueChange={(value) => setEditForm({
                        ...editForm,
                        listingTypePreference: value ? 'for-sale' : 'to-rent'
                      })}
                    />
                    <Text style={styles.switchLabel}>To Rent</Text>
                  </View>

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Bio (optional)"
                    value={editForm.bio}
                    onChangeText={(text) => setEditForm({...editForm, bio: text})}
                    multiline
                    numberOfLines={3}
                  />

                  <TouchableOpacity style={styles.saveButton} onPress={onSaveProfile}>
                    <Text style={styles.saveButtonText}>Save Profile</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.profileInfo}>
                  <Text style={styles.infoLabel}>First Name:</Text>
                  <Text style={styles.infoValue}>
                    {userProfile.FirstName || userProfile.firstName || userInfo?.FirstName || 'Not set'}
                  </Text>
                  
                  <Text style={styles.infoLabel}>Last Name:</Text>
                  <Text style={styles.infoValue}>
                    {userProfile.LastName || userProfile.lastName || userInfo?.LastName || 'Not set'}
                  </Text>
                  
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>
                    {userProfile.Email || userProfile.email || userInfo?.email || userInfo?.Username || 'Not set'}
                  </Text>
                  
                  <Text style={styles.infoLabel}>Phone:</Text>
                  <Text style={styles.infoValue}>{userProfile.Phone || userProfile.phone || 'Not set'}</Text>
                  
                  <Text style={styles.infoLabel}>Address:</Text>
                  <Text style={styles.infoValue}>
                    {(() => {
                      const hasAddress = userProfile.Address || userProfile.address;
                      if (hasAddress) {
                        return `${userProfile.Address || userProfile.address}, ${userProfile.City || userProfile.city || ''}, ${userProfile.PostalCode || userProfile.postalCode || ''}`;
                      }
                      return 'Not set';
                    })()}
                  </Text>
                  
                  <Text style={styles.infoLabel}>Property Preference:</Text>
                  <Text style={styles.infoValue}>
                    {(() => {
                      const pref = userProfile.ListingTypePreference || userProfile.listingTypePreference;
                      if (pref === 'both') return 'For Sale & To Rent';
                      if (pref === 'for-sale') return 'For Sale Only';
                      if (pref === 'to-rent') return 'To Rent Only';
                      return 'Not set';
                    })()}
                  </Text>
                  
                  {userProfile.Bio || userProfile.bio ? (
                    <>
                      <Text style={styles.infoLabel}>Bio:</Text>
                      <Text style={styles.infoValue}>
                        {typeof userProfile.Bio === 'string' ? userProfile.Bio : typeof userProfile.bio === 'string' ? userProfile.bio : 'Not set'}
                      </Text>
                    </>
                  ) : null}
                </View>
              )}
            </View>
          ) : (
            <Text>Couldn't load profile.</Text>
          )}

          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && { opacity: 0.6 }]}
            onPress={onLogout}
            disabled={loggingOut}
          >
            <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Logout'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : tab === 'settings' ? (
        <View style={styles.settingsPane}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.label}>Settings coming soon...</Text>
        </View>
      ) : (
        <View style={styles.activityPane}>
          {loadingActivity ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <>
              {/* ⭐ Favorites */}
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

              {/* 👀 Recently Viewed */}
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

  profilePane: { flex: 1, padding: 24 },
  settingsPane: { flex: 1, padding: 24 },
  activityPane: { flex: 1, paddingBottom: 8 },
  sectionWrap: { flex: 1, paddingTop: 8 },
  list: { flex: 1 },
  listContent: { paddingBottom: 8 },

  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 16, marginBottom: 8, color: '#333' },
  errorText: { color: 'red', marginBottom: 16 },

  // Subscription Card
  subscriptionCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  subscriptionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  subscriptionInfo: { fontSize: 14, color: '#666', marginBottom: 12 },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start'
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },

  // Profile Section
  profileSection: { marginBottom: 20 },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0'
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4
  },

  // Edit Form
  editForm: { },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 12
  },
  switchLabel: { fontSize: 16, color: '#333' },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },

  // Profile Info Display
  profileInfo: { },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8
  },

  // Buttons
  logoutButton: {
    marginTop: 20,
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center'
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },

  // Activity List
  section: {
    fontWeight: '700',
    fontSize: 16,
    marginTop: 4,
    marginBottom: 6,
    marginLeft: 12
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#f2f2f2'
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f5f5f5'
  },
  titleText: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 3 },
  empty: { color: '#888', marginHorizontal: 12, marginVertical: 8 },
});
