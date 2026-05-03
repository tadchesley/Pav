import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
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

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/predictions/top/movers');
      setData(data);
    } catch (e) {
      console.warn('dashboard load failed', e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
          <Text style={[s.greeting, { color: theme.textSecondary }]}>Welcome back</Text>
          <Text style={[s.name, { color: theme.textPrimary }]}>{user?.full_name || user?.email.split('@')[0]}</Text>
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
          {data?.gainers.map((m) => <MoverCard key={m.symbol} m={m} theme={theme} onPress={() => router.push(`/stock/${m.symbol}`)} />)}
        </Section>

        <Section title="Top predicted losers" theme={theme}>
          {data?.losers.map((m) => <MoverCard key={m.symbol} m={m} theme={theme} onPress={() => router.push(`/stock/${m.symbol}`)} />)}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; theme: any; children: React.ReactNode }> = ({ title, theme, children }) => (
  <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
    <Text style={{ fontSize: 12, letterSpacing: 1, color: theme.textSecondary, marginBottom: 12, fontWeight: '600' }}>{title.toUpperCase()}</Text>
    {children}
  </View>
);

const MoverCard: React.FC<{ m: Mover; theme: any; onPress: () => void }> = ({ m, theme, onPress }) => {
  const isUp = m.direction === 'UP';
  const color = isUp ? theme.bullish : m.direction === 'DOWN' ? theme.bearish : theme.neutral;
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
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  greeting: { fontSize: 14 },
  name: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  card: { marginHorizontal: 16, padding: 20, borderRadius: 16, borderWidth: 1 },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  sentimentScore: { fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  sentimentLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
