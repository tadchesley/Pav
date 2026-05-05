import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { useTheme } from '../../src/ThemeContext';
import { Gauge } from '../../src/Charts';

type Mover = { symbol: string; name: string; current_price: number; ai_score: number; direction: string; expected_return_pct: number; confidence: number };

export default function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<{ gainers: Mover[]; losers: Mover[]; market_sentiment: number; sentiment_label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/predictions/top/movers');
      setData(data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(q)}`);
      const tops = data.results.slice(0, 6);
      // Fetch quick prediction previews for each
      const preds = await Promise.allSettled(tops.map((r: any) => api.get(`/predictions/${r.symbol}?deep=false`).then(x => x.data)));
      const enriched = tops.map((r: any, i: number) => {
        const p = preds[i].status === 'fulfilled' ? (preds[i] as any).value : null;
        return { ...r, prediction: p };
      });
      setSearchResults(enriched);
    } catch {} finally { setSearching(false); }
  }, []);

  const s = styles(theme);

  if (loading) return (
    <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={theme.textPrimary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.textPrimary} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { color: theme.textSecondary }]}>Welcome back</Text>
            <Text style={[s.name, { color: theme.textPrimary }]}>{user?.full_name || user?.email.split('@')[0]}</Text>
          </View>
          <TouchableOpacity testID="btn-open-search" onPress={() => setSearchOpen(true)} style={[s.searchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.cardLabel, { color: theme.textSecondary }]}>MARKET SENTIMENT</Text>
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <Gauge value={data?.market_sentiment ?? 50} theme={theme} size={160} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.sentimentScore, { color: theme.textPrimary }]}>{(data?.market_sentiment ?? 50).toFixed(0)}</Text>
            <Text style={[s.sentimentLabel, { color: data?.sentiment_label === 'Bullish' ? theme.bullish : data?.sentiment_label === 'Bearish' ? theme.bearish : theme.neutral }]}>
              {data?.sentiment_label ?? 'Neutral'}
            </Text>
          </View>
        </View>

        <Section title="Top predicted gainers" theme={theme}>
          {data?.gainers.map((m) => <MoverCard key={m.symbol} m={m} theme={theme} forceColor={theme.bullish} onPress={() => router.push(`/stock/${m.symbol}`)} />)}
        </Section>

        <Section title="Top predicted losers" theme={theme}>
          {data?.losers.map((m) => <MoverCard key={m.symbol} m={m} theme={theme} forceColor={theme.bearish} onPress={() => router.push(`/stock/${m.symbol}`)} />)}
        </Section>
      </ScrollView>

      <Modal visible={searchOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              testID="input-dashboard-search"
              placeholder="Search by symbol or company..."
              placeholderTextColor={theme.textTertiary}
              value={searchQ}
              onChangeText={runSearch}
              autoFocus
              autoCapitalize="characters"
              style={{ flex: 1, marginLeft: 10, fontSize: 16, color: theme.textPrimary, paddingVertical: 8 }}
            />
            <TouchableOpacity testID="btn-close-search" onPress={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}>
              <Ionicons name="close" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          {searching && <ActivityIndicator style={{ marginTop: 16 }} color={theme.textPrimary} />}
          <FlatList
            data={searchResults}
            keyExtractor={(r) => r.symbol}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={!searching && searchQ.length > 0 ? (
              <Text style={{ textAlign: 'center', color: theme.textTertiary, marginTop: 40 }}>No matches</Text>
            ) : null}
            renderItem={({ item }) => {
              const p = item.prediction;
              const color = p?.direction === 'UP' ? theme.bullish : p?.direction === 'DOWN' ? theme.bearish : theme.neutral;
              return (
                <TouchableOpacity testID={`search-result-${item.symbol}`} onPress={() => { setSearchOpen(false); router.push(`/stock/${item.symbol}`); }}
                  style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.symbol}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.description}</Text>
                  </View>
                  {p ? (
                    <>
                      <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                        <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>${p.current_price.toFixed(2)}</Text>
                        <Text style={{ color, fontSize: 12, marginTop: 2 }}>{p.expected_return_pct > 0 ? '+' : ''}{p.expected_return_pct.toFixed(2)}%</Text>
                      </View>
                      <View style={{ backgroundColor: color + '22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 48, alignItems: 'center' }}>
                        <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{p.direction}</Text>
                      </View>
                    </>
                  ) : <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; theme: any; children: React.ReactNode }> = ({ title, theme, children }) => (
  <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
    <Text style={{ fontSize: 12, letterSpacing: 1, color: theme.textSecondary, marginBottom: 12, fontWeight: '600' }}>{title.toUpperCase()}</Text>
    {children}
  </View>
);

const MoverCard: React.FC<{ m: Mover; theme: any; onPress: () => void; forceColor?: string }> = ({ m, theme, onPress, forceColor }) => {
  const autoColor = m.direction === 'UP' ? theme.bullish : m.direction === 'DOWN' ? theme.bearish : theme.neutral;
  const color = forceColor ?? autoColor;
  return (
    <TouchableOpacity testID={`mover-${m.symbol}`} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{m.symbol}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{m.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>${m.current_price.toFixed(2)}</Text>
        <Text style={{ color, fontSize: 12, marginTop: 2 }}>{m.expected_return_pct > 0 ? '+' : ''}{m.expected_return_pct.toFixed(2)}%</Text>
      </View>
      <View style={{ backgroundColor: color + '22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 56, alignItems: 'center' }}>
        <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{m.ai_score.toFixed(0)}</Text>
        <Text style={{ color, fontSize: 9 }}>{(m.confidence * 100).toFixed(0)}%</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
};

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  greeting: { fontSize: 14 },
  name: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { marginHorizontal: 16, padding: 20, borderRadius: 16, borderWidth: 1 },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  sentimentScore: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  sentimentLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
