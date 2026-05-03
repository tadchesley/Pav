import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/AuthContext';
import { useTheme } from '../../src/ThemeContext';
import { api } from '../../src/api';

export default function Settings() {
  const { user, signOut, refreshUser } = useAuth();
  const { theme, mode, toggle } = useTheme();
  const router = useRouter();
  const [paywall, setPaywall] = useState(false);

  const upgrade = async () => {
    try {
      await api.post('/subscription/upgrade');
      await refreshUser();
      setPaywall(false);
      Alert.alert('Welcome to Premium', 'Subscription upgraded (MOCKED). Stripe integration deferred.');
    } catch { Alert.alert('Error', 'Upgrade failed'); }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="settings-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={[s.title, { color: theme.textPrimary }]}>Settings</Text>
        </View>

        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={s.userRow}>
            <View style={[s.avatar, { backgroundColor: theme.primary }]}>
              <Text style={{ color: theme.primaryFg, fontWeight: '700', fontSize: 20 }}>
                {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{user?.full_name || user?.email.split('@')[0]}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{user?.email}</Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                  backgroundColor: user?.tier === 'premium' ? theme.bullishBg : theme.neutralBg,
                }}>
                  <Text style={{ color: user?.tier === 'premium' ? theme.bullish : theme.neutral, fontSize: 11, fontWeight: '700' }}>
                    {user?.tier === 'premium' ? 'PREMIUM' : 'FREE'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {user?.tier !== 'premium' && (
          <TouchableOpacity testID="btn-upgrade" onPress={() => setPaywall(true)} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.neutralBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={20} color={theme.neutral} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Unlock AI Alpha</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Unlimited stocks · real-time predictions · advanced screener</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        )}

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
          <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={theme.textPrimary} />
          <Text style={{ flex: 1, marginLeft: 12, color: theme.textPrimary, fontWeight: '500' }}>Dark mode</Text>
          <Switch testID="toggle-theme" value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: theme.primary, false: theme.border }} thumbColor={theme.surfaceElevated} />
        </View>

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>ABOUT</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
            AlphaPulse uses AI ensemble models (statistical indicators + Claude Sonnet 4.5 reasoning) trained on historical market data.
            Predictions carry inherent uncertainty. <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>This is not financial advice.</Text> Always do your own research.
          </Text>
        </View>

        <TouchableOpacity testID="btn-signout" onPress={async () => { await signOut(); router.replace('/auth'); }}
          style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="log-out-outline" size={18} color={theme.bearish} />
          <Text style={{ color: theme.bearish, fontWeight: '600', marginLeft: 8 }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={paywall} animationType="slide" transparent={false} onRequestClose={() => setPaywall(false)}>
        <View style={{ flex: 1, backgroundColor: '#09090B' }}>
          <Image source={{ uri: 'https://images.pexels.com/photos/6770775/pexels-photo-6770775.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.25 }} />
          <SafeAreaView style={{ flex: 1, padding: 24 }}>
            <TouchableOpacity onPress={() => setPaywall(false)} style={{ alignSelf: 'flex-end' }}>
              <Ionicons name="close" size={28} color="#FAFAFA" />
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ color: '#FAFAFA', fontSize: 14, letterSpacing: 2, marginBottom: 8 }}>ALPHAPULSE PREMIUM</Text>
              <Text style={{ color: '#FAFAFA', fontSize: 40, fontWeight: '700', letterSpacing: -1.5, marginBottom: 20 }}>Unlock AI Alpha</Text>
              {['Unlimited stocks tracked', 'Real-time AI predictions', 'Advanced screener filters', 'API access for algorithms', 'Regime change alerts'].map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text style={{ color: '#FAFAFA', marginLeft: 12, fontSize: 16 }}>{f}</Text>
                </View>
              ))}
            </View>
            <View>
              <Text style={{ color: '#A1A1AA', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>$19.99/month · Stripe checkout (MOCKED in MVP)</Text>
              <TouchableOpacity testID="btn-confirm-upgrade" onPress={upgrade} style={{ backgroundColor: '#FAFAFA', padding: 18, borderRadius: 999, alignItems: 'center' }}>
                <Text style={{ color: '#09090B', fontWeight: '700', fontSize: 16 }}>Upgrade now</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600', paddingHorizontal: 16, marginTop: 24, marginBottom: 4 },
});
