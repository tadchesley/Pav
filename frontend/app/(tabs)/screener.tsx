import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

const DIRECTIONS = ['ALL', 'UP', 'DOWN', 'NEUTRAL'] as const;
const SECTORS = ['ALL', 'Technology', 'Financial Services', 'Healthcare', 'Consumer Cyclical', 'Consumer Defensive', 'Communication Services', 'Energy'];
const CONF = [
  { label: 'Any', v: 0 }, { label: '≥60%', v: 0.6 }, { label: '≥75%', v: 0.75 }, { label: '≥85%', v: 0.85 },
];

export default function Screener() {
  const { theme } = useTheme();
  const router = useRouter();
  const [dir, setDir] = useState<string>('ALL');
  const [sector, setSector] = useState<string>('ALL');
  const [minConf, setMinConf] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = { min_confidence: minConf };
      if (dir !== 'ALL') body.direction = dir;
      if (sector !== 'ALL') body.sector = sector;
      const { data } = await api.post('/predictions/screener', body);
      setResults(data.results);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [dir, sector, minConf]);

  useEffect(() => { load(); }, [load]);

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="screener-screen">
      <View style={s.header}>
        <Text style={[s.title, { color: theme.textPrimary }]}>Screener</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>Filter by AI confidence & sector</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {DIRECTIONS.map(d => (
          <Chip key={d} label={d} active={dir === d} onPress={() => setDir(d)} theme={theme} testID={`chip-dir-${d}`} />
        ))}
        <View style={{ width: 10 }} />
        {CONF.map(c => (
          <Chip key={c.label} label={c.label} active={minConf === c.v} onPress={() => setMinConf(c.v)} theme={theme} testID={`chip-conf-${c.v}`} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.chipRow, { marginTop: 8 }]} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {SECTORS.map(sec => (
          <Chip key={sec} label={sec} active={sector === sec} onPress={() => setSector(sec)} theme={theme} testID={`chip-sector-${sec.replace(/\s/g, '_')}`} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.textPrimary} /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(it) => it.symbol}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.textPrimary} />}
          renderItem={({ item }) => (
            <TouchableOpacity testID={`screener-row-${item.symbol}`} onPress={() => router.push(`/stock/${item.symbol}`)} style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.symbol}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 2 }}>{item.sector}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>${item.current_price.toFixed(2)}</Text>
                <Text style={{
                  color: item.direction === 'UP' ? theme.bullish : item.direction === 'DOWN' ? theme.bearish : theme.neutral,
                  fontSize: 13, fontWeight: '600', marginTop: 2,
                }}>{item.direction === 'UP' ? '▲' : item.direction === 'DOWN' ? '▼' : '◆'} {item.expected_return_pct > 0 ? '+' : ''}{item.expected_return_pct.toFixed(2)}%</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>Score {item.ai_score.toFixed(0)} · {(item.confidence * 100).toFixed(0)}%</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textTertiary, marginTop: 40 }}>No matches. Adjust filters.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const Chip: React.FC<any> = ({ label, active, onPress, theme, testID }) => (
  <TouchableOpacity testID={testID} onPress={onPress} style={{
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: active ? theme.primary : theme.surface,
    borderWidth: 1, borderColor: active ? theme.primary : theme.border,
    marginRight: 8,
  }}>
    <Text style={{ color: active ? theme.primaryFg : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  chipRow: { flexGrow: 0 },
  row: { flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
