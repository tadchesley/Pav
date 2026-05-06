import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';

const CONF_OPTIONS = [
  { label: 'Any', v: 0 },
  { label: '≥ 60%', v: 0.6 },
  { label: '≥ 75%', v: 0.75 },
  { label: '≥ 85%', v: 0.85 },
];

const DIR_OPTIONS = [
  { k: 'ALL', label: 'All', icon: 'apps' },
  { k: 'UP', label: 'Bullish', icon: 'trending-up' },
  { k: 'DOWN', label: 'Bearish', icon: 'trending-down' },
  { k: 'NEUTRAL', label: 'Neutral', icon: 'remove' },
] as const;

export default function Screener() {
  const { theme } = useTheme();
  const router = useRouter();
  const [dir, setDir] = useState<string>('ALL');
  const [sector, setSector] = useState<string>('ALL');
  const [minConf, setMinConf] = useState<number>(0);
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    try {
      const { data } = await api.post('/predictions/screener', { min_confidence: 0 });
      setAll(data.results);
      setWarming(!!data.warming);
      setProgress({ done: data.progress || 0, total: data.total_universe || 0 });
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    // Auto-poll while cache is warming so the UI fills in progressively
    const id = setInterval(() => {
      if (warming || all.length === 0) load();
    }, 5000);
    return () => clearInterval(id);
  }, [load, warming, all.length]);

  const filtered = useMemo(() => all.filter(x =>
    (dir === 'ALL' || x.direction === dir) &&
    (sector === 'ALL' || x.sector === sector) &&
    x.confidence >= minConf
  ), [all, dir, sector, minConf]);

  const dirCounts = useMemo(() => {
    const base = all.filter(x => (sector === 'ALL' || x.sector === sector) && x.confidence >= minConf);
    return {
      ALL: base.length,
      UP: base.filter(x => x.direction === 'UP').length,
      DOWN: base.filter(x => x.direction === 'DOWN').length,
      NEUTRAL: base.filter(x => x.direction === 'NEUTRAL').length,
    } as Record<string, number>;
  }, [all, sector, minConf]);

  const sectorList = useMemo(() => {
    const base = all.filter(x => (dir === 'ALL' || x.direction === dir) && x.confidence >= minConf);
    const map = new Map<string, number>();
    map.set('ALL', base.length);
    base.forEach(x => { if (x.sector) map.set(x.sector, (map.get(x.sector) || 0) + 1); });
    const entries = Array.from(map.entries());
    return [entries.find(e => e[0] === 'ALL')!, ...entries.filter(e => e[0] !== 'ALL').sort((a, b) => b[1] - a[1])];
  }, [all, dir, minConf]);

  const reset = () => { setDir('ALL'); setSector('ALL'); setMinConf(0); };
  const filtersActive = dir !== 'ALL' || sector !== 'ALL' || minConf > 0;

  const s = styles(theme);

  const renderHeader = () => (
    <View style={{ paddingBottom: 8 }}>
      {/* Direction — large icon buttons */}
      <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>DIRECTION</Text>
      <View style={s.dirGrid}>
        {DIR_OPTIONS.map(d => {
          const active = dir === d.k;
          const tint = d.k === 'UP' ? theme.bullish : d.k === 'DOWN' ? theme.bearish : d.k === 'NEUTRAL' ? theme.neutral : theme.textPrimary;
          return (
            <TouchableOpacity
              key={d.k}
              testID={`chip-dir-${d.k}`}
              onPress={() => setDir(d.k)}
              style={[s.dirCard, {
                borderColor: active ? tint : theme.border,
                backgroundColor: active ? (tint + '18') : theme.surface,
              }]}>
              <Ionicons name={d.icon as any} size={20} color={active ? tint : theme.textSecondary} />
              <Text style={[s.dirLabel, { color: active ? tint : theme.textPrimary }]}>{d.label}</Text>
              <Text style={[s.dirCount, { color: active ? tint : theme.textTertiary }]}>{dirCounts[d.k] ?? 0}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Confidence */}
      <Text style={[s.sectionLabel, { color: theme.textSecondary, marginTop: 18 }]}>MIN CONFIDENCE</Text>
      <View style={s.confRow}>
        {CONF_OPTIONS.map(c => {
          const active = minConf === c.v;
          return (
            <TouchableOpacity
              key={c.label}
              testID={`chip-conf-${c.v}`}
              onPress={() => setMinConf(c.v)}
              style={[s.confCard, {
                borderColor: active ? theme.primary : theme.border,
                backgroundColor: active ? theme.primary : theme.surface,
              }]}>
              <Text style={[s.confLabel, { color: active ? theme.primaryFg : theme.textPrimary }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sector */}
      <Text style={[s.sectionLabel, { color: theme.textSecondary, marginTop: 18 }]}>SECTOR</Text>
      <View style={s.sectorWrap}>
        {sectorList.map(([sec, count]) => {
          const active = sector === sec;
          const label = sec === 'ALL' ? 'All' : (sec as string);
          return (
            <TouchableOpacity
              key={String(sec)}
              testID={`chip-sector-${String(sec).replace(/\s/g, '_')}`}
              onPress={() => setSector(sec as string)}
              style={[s.sectorCard, {
                borderColor: active ? theme.primary : theme.border,
                backgroundColor: active ? theme.primary : theme.surface,
              }]}>
              <Text style={[s.sectorLabel, { color: active ? theme.primaryFg : theme.textPrimary }]}>{label}</Text>
              <Text style={[s.sectorCount, { color: active ? theme.primaryFg : theme.textTertiary }]}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.matchRow}>
        <Text style={[s.matchText, { color: theme.textSecondary }]}>
          {filtered.length} match{filtered.length === 1 ? '' : 'es'}
        </Text>
        {filtersActive && (
          <TouchableOpacity testID="btn-clear-filters" onPress={reset} style={[s.clearBtn, { borderColor: theme.border }]}>
            <Ionicons name="close" size={14} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} testID="screener-screen">
      <View style={s.header}>
        <Text style={[s.title, { color: theme.textPrimary }]}>Screener</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>AI-ranked predictions across {all.length || 871} symbols</Text>
        {warming && progress.total > 0 && (
          <View style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Building predictions…</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{progress.done} / {progress.total}</Text>
            </View>
            <View style={{ height: 3, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%`, height: '100%', backgroundColor: theme.neutral }} />
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.textPrimary} />
        </View>
      ) : (
        <FlatList
          data={filtered.sort((a, b) => b.ai_score - a.ai_score)}
          keyExtractor={(it) => it.symbol}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListHeaderComponent={renderHeader()}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.textPrimary} />}
          renderItem={({ item }) => (
            <TouchableOpacity testID={`screener-row-${item.symbol}`} onPress={() => router.push(`/stock/${item.symbol}`)} style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.symbol}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                {item.sector && <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 2 }}>{item.sector}</Text>}
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
          ListEmptyComponent={
            loading || warming ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <ActivityIndicator color={theme.textPrimary} />
                <Text style={{ color: theme.textSecondary, marginTop: 12 }}>
                  {warming ? `Warming up predictions… ${progress.done}/${progress.total}` : 'Loading…'}
                </Text>
              </View>
            ) : (
              <Text style={{ textAlign: 'center', color: theme.textTertiary, marginTop: 40 }}>No matches. Try adjusting filters.</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.4, fontWeight: '700', marginTop: 14, marginBottom: 10 },
  // Direction grid — 4 large cards
  dirGrid: { flexDirection: 'row', gap: 8 },
  dirCard: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dirLabel: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  dirCount: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  // Confidence row
  confRow: { flexDirection: 'row', gap: 8 },
  confCard: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  confLabel: { fontSize: 13, fontWeight: '600' },
  // Sector wrap (multi-row)
  sectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectorCard: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  sectorLabel: { fontSize: 13, fontWeight: '600' },
  sectorCount: { fontSize: 11, fontWeight: '500', marginLeft: 6 },
  // Match summary
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 6 },
  matchText: { fontSize: 14, fontWeight: '600' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  // Result row
  row: { flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
