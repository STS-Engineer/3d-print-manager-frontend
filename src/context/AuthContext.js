import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { clearStoredAuth } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const syncClearedAuth = () => {
      if (!cancelled) setUser(null);
    };

    window.addEventListener('auth:cleared', syncClearedAuth);

    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        clearStoredAuth();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/profile', { skipAuthRedirect: true });
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
      } catch (_) {
        clearStoredAuth();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
      window.removeEventListener('auth:cleared', syncClearedAuth);
    };
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
