// contexts/FavoritesContext.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getFavorites, getHistory, setFavorite as apiSetFavorite, markViewed as apiMarkViewed } from '../services/activityApi';

const FavoritesContext = createContext({
  toggleFavorite: async () => {},
  markViewed: async () => {},
  setLastViewed: async () => {},
  getFavoriteStatus: () => ({ isFavorited: false }),
  favoriteStatuses: {},
  hydrate: async () => {},
});

const k = (id) => String(id);

export const FavoritesProvider = ({ children }) => {
  const [favoriteStatuses, setFavoriteStatuses] = useState({});
  const hydratingRef = useRef(false);

  const hydrate = async () => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    try {
      const [favs, hist] = await Promise.all([
        getFavorites(), // has isFavorited:true and lastViewedAt (if any)
        getHistory(100), // has lastViewedAt, isFavorited:false
      ]);
      setFavoriteStatuses((prev) => {
        const next = { ...prev };
        for (const it of favs) {
          const idKey = k(it.ID ?? it.id);
          next[idKey] = {
            ...(next[idKey] || {}),
            isFavorited: true,
            ...(it.lastViewedAt ? { lastViewedAt: it.lastViewedAt } : {}),
          };
        }
        for (const it of hist) {
          const idKey = k(it.ID ?? it.id);
          next[idKey] = {
            ...(next[idKey] || {}),
            isFavorited: false, // history explicitly 0
            ...(it.lastViewedAt ? { lastViewedAt: it.lastViewedAt } : {}),
          };
        }
        return next;
      });
    } catch (e) {
      console.warn('Favorites hydrate failed:', e?.message);
    } finally {
      hydratingRef.current = false;
    }
  };

  useEffect(() => { hydrate(); }, []);

  const toggleFavorite = async (listingId, desired) => {
    const idKey = k(listingId);
    if (!idKey) return;

    const current = favoriteStatuses[idKey]?.isFavorited || false;
    const nextVal = typeof desired === 'boolean' ? desired : !current;

    // Optimistic: if turning OFF and no lastViewedAt, set one so it moves to "Viewed"
    setFavoriteStatuses((prev) => ({
      ...prev,
      [idKey]: {
        ...(prev[idKey] || {}),
        isFavorited: nextVal,
        ...(nextVal ? {} : { lastViewedAt: (prev[idKey]?.lastViewedAt || new Date().toISOString()) }),
      },
    }));

    try {
      await apiSetFavorite(listingId, nextVal);
    } catch (e) {
      console.warn('toggleFavorite failed:', e?.message);
      // rollback
      setFavoriteStatuses((prev) => ({
        ...prev,
        [idKey]: { ...(prev[idKey] || {}), isFavorited: current },
      }));
    }
  };

  const markViewed = async (listingId) => {
    const idKey = k(listingId);
    if (!idKey) return;

    const ts = new Date().toISOString();
    setFavoriteStatuses((prev) => ({
      ...prev,
      [idKey]: { ...(prev[idKey] || {}), lastViewedAt: ts },
    }));

    try {
      await apiMarkViewed(listingId);
    } catch (e) {
      console.warn('markViewed failed:', e?.message);
    }
  };

  // Back-compat alias: UI-only setter
  const setLastViewed = async (maybeId, timestamp) => {
    const idNum = Number(maybeId);
    if (!Number.isFinite(idNum)) return;
    const idKey = k(idNum);
    const ts = timestamp || new Date().toISOString();
    setFavoriteStatuses((prev) => ({
      ...prev,
      [idKey]: { ...(prev[idKey] || {}), lastViewedAt: ts },
    }));
  };

  const getFavoriteStatus = (listingId) =>
    favoriteStatuses[k(listingId)] || { isFavorited: false };

  const value = useMemo(() => ({
    toggleFavorite,
    markViewed,
    setLastViewed,
    getFavoriteStatus,
    favoriteStatuses,
    hydrate,
  }), [favoriteStatuses]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoritesContext);
export default FavoritesContext;
