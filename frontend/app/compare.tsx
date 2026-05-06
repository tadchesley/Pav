import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useTheme } from '../src/ThemeContext';

const HORIZONS = [
  { key: '1D', label: '1 Day' },
  { key: '1W', label: '1 Week' },
  { key: '1M', label: '1 Month' },
];

export default function Compare() {
  const router = useRouter();
  const { theme } = useTheme();
  const [watch, setWatch] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [horizon, setHorizon] = useState('1M');
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadWatch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/watchlist');
      setWatch(data.items || []);
      // Auto-select first 2-4 items
      const initial = (data.items || []).slice(0, 4).map((it: any) => it.symbol);
      setSelected(initial);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load watchlist');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWatch(); }, [loadWatch]);

  const runCompare = useCallback(async (symbols: string[]) => {
    if (symbols.length < 2) return;
    setComparing(true);
    try {
      const { data } = await api.post('/predictions/compare', { symbols });
      setItems(data.items || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        Alert.alert('Premium feature', 'Side-by-side comparison is part of Pav Premium.', [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.replace('/(tabs)/settings') },
        ]);
        router.back();
      } else {
        Alert.alert('Error', e?.response?.data?.detail || 'Failed to compare');
      }
    } finally { setComparing(false); }
  }, [router]);

  useEffect(() => {
    if (selected.length >= 2) runCompare(selected);
    else setItems(null);
  }, [selected, runCompare]);

  const toggleSym = (sym: string) => {
    setSelected(prev => {
      if (prev.includes(sym)) return prev.filter(s => s !== sym);
      if (prev.length >= 4) {
        Alert.alert('Limit', 'You can compare up to 4 stocks at once.');
        return prev;
      }
      return [...prev, sym];
    });
  };

  const s = styles(theme);
  const valid = items?.filter(it => it.ok) || [];

  // Find the "winner" per metric for highlighting
  const winnerSymbol = (() => {
    if (!valid || valid.length === 0) return null;
    let best = valid[0];
    let bestRet = best.predictions?.[horizon]?.expected_return_pct ?? -Infinity;
    valid.forEach(v => {
      const r = v.predictions?.[horizon]?.expected_return_pct ?? -Infinity;
      if (r > bestRet) { best = v; bestRet = r; }
    });
    return best.symbol;
  })();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>Compare</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>Up to 4 stocks side-by-side</Text>
        </View>
        <TouchableOpacity onPress={() => setPickerOpen(true)} style={[s.editBtn, { borderColor: theme.border }]}>
          <Ionicons name="add-circle-outline" size={16} color={theme.textPrimary} />
          <Text style={{ color: theme.textPrimary, marginLeft: 4, fontWeight: '600', fontSize: 13 }}>Pick</Text>
        </TouchableOpacity>
      </View>

      {/* Selected chips */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {selected.map(sym => (
            <View key={sym} style={[s.chip, { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}>
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>{sym}</Text>
              <TouchableOpacity onPress={() => toggleSym(sym)} style={{ marginLeft: 6 }}>
                <Ionicons name="close-circle" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ))}
          {selected.length === 0 && (
            <Text style={{ color: theme.textTertiary, fontSize: 13 }}>Tap "Pick" to choose stocks to compare.</Text>
          )}
        </View>
      </View>

      {/* Horizon switcher */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
          FORECAST HORIZON
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {HORIZONS.map(h => {
            const active = horizon === h.key;
            return (
              <TouchableOpacity key={h.key} onPress={() => setHorizon(h.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primary : theme.surface,
                  alignItems: 'center',
                }}>
                <Text style={{ color: active ? theme.primaryFg : theme.textPrimary, fontWeight: '700', fontSize: 13 }}>{h.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading || comparing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.textPrimary} />
          <Text style={{ color: theme.textSecondary, marginTop: 10 }}>{comparing ? 'Comparing…' : 'Loading…'}</Text>
        </View>
      ) : !items ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="git-compare-outline" size={48} color={theme.textTertiary} />
          <Text style={{ color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>
            Pick at least 2 stocks to start comparing.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => runCompare(selected)} tintColor={theme.textPrimary} />}>
          {/* Winner banner */}
          {winnerSymbol && valid.length > 1 && (
            <View style={[s.winner, { backgroundColor: theme.bullishBg }]}>
              <Ionicons name="trophy" size={18} color={theme.bullish} />
              <Text style={{ color: theme.bullish, marginLeft: 8, fontWeight: '600', fontSize: 13 }}>
                Top {horizon} forecast: <Text style={{ fontWeight: '800' }}>{winnerSymbol}</Text>
              </Text>
            </View>
          )}

          {/* Cards */}
          {valid.map(it => {
            const p = it.predictions?.[horizon];
            const isWinner = it.symbol === winnerSymbol && valid.length > 1;
            const dirColor = p?.direction === 'UP' ? theme.bullish : p?.direction === 'DOWN' ? theme.bearish : theme.neutral;
            return (
              <TouchableOpacity
                key={it.symbol}
                onPress={() => router.push(`/stock/${it.symbol}`)}
                style={[s.card, {
                  backgroundColor: theme.surface,
                  borderColor: isWinner ? theme.bullish : theme.border,
                  borderWidth: isWinner ? 2 : 1,
                }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '800' }}>{it.symbol}</Text>
                      {isWinner && <Ionicons name="trophy" size={14} color={theme.bullish} style={{ marginLeft: 6 }} />}
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{it.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>${it.current_price?.toFixed(2)}</Text>
                    <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 2 }}>{it.sector}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                  <Metric theme={theme} label="Direction" value={p?.direction || '—'} color={dirColor} />
                  <Metric theme={theme} label="Return" value={`${(p?.expected_return_pct >= 0 ? '+' : '')}${(p?.expected_return_pct ?? 0).toFixed(2)}%`} color={dirColor} />
                  <Metric theme={theme} label="Target" value={`$${(p?.target_price ?? 0).toFixed(2)}`} color={theme.textPrimary} />
                  <Metric theme={theme} label="Score" value={`${(p?.ai_score ?? 0).toFixed(0)}`} color={theme.textPrimary} />
                  <Metric theme={theme} label="Conf." value={`${((p?.confidence ?? 0) * 100).toFixed(0)}%`} color={theme.textPrimary} />
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <Pill theme={theme} label={`RSI ${(it.rsi_14 ?? 0).toFixed(0)}`} />
                  <Pill theme={theme} label={`SMA20 $${(it.sma_20 ?? 0).toFixed(2)}`} />
                  <Pill theme={theme} label={`Mom ${(it.momentum_10 >= 0 ? '+' : '')}${(it.momentum_10 ?? 0).toFixed(1)}%`} />
                  <Pill theme={theme} label={`Vol ${(it.volatility ?? 0).toFixed(1)}%`} />
                </View>
              </TouchableOpacity>
            );
          })}

          {(items?.length ?? 0) > valid.length && (
            <Text style={{ color: theme.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 16 }}>
              {items!.length - valid.length} symbol(s) failed to load.
            </Text>
          )}
        </ScrollView>
      )}

      {/* Picker modal */}
      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
              Pick stocks to compare ({selected.length}/4)
            </Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          {watch.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <Ionicons name="star-outline" size={48} color={theme.textTertiary} />
              <Text style={{ color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>
                Add stocks to your watchlist first to compare them.
              </Text>
            </View>
          ) : (
            <FlatList
              data={watch}
              keyExtractor={(it) => it.symbol}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isOn = selected.includes(item.symbol);
                const disabled = !isOn && selected.length >= 4;
                return (
                  <TouchableOpacity
                    onPress={() => !disabled && toggleSym(item.symbol)}
                    style={[s.pickRow, {
                      backgroundColor: isOn ? theme.primary + '20' : theme.surface,
                      borderColor: isOn ? theme.primary : theme.border,
                      opacity: disabled ? 0.4 : 1,
                    }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{item.symbol}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <Text style={{ color: theme.textPrimary, fontWeight: '600', marginRight: 12 }}>${item.current_price?.toFixed(2)}</Text>
                    {isOn
                      ? <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                      : <Ionicons name="ellipse-outline" size={24} color={theme.textTertiary} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
            <TouchableOpacity onPress={() => setPickerOpen(false)} style={{ backgroundColor: theme.primary, padding: 14, borderRadius: 999, alignItems: 'center' }}>
              <Text style={{ color: theme.primaryFg, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Metric = ({ theme, label, value, color }: any) => (
  <View style={{ alignItems: 'center', minWidth: 50 }}>
    <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    <Text style={{ color, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{value}</Text>
  </View>
);

const Pill = ({ theme, label }: any) => (
  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
    <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '600' }}>{label}</Text>
  </View>
);

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border },
  backBtn: { padding: 6, marginRight: 4 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  card: { padding: 14, borderRadius: 14, marginBottom: 10 },
  winner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 12 },
  pickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
