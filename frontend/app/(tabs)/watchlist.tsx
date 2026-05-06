import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import { useAuth } from '../../src/AuthContext';
import { exportCsv } from '../../src/exporter';

export default function Watchlist() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/watchlist');
      setItems(data.items);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.results);
    } catch {}
  };

  const add = async (symbol: string) => {
    try {
      await api.post('/watchlist', { symbol });
      setModal(false); setQuery(''); setSearchResults([]);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed');
    }
  };

  const remove = (symbol: string) => {
    Alert.alert('Remove', `Remove ${symbol} from watchlist?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(`/watchlist/${symbol}`); load(); } catch {}
      }},
    ]);
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="watchlist-screen">
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>Watchlist</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>AI-tracked stocks</Text>
        </View>
        <TouchableOpacity
          testID="btn-compare"
          onPress={() => {
            if (!isPremium) {
              Alert.alert('Premium feature', 'Side-by-side comparison is part of Pav Premium.', [
                { text: 'Maybe later', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/(tabs)/settings') },
              ]);
              return;
            }
            if (items.length < 2) {
              Alert.alert('Need more stocks', 'Add at least 2 stocks to your watchlist before comparing.');
              return;
            }
            router.push('/compare');
          }}
          style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border, marginRight: 8 }]}>
          <Ionicons name="git-compare-outline" size={18} color={isPremium ? theme.textPrimary : theme.textTertiary} />
          {!isPremium && <Ionicons name="lock-closed" size={9} color={theme.textTertiary} style={{ position: 'absolute', top: 4, right: 4 }} />}
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-export-watchlist"
          onPress={() => {
            if (!isPremium) {
              Alert.alert('Premium feature', 'CSV export is part of Pav Premium.', [
                { text: 'Maybe later', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/(tabs)/settings') },
              ]);
              return;
            }
            if (items.length === 0) {
              Alert.alert('Empty', 'Your watchlist is empty.');
              return;
            }
            exportCsv('/exports/watchlist.csv', `pav_watchlist_${new Date().toISOString().slice(0,10)}.csv`);
          }}
          style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border, marginRight: 8 }]}>
          <Ionicons name="download-outline" size={18} color={isPremium ? theme.textPrimary : theme.textTertiary} />
          {!isPremium && <Ionicons name="lock-closed" size={9} color={theme.textTertiary} style={{ position: 'absolute', top: 4, right: 4 }} />}
        </TouchableOpacity>
        <TouchableOpacity testID="btn-add-watch" onPress={() => setModal(true)} style={[s.addBtn, { backgroundColor: theme.primary }]}>
          <Ionicons name="add" size={22} color={theme.primaryFg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.textPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.symbol}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.textPrimary} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <Ionicons name="star-outline" size={48} color={theme.textTertiary} />
              <Text style={{ color: theme.textSecondary, marginTop: 12 }}>No stocks yet</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 4 }}>Tap + to track your first stock</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = item.direction === 'UP' ? theme.bullish : item.direction === 'DOWN' ? theme.bearish : theme.neutral;
            return (
              <TouchableOpacity testID={`watch-${item.symbol}`} onPress={() => router.push(`/stock/${item.symbol}`)} onLongPress={() => remove(item.symbol)} style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.symbol}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>${item.current_price.toFixed(2)}</Text>
                  <Text style={{ color, fontSize: 12, marginTop: 2 }}>{item.expected_return_pct > 0 ? '+' : ''}{item.expected_return_pct.toFixed(2)}%</Text>
                </View>
                <View style={{ backgroundColor: color + '22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 50, alignItems: 'center' }}>
                  <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{item.direction}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Add stock</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Ionicons name="close" size={24} color={theme.textPrimary} /></TouchableOpacity>
          </View>
          <TextInput
            testID="input-search"
            placeholder="Search symbol or company..."
            placeholderTextColor={theme.textTertiary}
            value={query}
            onChangeText={search}
            autoFocus
            autoCapitalize="characters"
            style={{ margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.textPrimary }}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(r) => r.symbol}
            renderItem={({ item }) => (
              <TouchableOpacity testID={`search-${item.symbol}`} onPress={() => add(item.symbol)} style={{ padding: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{item.symbol}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
