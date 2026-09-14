import React, { createContext, useState, useEffect, useContext } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState(null); // 'ADMIN' or 'KARYAWAN'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setViewMode(localStorage.getItem('viewMode') || parsed.role);
        try {
          // Sync/verify user with server
          const res = await client.get('/auth/me');
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          if (!localStorage.getItem('viewMode')) {
            setViewMode(res.data.user.role);
          }
        } catch (error) {
          console.error('Failed to sync auth status:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await client.post('/auth/login', { email, password });
      const { user: loggedUser, accessToken, refreshToken } = res.data;
      
      if (loggedUser.role !== 'ADMIN') {
        logout();
        throw 'Akses ditolak. Dashboard hanya untuk Administrator.';
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      localStorage.setItem('viewMode', 'ADMIN');
      
      setUser(loggedUser);
      setViewMode('ADMIN');
      return loggedUser;
    } catch (error) {
      if (typeof error === 'string') throw error;
      throw error.response?.data?.error || 'Login gagal';
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('viewMode');
    setUser(null);
    setViewMode(null);
  };

  const switchViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  return (
    <AuthContext.Provider value={{ user, viewMode: 'ADMIN', setViewMode: switchViewMode, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
