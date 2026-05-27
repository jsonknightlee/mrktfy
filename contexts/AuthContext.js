// contexts/AuthContext.js
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { getToken, saveToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';

export const AuthContext = createContext({
  isLoggedIn: null,
  setIsLoggedIn: () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export default function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return setIsLoggedIn(false);
      try {
        await fetchUserProfile(token);
        setIsLoggedIn(true);
      } catch {
        await deleteToken();
        setIsLoggedIn(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    isLoggedIn,
    setIsLoggedIn, // keep for now to avoid refactors
    signIn: async (token) => {
      console.log('🔐 Auth: signIn called with token');
      await saveToken(token);
      console.log('🔐 Auth: Token saved');
      setIsLoggedIn(true);
      console.log('🔐 Auth: setIsLoggedIn(true) called');
      console.log('🔐 Auth: signIn completed');
    },
    signOut: async () => {
      await deleteToken();
      setIsLoggedIn(false);
    },
  }), [isLoggedIn]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
