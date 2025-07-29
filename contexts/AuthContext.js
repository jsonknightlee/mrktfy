// contexts/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { getToken, saveToken, deleteToken } from '../utils/tokenStorage';
import { fetchUserProfile } from '../services/authApi';

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking

  useEffect(() => {
    const checkLogin = async () => {
      const token = await getToken();
      if (token) {
        try {
          await fetchUserProfile(token);
          setIsLoggedIn(true);
        } catch {
          await deleteToken();
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    };
    checkLogin();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};
