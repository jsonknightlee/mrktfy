import React, { createContext, useContext, useState } from 'react';

const FavoritesContext = createContext();

export const FavoritesProvider = ({ children }) => {
  const [favoriteStatuses, setFavoriteStatuses] = useState({});

  const toggleFavorite = (listingId) => {
    setFavoriteStatuses(prev => ({
      ...prev,
      [listingId]: {
        ...prev[listingId],
        isFavorited: !prev[listingId]?.isFavorited
      }
    }));
  };

  const setLastViewed = (listingId, timestamp = new Date().toISOString()) => {
    setFavoriteStatuses(prev => ({
      ...prev,
      [listingId]: {
        ...prev[listingId],
        lastViewedAt: timestamp
      }
    }));
  };

  const getFavoriteStatus = (listingId) => favoriteStatuses[listingId] || {};

  return (
    <FavoritesContext.Provider value={{ toggleFavorite, setLastViewed, getFavoriteStatus }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoritesContext);
