import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${BASE}/api`;

export const api = axios.create({ baseURL: API_BASE, timeout: 40000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type User = {
  id: string;
  email: string;
  full_name?: string | null;
  tier: string;
  theme: 'dark' | 'light';
  created_at: string;
};

export type Prediction = {
  symbol: string;
  name: string;
  sector?: string;
  current_price: number;
  ai_score: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  expected_return_pct: number;
  target_price: number;
  confidence: number;
  horizon_days: number;
  indicators?: any;
  narrative?: string;
  key_factors?: string[];
  risks?: string[];
  feature_importance?: Record<string, number>;
};
