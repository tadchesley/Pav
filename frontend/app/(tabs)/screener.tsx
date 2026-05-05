import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

const CONF = [
  { label: 'Any confidence', v: 0 }, { label: '≥60%', v: 0.6 }, { label: '≥75%', v: 0.75 }, { label: '≥85%', v: 0.85 },
];

export default function Screener() {
  const { theme } = useTheme();
  const router = useRouter();
  const [dir, setDir] = useState<string>('ALL');
  const [sector, setSector] = useState<string>('ALL');
  const [minConf, setMinConf] = useState<number>(0);
  const [all, setAll] = useState<any[]>([]); // full universe with predictions (no filter)
  const [loading, setLoading] = useState(true);

  // Load the entire universe once (no filters) — we filter client-side for snappy UX + count badges.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/predictions/screener', { min_confidence: 0 });
      setAll(data.results);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute counts for each filter option (based on other filters applied)
  const filtered = useMemo(() => {
    return all.filter(x =>
      (dir === 'ALL' || x.direction === dir) &&
      (sector === 'ALL' || x.sector === sector) &&
      (x.confidence >= minConf)
    );
  }, [all, dir, sector, minConf]);

  // Direction counts (ignoring direction filter, respecting sector + conf)
  const dirCounts = useMemo(() => {
    const base = all.filter(x => (sector === 'ALL' || x.sector === sector) && x.confidence >= minConf);
    return {
      ALL: base.length,
      UP: base.filter(x => x.direction === 'UP').length,
      DOWN: base.filter(x => x.direction === 'DOWN').length,
      NEUTRAL: base.filter(x => x.direction === 'NEUTRAL').length,
    };
  }, [all, sector, minConf]);

  // Sector counts (ignoring sector filter, respecting direction + conf) — sorted desc by count
  const sectorList = useMemo(() => {
    const base = all.filter(x => (dir === 'ALL' || x.direction === dir) && x.confidence >= minConf);
    const map = new Map<string, number>();
    map.set('ALL', base.length);
    base.forEach(x => { if (x.sector) map.set(x.sector, (map.get(x.sector) || 0) + 1); });
    const entries = Array.from(map.entries());
    // ALL first, then by count desc
    return [entries.find(e => e[0] === 'ALL')!, ...entries.filter(e => e[0] !== 'ALL').sort((a, b) => b[1] - a[1])];
  }, [all, dir, minConf]);

  // Direction options sorted by count desc (except ALL stays first)
  const dirList = useMemo(() => {
    const arr: { k: string; count: number }[] = [
      { k: 'UP', count: dirCounts.UP },
      { k: 'DOWN', count: dirCounts.DOWN },
      { k: 'NEUTRAL', count: dirCounts.NEUTRAL },
    ].sort((a, b) => b.count - a.count);
    return [{ k: 'ALL', count: dirCounts.ALL }, ...arr];
  }, [dirCounts]);

  const resetFilters = () => { setDir('ALL'); setSector('ALL'); setMinConf(0); };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="screener-screen">
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>Screener</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>{filtered.length} match{filtered.length === 1 ? '' : 'es'}</Text>
        </View>
        {(dir !== 'ALL' || sector !== 'ALL' || minConf > 0) && (
          <TouchableOpacity testID="btn-clear-filters" onPress={resetFilters} style={[s.clearBtn, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[s.rowLabel, { color: theme.textTertiary }]}>DIRECTION</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {dirList.map(d => (
          <Chip key={d.k} label={d.k === 'ALL' ? 'All' : d.k} count={d.count} active={dir === d.k} onPress={() => setDir(d.k)} theme={theme} testID={`chip-dir-${d.k}`} />
        ))}
      </ScrollView>

      <Text style={[s.rowLabel, { color: theme.textTertiary }]}>CONFIDENCE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {CONF.map(c => (
          <Chip key={c.label} label={c.label} active={minConf === c.v} onPress={() => setMinConf(c.v)} theme={theme} testID={`chip-conf-${c.v}`} />
        ))}
      </ScrollView>

      <Text style={[s.rowLabel, { color: theme.textTertiary }]}>SECTOR</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {sectorList.map(([sec, count]) => (
          <Chip key={sec} label={sec === 'ALL' ? 'All sectors' : sec} count={count} active={sector === sec} onPress={() => setSector(sec)} theme={theme} testID={`chip-sector-${String(sec).replace(/\s/g, '_')}`} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.textPrimary} /></View>
      ) : (
        <FlatList
          data={filtered.sort((a, b) => b.ai_score - a.ai_score)}
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
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textTertiary, marginTop: 40 }}>No matches. Try adjusting filters.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const Chip: React.FC<any> = ({ label, count, active, onPress, theme, testID }) => (
  <TouchableOpacity testID={testID} onPress={onPress} style={{
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: active ? theme.primary : theme.surface,
    borderWidth: 1, borderColor: active ? theme.primary : theme.border,
    marginRight: 8, flexDirection: 'row', alignItems: 'center',
  }}>
    <Text style={{ color: active ? theme.primaryFg : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    {typeof count === 'number' && (
      <Text style={{ color: active ? theme.primaryFg : theme.textTertiary, fontSize: 11, marginLeft: 6, fontWeight: '500' }}>{count}</Text>
    )}
  </TouchableOpacity>
);

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  rowLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '600', paddingHorizontal: 16, marginTop: 12, marginBottom: 6 },
  chipRow: { flexGrow: 0 },
  row: { flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
