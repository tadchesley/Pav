import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Prediction } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import { useAuth } from '../../src/AuthContext';
import { PriceChart } from '../../src/Charts';

const { width: SCREEN_W } = Dimensions.get('window');

export default function StockDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';
  const [pred, setPred] = useState<Prediction | null>(null);
  const [candles, setCandles] = useState<any>(null);
  const [horizons, setHorizons] = useState<any[]>([]);
  const [quoteMeta, setQuoteMeta] = useState<{ delayed: boolean; delayed_seconds?: number } | null>(null);
  const [activeHorizon, setActiveHorizon] = useState<string>('1D');
  const [loading, setLoading] = useState(true);
  const [inWatch, setInWatch] = useState(false);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [p, c, w, h, q] = await Promise.all([
        api.get(`/predictions/${symbol}?deep=true`),
        api.get(`/stocks/candles/${symbol}?days=60`),
        api.get('/watchlist'),
        api.get(`/predictions/${symbol}/horizons`),
        api.get(`/stocks/quote/${symbol}`),
      ]);
      setPred(p.data);
      setCandles(c.data);
      setInWatch(w.data.items.some((x: any) => x.symbol === symbol));
      const hs = h.data.horizons || [];
      setHorizons(hs);
      // Default to the first unlocked horizon so free users land on something they can see.
      const firstUnlocked = hs.find((x: any) => !x.locked);
      if (firstUnlocked) setActiveHorizon(firstUnlocked.horizon);
      setQuoteMeta({ delayed: !!q.data.delayed, delayed_seconds: q.data.delayed_seconds });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load');
    } finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const toggleWatch = async () => {
    try {
      if (inWatch) { await api.delete(`/watchlist/${symbol}`); setInWatch(false); }
      else { await api.post('/watchlist', { symbol }); setInWatch(true); }
    } catch {}
  };

  const s = styles(theme);

  if (loading || !pred) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.textPrimary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>AI analyzing {symbol}…</Text>
      </SafeAreaView>
    );
  }

  const color = pred.direction === 'UP' ? theme.bullish : pred.direction === 'DOWN' ? theme.bearish : theme.neutral;

  return (
    <SafeAreaView style={s.safe} testID="stock-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.topBar}>
          <TouchableOpacity testID="btn-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.textPrimary} /></TouchableOpacity>
          <Text style={{ flex: 1 }} />
          <TouchableOpacity testID="btn-toggle-watch" onPress={toggleWatch}>
            <Ionicons name={inWatch ? 'star' : 'star-outline'} size={24} color={inWatch ? '#F59E0B' : theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{pred.sector}</Text>
          <Text style={{ color: theme.textPrimary, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 }}>{pred.symbol}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 15, marginTop: 2 }}>{pred.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 36, fontWeight: '700' }}>${pred.current_price.toFixed(2)}</Text>
            <Text style={{ color, fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
              {pred.expected_return_pct > 0 ? '+' : ''}{pred.expected_return_pct.toFixed(2)}% · 30d
            </Text>
          </View>

          {/* Live / Delayed badge */}
          {quoteMeta && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                backgroundColor: quoteMeta.delayed ? theme.neutralBg : theme.bullishBg,
              }}>
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: quoteMeta.delayed ? theme.neutral : theme.bullish, marginRight: 6,
              }} />
              <Text style={{ color: quoteMeta.delayed ? theme.neutral : theme.bullish, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                {quoteMeta.delayed
                  ? `DELAYED${quoteMeta.delayed_seconds ? ` ~${Math.round(quoteMeta.delayed_seconds / 60)}m` : ''}`
                  : 'LIVE'}
              </Text>
              {!isPremium && quoteMeta.delayed && (
                <>
                  <Text style={{ color: theme.textTertiary, fontSize: 10, marginLeft: 6 }}>·</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '600', marginLeft: 6 }}>Real-time coming soon</Text>
                </>
              )}
            </View>
          )}
        </View>

        {candles?.close?.length > 0 && (
          <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
            <PriceChart
              data={candles.close}
              width={SCREEN_W - 32}
              height={200}
              color={color}
              predictedPrice={pred.target_price}
              bgColor={theme.surface}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: theme.textTertiary, fontSize: 11 }}>60d history · dashed = AI forecast</Text>
              <Text style={{ color, fontSize: 11, fontWeight: '600' }}>Target ${pred.target_price.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {horizons.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Text style={[s.cardLabel, { color: theme.textSecondary, marginBottom: 10 }]}>FORECAST HORIZON</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {horizons.map((h: any) => {
                const active = activeHorizon === h.horizon;
                const locked = !!h.locked;
                return (
                  <TouchableOpacity
                    key={h.horizon}
                    testID={`horizon-${h.horizon}`}
                    onPress={() => locked
                      ? Alert.alert('Coming soon', 'Multi-horizon forecasts (1W & 1M) are part of Pav Premium. Premium subscriptions aren\'t live yet — this feature will unlock soon.', [
                          { text: 'Got it', style: 'default' },
                        ])
                      : setActiveHorizon(h.horizon)
                    }
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary : theme.surface,
                      alignItems: 'center',
                      opacity: locked ? 0.6 : 1,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {locked && <Ionicons name="lock-closed" size={11} color={active ? theme.primaryFg : theme.textTertiary} style={{ marginRight: 4 }} />}
                      <Text style={{ color: active ? theme.primaryFg : theme.textPrimary, fontWeight: '700', fontSize: 13 }}>{h.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(() => {
              const h = horizons.find((x: any) => x.horizon === activeHorizon) || horizons[0];
              if (h.locked) {
                return (
                  <View style={[s.card, { backgroundColor: theme.surface, borderColor: '#F59E0B', borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Ionicons name="lock-closed" size={18} color="#F59E0B" />
                      <Text style={{ color: theme.textPrimary, fontWeight: '700', marginLeft: 8 }}>{h.label} forecast — Premium</Text>
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
                      Get AI predictions across multiple timeframes — 1 day, 1 week, and 1 month — with horizon-specific confidence scores and price targets.
                    </Text>
                    <TouchableOpacity disabled style={{ marginTop: 14, backgroundColor: '#F59E0B', paddingVertical: 12, borderRadius: 999, alignItems: 'center', opacity: 0.85 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="time-outline" size={14} color="#09090B" />
                        <Text style={{ color: '#09090B', fontWeight: '700', marginLeft: 6 }}>Coming Soon</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }
              const hColor = h.direction === 'UP' ? theme.bullish : h.direction === 'DOWN' ? theme.bearish : theme.neutral;
              return (
                <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>DIRECTION</Text>
                      <Text style={{ color: hColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                        {h.direction === 'UP' ? '▲ Bullish' : h.direction === 'DOWN' ? '▼ Bearish' : '◆ Neutral'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>EXP. RETURN</Text>
                      <Text style={{ color: hColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                        {h.expected_return_pct > 0 ? '+' : ''}{h.expected_return_pct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                    <View>
                      <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Target price</Text>
                      <Text style={{ color: theme.textPrimary, fontWeight: '600', marginTop: 2 }}>${h.target_price?.toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={{ color: theme.textTertiary, fontSize: 11 }}>AI score</Text>
                      <Text style={{ color: theme.textPrimary, fontWeight: '600', marginTop: 2 }}>{h.ai_score?.toFixed(0)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Confidence</Text>
                      <Text style={{ color: theme.textPrimary, fontWeight: '600', marginTop: 2 }}>{(h.confidence * 100).toFixed(0)}%</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {pred.narrative && (
          <View style={[s.aiCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: (pred as any).premium_required ? '#F59E0B' : theme.neutral }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>
              {(pred as any).premium_required ? 'PREMIUM PREVIEW' : 'AI NARRATIVE'}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12 }}>{pred.narrative}</Text>
            {(pred as any).premium_required && (
              <TouchableOpacity testID="btn-upgrade-from-stock" disabled style={{ marginTop: 14, backgroundColor: '#F59E0B', paddingVertical: 12, borderRadius: 999, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: 0.85 }}>
                <Ionicons name="time-outline" size={14} color="#09090B" />
                <Text style={{ color: '#09090B', fontWeight: '700', marginLeft: 6 }}>Coming Soon</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {pred.feature_importance && Object.keys(pred.feature_importance).length > 0 && (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>FEATURE IMPORTANCE</Text>
            {Object.entries(pred.feature_importance).map(([k, v]) => (
              <View key={k} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: theme.textPrimary, fontSize: 13, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{(v * 100).toFixed(0)}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, v * 100)}%`, height: '100%', backgroundColor: theme.neutral }} />
                </View>
              </View>
            ))}
          </View>
        )}

        {pred.key_factors && pred.key_factors.length > 0 && (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>KEY FACTORS</Text>
            {pred.key_factors.map((k, i) => (
              <View key={i} style={{ flexDirection: 'row', marginTop: 8, alignItems: 'flex-start' }}>
                <Ionicons name="checkmark-circle" size={16} color={theme.bullish} style={{ marginTop: 2 }} />
                <Text style={{ color: theme.textPrimary, fontSize: 14, marginLeft: 8, flex: 1 }}>{k}</Text>
              </View>
            ))}
          </View>
        )}

        {pred.risks && pred.risks.length > 0 && (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>RISKS</Text>
            {pred.risks.map((k, i) => (
              <View key={i} style={{ flexDirection: 'row', marginTop: 8, alignItems: 'flex-start' }}>
                <Ionicons name="warning" size={16} color={theme.bearish} style={{ marginTop: 2 }} />
                <Text style={{ color: theme.textPrimary, fontSize: 14, marginLeft: 8, flex: 1 }}>{k}</Text>
              </View>
            ))}
          </View>
        )}

        {pred.indicators && (
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.textSecondary }]}>TECHNICAL INDICATORS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 14 }}>
              <IndStat label="RSI (14)" value={pred.indicators.rsi_14?.toFixed(1)} theme={theme} />
              <IndStat label="SMA 20" value={`$${pred.indicators.sma_20?.toFixed(2) ?? '—'}`} theme={theme} />
              <IndStat label="SMA 50" value={`$${pred.indicators.sma_50?.toFixed(2) ?? '—'}`} theme={theme} />
              <IndStat label="Momentum" value={`${pred.indicators.momentum_10?.toFixed(2)}%`} theme={theme} />
              <IndStat label="Volatility" value={`${pred.indicators.volatility?.toFixed(2)}%`} theme={theme} />
            </View>
          </View>
        )}

        <Text style={[s.disclaimer, { color: theme.textTertiary }]}>
          Not financial advice. AI predictions involve uncertainty. Always do your own research.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ label: string; value: string; color: string; theme: any }> = ({ label, value, color, theme }) => (
  <View style={{ flex: 1 }}>
    <Text style={{ color: theme.textTertiary, fontSize: 11, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
    <Text style={{ color, fontSize: 20, fontWeight: '700', marginTop: 4 }}>{value}</Text>
  </View>
);

const IndStat: React.FC<{ label: string; value: string; theme: any }> = ({ label, value, theme }) => (
  <View style={{ width: '45%' }}>
    <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{label}</Text>
    <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 }}>{value}</Text>
  </View>
);

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  card: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  aiCard: { marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1, borderLeftWidth: 3 },
  cardLabel: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  disclaimer: { fontSize: 11, textAlign: 'center', paddingHorizontal: 32, marginTop: 24, lineHeight: 16 },
});
