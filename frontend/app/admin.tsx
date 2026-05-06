import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert, FlatList, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/ThemeContext';

type Stats = {
  users: { total: number; free: number; premium: number; monthly_subs: number; yearly_subs: number; by_provider: Record<string, number> };
  signups: { today: number; last_7_days: number; last_30_days: number };
  engagement: { active_alerts: number; total_watchlist: number };
  revenue: { mrr: number; arr: number; currency: string; note: string };
  generated_at: string;
};

type ChartPoint = { date: string; count: number };
type AdminUser = {
  id: string; email: string; full_name?: string | null;
  tier: string; plan?: string | null; provider: string;
  is_admin: boolean; created_at: string;
};
type TopWatched = { symbol: string; count: number };

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [topWatched, setTopWatched] = useState<TopWatched[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c, u, t] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/signups_chart?days=30'),
        api.get(`/admin/users?limit=50${search ? `&q=${encodeURIComponent(search)}` : ''}`),
        api.get('/admin/top_watched?limit=10'),
      ]);
      setStats(s.data);
      setChart(c.data.series || []);
      setUsers(u.data.items || []);
      setTopWatched(t.data.items || []);
    } catch (e: any) {
      const msg = e?.response?.status === 403
        ? 'You are not authorized to view this page.'
        : e?.response?.data?.detail || 'Failed to load admin data';
      Alert.alert('Admin', msg);
      if (e?.response?.status === 403) router.replace('/(tabs)/settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, search]);

  useEffect(() => {
    if (user && !user.is_admin) {
      Alert.alert('Forbidden', 'Admin access required');
      router.replace('/(tabs)/settings');
      return;
    }
    load();
  }, [user, load, router]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const setTier = async (uid: string, tier: 'free' | 'premium', plan?: 'monthly' | 'yearly') => {
    try {
      await api.post(`/admin/users/${uid}/tier`, { tier, plan });
      setEditingUser(null);
      load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const s = styles(theme);

  if (loading && !stats) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 80 }} color={theme.textPrimary} />
      </SafeAreaView>
    );
  }

  const chartMax = Math.max(1, ...chart.map(p => p.count));
  const totalSignups30 = chart.reduce((a, b) => a + b.count, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>Admin</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>Pav platform analytics</Text>
        </View>
        <View style={[s.adminBadge, { backgroundColor: theme.bullishBg }]}>
          <Ionicons name="shield-checkmark" size={14} color={theme.bullish} />
          <Text style={{ color: theme.bullish, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>ADMIN</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textPrimary} />}>

        {/* Headline metrics */}
        <View style={s.cardsRow}>
          <StatCard theme={theme} label="Total Users" value={String(stats?.users.total ?? 0)} icon="people" tone="neutral" />
          <StatCard theme={theme} label="Premium" value={String(stats?.users.premium ?? 0)} icon="star" tone="bullish" sub={`${stats?.users.free ?? 0} on free`} />
        </View>
        <View style={s.cardsRow}>
          <StatCard theme={theme} label="MRR" value={`$${stats?.revenue.mrr.toFixed(2) ?? '0.00'}`} icon="cash" tone="bullish" sub={`ARR ~ $${stats?.revenue.arr.toFixed(0) ?? '0'}`} />
          <StatCard theme={theme} label="Signups Today" value={String(stats?.signups.today ?? 0)} icon="trending-up" tone="neutral" sub={`${stats?.signups.last_7_days ?? 0} last 7d`} />
        </View>
        <View style={s.cardsRow}>
          <StatCard theme={theme} label="Active Alerts" value={String(stats?.engagement.active_alerts ?? 0)} icon="notifications" tone="neutral" />
          <StatCard theme={theme} label="Watchlist Items" value={String(stats?.engagement.total_watchlist ?? 0)} icon="star-outline" tone="neutral" />
        </View>

        {/* Subscription split */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>SUBSCRIPTIONS</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, padding: 16 }]}>
          <SubscriptionBar
            theme={theme}
            free={stats?.users.free ?? 0}
            monthly={stats?.users.monthly_subs ?? 0}
            yearly={stats?.users.yearly_subs ?? 0}
            other={Math.max(0, (stats?.users.premium ?? 0) - (stats?.users.monthly_subs ?? 0) - (stats?.users.yearly_subs ?? 0))}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 12 }}>
            <Legend color={theme.textTertiary} label={`Free (${stats?.users.free ?? 0})`} />
            <Legend color={theme.bullish} label={`Yearly (${stats?.users.yearly_subs ?? 0})`} />
            <Legend color={theme.neutral} label={`Monthly (${stats?.users.monthly_subs ?? 0})`} />
          </View>
        </View>

        {/* Signups chart */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>SIGNUPS — LAST 30 DAYS  ·  {totalSignups30}</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3 }}>
            {chart.map((p, i) => {
              const h = Math.max(2, (p.count / chartMax) * 120);
              return (
                <View key={i} style={{ flex: 1, height: 120, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <View style={{
                    width: '100%', height: h, backgroundColor: p.count > 0 ? theme.bullish : theme.border,
                    borderRadius: 3,
                  }} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: theme.textTertiary, fontSize: 10 }}>{chart[0]?.date.slice(5) || ''}</Text>
            <Text style={{ color: theme.textTertiary, fontSize: 10 }}>{chart[chart.length - 1]?.date.slice(5) || ''}</Text>
          </View>
        </View>

        {/* Sign-up provider breakdown */}
        <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>SIGN-IN PROVIDERS</Text>
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, padding: 16 }]}>
          {Object.entries(stats?.users.by_provider || {}).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name={k === 'google' ? 'logo-google' : k === 'apple' ? 'logo-apple' : 'mail'}
                size={16} color={theme.textPrimary} style={{ width: 24 }} />
              <Text style={{ color: theme.textPrimary, flex: 1, textTransform: 'capitalize', fontWeight: '500' }}>{k}</Text>
              <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{v as number}</Text>
            </View>
          ))}
        </View>

        {/* Top watched stocks */}
        {topWatched.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>MOST-WATCHED STOCKS</Text>
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, padding: 16 }]}>
              {topWatched.map((t, i) => (
                <View key={t.symbol} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Text style={{ color: theme.textTertiary, width: 22, fontWeight: '600' }}>{i + 1}</Text>
                  <Text style={{ color: theme.textPrimary, flex: 1, fontWeight: '600' }}>{t.symbol}</Text>
                  <Text style={{ color: theme.textSecondary }}>{t.count} {t.count === 1 ? 'user' : 'users'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Users list with search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
          <Text style={[s.sectionTitle, { color: theme.textSecondary, marginTop: 0, flex: 1 }]}>USERS  ·  {users.length}</Text>
        </View>
        <View style={[s.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textTertiary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            placeholder="Search by email or name"
            placeholderTextColor={theme.textTertiary}
            style={{ flex: 1, marginLeft: 8, color: theme.textPrimary, fontSize: 14, padding: 0 }}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); load(); }}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {users.map((u) => (
          <TouchableOpacity
            key={u.id}
            onPress={() => setEditingUser(u)}
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}>
            <View style={[s.avatarSm, { backgroundColor: u.tier === 'premium' ? theme.bullish : theme.neutral }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                {(u.full_name || u.email).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                  {u.full_name || u.email.split('@')[0]}
                </Text>
                {u.is_admin && (
                  <View style={{ marginLeft: 6, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: theme.bullishBg, borderRadius: 4 }}>
                    <Text style={{ color: theme.bullish, fontSize: 9, fontWeight: '700' }}>ADMIN</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{u.email}</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 10, marginTop: 2 }}>
                via {u.provider}  ·  joined {new Date(u.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                backgroundColor: u.tier === 'premium' ? theme.bullishBg : theme.neutralBg,
              }}>
                <Text style={{
                  color: u.tier === 'premium' ? theme.bullish : theme.neutral,
                  fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
                }}>{u.tier}{u.plan ? ` · ${u.plan}` : ''}</Text>
              </View>
              <Ionicons name="create-outline" size={16} color={theme.textTertiary} style={{ marginTop: 6 }} />
            </View>
          </TouchableOpacity>
        ))}

        <Text style={{ color: theme.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          Generated {stats?.generated_at ? new Date(stats.generated_at).toLocaleTimeString() : ''} · Pull to refresh
        </Text>
      </ScrollView>

      {/* Edit user modal */}
      <Modal visible={!!editingUser} animationType="slide" transparent onRequestClose={() => setEditingUser(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2, marginBottom: 16 }} />
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
              Manage user
            </Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>{editingUser?.email}</Text>

            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: '600' }}>SET TIER</Text>
            <TouchableOpacity
              onPress={() => editingUser && setTier(editingUser.id, 'free')}
              style={[s.actionBtn, { borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={18} color={theme.textPrimary} />
              <Text style={{ color: theme.textPrimary, marginLeft: 10, fontWeight: '600' }}>Downgrade to Free</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => editingUser && setTier(editingUser.id, 'premium', 'monthly')}
              style={[s.actionBtn, { borderColor: theme.border }]}>
              <Ionicons name="star" size={18} color={theme.bullish} />
              <Text style={{ color: theme.textPrimary, marginLeft: 10, fontWeight: '600' }}>Upgrade to Premium · Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => editingUser && setTier(editingUser.id, 'premium', 'yearly')}
              style={[s.actionBtn, { borderColor: theme.border, marginBottom: 8 }]}>
              <Ionicons name="star" size={18} color={theme.bullish} />
              <Text style={{ color: theme.textPrimary, marginLeft: 10, fontWeight: '600' }}>Upgrade to Premium · Yearly</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setEditingUser(null)} style={{ marginTop: 16, alignItems: 'center', padding: 12 }}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const StatCard = ({ theme, label, value, icon, tone, sub }: any) => {
  const toneColor = tone === 'bullish' ? theme.bullish : tone === 'bearish' ? theme.bearish : theme.neutral;
  const toneBg = tone === 'bullish' ? theme.bullishBg : tone === 'bearish' ? theme.bearishBg : theme.neutralBg;
  return (
    <View style={{
      flex: 1, padding: 14, borderRadius: 14, borderWidth: 1,
      borderColor: theme.border, backgroundColor: theme.surface,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={15} color={toneColor} />
        </View>
        <Text style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 8, flex: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
      {sub && <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
};

const SubscriptionBar = ({ theme, free, monthly, yearly, other }: any) => {
  const total = Math.max(1, free + monthly + yearly + other);
  const seg = (n: number, color: string, key: string) =>
    n > 0 ? <View key={key} style={{ flex: n / total, height: 14, backgroundColor: color }} /> : null;
  return (
    <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: theme.border }}>
      {seg(free, theme.textTertiary, 'free')}
      {seg(yearly, theme.bullish, 'yearly')}
      {seg(monthly, theme.neutral, 'monthly')}
      {seg(other, theme.bearish, 'other')}
    </View>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 6 }} />
    <Text style={{ color, fontSize: 12, fontWeight: '500' }}>{label}</Text>
  </View>
);

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border,
  },
  backBtn: { padding: 6, marginRight: 4 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  avatarSm: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
});
