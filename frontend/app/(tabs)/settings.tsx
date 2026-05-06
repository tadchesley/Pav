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
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [agreedPremium, setAgreedPremium] = useState(false);

  const upgrade = async () => {
    if (!agreedPremium) { Alert.alert('Agreement required', 'Please accept the Terms to continue.'); return; }
    try {
      await api.post('/subscription/upgrade', { plan });
      await refreshUser();
      setPaywall(false); setAgreedPremium(false);
      Alert.alert('Welcome to Premium', `Subscribed to ${plan} plan (MOCKED). Stripe integration deferred.`);
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

        <TouchableOpacity testID="btn-account" onPress={() => router.push('/account')} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
          <Ionicons name="person-circle" size={22} color={theme.textPrimary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Account</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Edit name, email, password & view payment method</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </TouchableOpacity>

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

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>NOTIFICATIONS</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="notifications" size={20} color={theme.textPrimary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Alert notifications</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                Pav sends a banner notification when a price alert triggers. Manage permissions, sound, and lock-screen visibility in your phone's <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>System Settings → Notifications → Pav</Text>.
              </Text>
            </View>
          </View>
        </View>

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
          <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={theme.textPrimary} />
          <Text style={{ flex: 1, marginLeft: 12, color: theme.textPrimary, fontWeight: '500' }}>Dark mode</Text>
          <Switch testID="toggle-theme" value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: theme.primary, false: theme.border }} thumbColor={theme.surfaceElevated} />
        </View>

        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>ABOUT</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
            Pav uses AI ensemble models (statistical indicators + Claude Sonnet 4.5 reasoning + real Yahoo Finance data) trained on historical market data.
            Predictions carry inherent uncertainty. <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>This is not financial advice.</Text> Always do your own research.
          </Text>
        </View>

        {user?.is_admin && (
          <>
            <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>ADMIN</Text>
            <TouchableOpacity
              testID="btn-admin-dashboard"
              onPress={() => router.push('/admin')}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={18} color={theme.primaryFg} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Admin Dashboard</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Users, subscriptions & analytics</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
          </>
        )}

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
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#FAFAFA', fontSize: 14, letterSpacing: 2, marginBottom: 8, marginTop: 20 }}>PAV PREMIUM</Text>
              <Text style={{ color: '#FAFAFA', fontSize: 40, fontWeight: '700', letterSpacing: -1.5, marginBottom: 20 }}>Unlock AI Alpha</Text>
              {[
                'Unlimited watchlist symbols (free: 15)',
                'Unlimited alerts (free: 3)',
                'AI-narrative predictions with Claude Sonnet 4.5',
                'Multi-horizon forecasts: 1D / 1W / 1M',
                'Advanced screener: confidence ≥75% & sector filters',
                '1-year price history (free: 7 days)',
              ].map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" style={{ marginTop: 2 }} />
                  <Text style={{ color: '#FAFAFA', marginLeft: 12, fontSize: 15, flex: 1 }}>{f}</Text>
                </View>
              ))}

              <View style={{ marginTop: 24 }}>
                <TouchableOpacity testID="plan-yearly" onPress={() => setPlan('yearly')} style={{
                  borderWidth: 2, borderColor: plan === 'yearly' ? '#FAFAFA' : '#3F3F46',
                  backgroundColor: plan === 'yearly' ? 'rgba(250,250,250,0.06)' : 'transparent',
                  borderRadius: 14, padding: 16, marginBottom: 10,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#FAFAFA', fontSize: 18, fontWeight: '700' }}>Yearly</Text>
                        <View style={{ backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                          <Text style={{ color: '#09090B', fontSize: 10, fontWeight: '700' }}>SAVE 17%</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#A1A1AA', fontSize: 12, marginTop: 2 }}>$4.17/mo · billed annually</Text>
                    </View>
                    <Text style={{ color: '#FAFAFA', fontSize: 22, fontWeight: '700' }}>$49.99</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity testID="plan-monthly" onPress={() => setPlan('monthly')} style={{
                  borderWidth: 2, borderColor: plan === 'monthly' ? '#FAFAFA' : '#3F3F46',
                  backgroundColor: plan === 'monthly' ? 'rgba(250,250,250,0.06)' : 'transparent',
                  borderRadius: 14, padding: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FAFAFA', fontSize: 18, fontWeight: '700' }}>Monthly</Text>
                      <Text style={{ color: '#A1A1AA', fontSize: 12, marginTop: 2 }}>Billed monthly · cancel anytime</Text>
                    </View>
                    <Text style={{ color: '#FAFAFA', fontSize: 22, fontWeight: '700' }}>$4.99</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity testID="toggle-agree-premium" onPress={() => setAgreedPremium(a => !a)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 20 }}>
                <View style={{ width: 20, height: 20, borderWidth: 1.5, borderColor: '#3F3F46', borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: agreedPremium ? '#FAFAFA' : 'transparent' }}>
                  {agreedPremium && <Ionicons name="checkmark" size={14} color="#09090B" />}
                </View>
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 12, color: '#A1A1AA', lineHeight: 18 }}>
                  I accept the <Text onPress={() => router.push('/terms')} style={{ color: '#FAFAFA', fontWeight: '600' }}>Terms of Service</Text> and acknowledge AI predictions are <Text style={{ color: '#EF4444', fontWeight: '600' }}>not financial advice</Text>. Subscription auto-renews until canceled.
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View>
              <Text style={{ color: '#A1A1AA', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>Stripe checkout (MOCKED in MVP) · Cancel anytime from Settings</Text>
              <TouchableOpacity testID="btn-confirm-upgrade" onPress={upgrade} disabled={!agreedPremium} style={{ backgroundColor: '#FAFAFA', padding: 18, borderRadius: 999, alignItems: 'center', opacity: agreedPremium ? 1 : 0.5 }}>
                <Text style={{ color: '#09090B', fontWeight: '700', fontSize: 16 }}>
                  {plan === 'yearly' ? 'Start yearly — $49.99' : 'Start monthly — $4.99'}
                </Text>
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
