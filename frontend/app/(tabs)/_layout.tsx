import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: theme.textPrimary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="dashboard" options={{
        title: 'Dashboard',
        tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
      }} />
      <Tabs.Screen name="screener" options={{
        title: 'Screener',
        tabBarIcon: ({ color, size }) => <Ionicons name="funnel" size={size} color={color} />,
      }} />
      <Tabs.Screen name="watchlist" options={{
        title: 'Watchlist',
        tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
      }} />
      <Tabs.Screen name="alerts" options={{
        title: 'Alerts',
        tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
