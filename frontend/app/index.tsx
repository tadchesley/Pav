import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/ThemeContext';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/(tabs)/dashboard');
    else router.replace('/auth');
  }, [user, loading]);

  return (
    <View testID="splash" style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.textPrimary} size="large" />
    </View>
  );
}
