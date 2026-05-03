import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User } from './api';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name?: string) => Promise<void>;
  socialSignIn: (provider: 'google' | 'apple', email: string, full_name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const { data } = await api.get('/auth/me');
        setUser(data);
      }
    } catch {
      await AsyncStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { bootstrap(); }, []);

  const handleAuth = async (data: any) => {
    await AsyncStorage.setItem('auth_token', data.access_token);
    setUser(data.user);
  };

  return (
    <Ctx.Provider value={{
      user, loading,
      signIn: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        await handleAuth(data);
      },
      signUp: async (email, password, full_name) => {
        const { data } = await api.post('/auth/signup', { email, password, full_name });
        await handleAuth(data);
      },
      socialSignIn: async (provider, email, full_name) => {
        const { data } = await api.post('/auth/social', { provider, email, full_name });
        await handleAuth(data);
      },
      signOut: async () => {
        await AsyncStorage.removeItem('auth_token');
        setUser(null);
      },
      refreshUser: async () => {
        const { data } = await api.get('/auth/me');
        setUser(data);
      },
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth needs AuthProvider');
  return v;
};
