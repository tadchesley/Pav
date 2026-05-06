import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import { useAuth } from '../../src/AuthContext';
import { processAlertsForNotifications, ensureNotificationPermission } from '../../src/notifications';

export default function Alerts() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [alertType, setAlertType] = useState<'price' | 'ai_confidence'>('price');
  const [symbol, setSymbol] = useState('');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/alerts');
      setItems(data.items);
      processAlertsForNotifications(data.items).catch(() => {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    ensureNotificationPermission().catch(() => {});
    const id = setInterval(() => load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const create = async () => {
    if (!symbol || !target) { Alert.alert('Missing', `Enter symbol and ${alertType === 'ai_confidence' ? 'confidence %' : 'price'}`); return; }
    try {
      const t = parseFloat(target);
      const payload: any = {
        symbol: symbol.toUpperCase(),
        target_price: alertType === 'ai_confidence' ? (t > 1 ? t / 100 : t) : t,
        direction: alertType === 'ai_confidence' ? 'above' : direction,
        type: alertType,
      };
      await api.post('/alerts', payload);
      setModal(false); setSymbol(''); setTarget(''); setAlertType('price'); load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const swipeableRefs = useRef<Map<string, SwipeableMethods | null>>(new Map());

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete alert?',
      'Are you sure you want to remove this alert?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRefs.current.get(id)?.close() },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/alerts/${id}`); load(); } catch {}
        } },
      ],
    );
  };

  const RightAction = ({ id, progress, drag }: { id: string; progress: SharedValue<number>; drag: SharedValue<number> }) => {
    const animStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: drag.value + 96 }],
    }));
    return (
      <Animated.View style={[{ width: 96 }, animStyle]}>
        <TouchableOpacity
          testID={`btn-trash-${id}`}
          onPress={() => confirmDelete(id)}
          activeOpacity={0.85}
          style={s.trashAction}>
          <Ionicons name="trash" size={22} color="#FFFFFF" />
          <Text style={s.trashText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="alerts-screen">
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.textPrimary }]}>Alerts</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>Price & AI confidence triggers</Text>
        </View>
        <TouchableOpacity testID="btn-new-alert" onPress={() => setModal(true)} style={[s.addBtn, { backgroundColor: theme.primary }]}>
          <Ionicons name="add" size={22} color={theme.primaryFg} />
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.textPrimary} /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.textPrimary} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
              <Text style={{ color: theme.textSecondary, marginTop: 12 }}>No alerts set</Text>
            </View>
          }
          renderItem={({ item }) => {
            const triggered = item.triggered;
            const isConf = item.type === 'ai_confidence';
            const progress = isConf
              ? Math.min(1, (item.current_confidence || 0) / item.target_price)
              : (item.direction === 'above'
                ? Math.min(1, item.current_price / item.target_price)
                : Math.min(1, item.target_price / Math.max(item.current_price, 0.01)));
            return (
              <ReanimatedSwipeable
                ref={(ref) => { swipeableRefs.current.set(item.id, ref); }}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                renderRightActions={(prog, drag) => (
                  <RightAction id={item.id} progress={prog} drag={drag} />
                )}
                containerStyle={{ marginBottom: 8 }}
              >
                <View style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.symbol}</Text>
                    <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isConf ? theme.bullishBg : theme.neutralBg }}>
                      <Text style={{ color: isConf ? theme.bullish : theme.neutral, fontSize: 9, fontWeight: '700' }}>
                        {isConf ? 'AI CONFIDENCE' : 'PRICE'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    {triggered ? (
                      <View style={{ backgroundColor: theme.bullishBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ color: theme.bullish, fontSize: 11, fontWeight: '700' }}>TRIGGERED</Text>
                      </View>
                    ) : (
                      <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Active</Text>
                    )}
                  </View>
                  {isConf ? (
                    <>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        Notify when AI confidence goes <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>above</Text> {(item.target_price * 100).toFixed(0)}%
                      </Text>
                      <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 4 }}>Current: {((item.current_confidence || 0) * 100).toFixed(0)}%</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        Notify when price goes <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{item.direction}</Text> ${item.target_price.toFixed(2)}
                      </Text>
                      <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 4 }}>Current: ${item.current_price?.toFixed(2) || '—'}</Text>
                    </>
                  )}
                  <View style={{ marginTop: 10, height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: triggered ? theme.bullish : (isConf ? theme.bullish : theme.neutral) }} />
                  </View>
                  <Text style={{ color: theme.textTertiary, fontSize: 10, marginTop: 6 }}>Swipe left to delete →</Text>
                </View>
              </ReanimatedSwipeable>
            );
          }}
        />
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>New alert</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Ionicons name="close" size={24} color={theme.textPrimary} /></TouchableOpacity>
          </View>

          {/* Alert type selector */}
          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>ALERT TYPE</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <TouchableOpacity
              testID="type-price"
              onPress={() => setAlertType('price')}
              style={{
                flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5,
                borderColor: alertType === 'price' ? theme.primary : theme.border,
                backgroundColor: alertType === 'price' ? theme.primary : theme.surface,
                alignItems: 'center',
              }}>
              <Ionicons name="cash-outline" size={18} color={alertType === 'price' ? theme.primaryFg : theme.textPrimary} />
              <Text style={{ color: alertType === 'price' ? theme.primaryFg : theme.textPrimary, fontWeight: '600', marginTop: 6 }}>Price</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="type-confidence"
              onPress={() => {
                if (!isPremium) {
                  Alert.alert('Premium feature', 'AI confidence alerts are part of Pav Premium.', [
                    { text: 'Maybe later', style: 'cancel' },
                    { text: 'Upgrade', onPress: () => router.push('/(tabs)/settings') },
                  ]);
                  return;
                }
                setAlertType('ai_confidence');
              }}
              style={{
                flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5,
                borderColor: alertType === 'ai_confidence' ? theme.primary : theme.border,
                backgroundColor: alertType === 'ai_confidence' ? theme.primary : theme.surface,
                alignItems: 'center',
                opacity: isPremium ? 1 : 0.65,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={18} color={alertType === 'ai_confidence' ? theme.primaryFg : theme.textPrimary} />
                {!isPremium && <Ionicons name="lock-closed" size={11} color={theme.textTertiary} style={{ marginLeft: 4 }} />}
              </View>
              <Text style={{ color: alertType === 'ai_confidence' ? theme.primaryFg : theme.textPrimary, fontWeight: '600', marginTop: 6 }}>AI Confidence</Text>
            </TouchableOpacity>
          </View>

          <TextInput testID="alert-symbol" placeholder="Symbol (e.g. AAPL)" placeholderTextColor={theme.textTertiary} value={symbol} onChangeText={setSymbol} autoCapitalize="characters"
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary, marginBottom: 12 }} />
          <TextInput testID="alert-price"
            placeholder={alertType === 'ai_confidence' ? 'Confidence threshold (e.g. 80 for 80%)' : 'Target price'}
            placeholderTextColor={theme.textTertiary} value={target} onChangeText={setTarget} keyboardType="decimal-pad"
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary, marginBottom: 12 }} />
          {alertType === 'price' && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['above', 'below'] as const).map(d => (
                <TouchableOpacity key={d} testID={`dir-${d}`} onPress={() => setDirection(d)} style={{
                  flex: 1, padding: 12, borderRadius: 8, borderWidth: 1,
                  borderColor: direction === d ? theme.primary : theme.border,
                  backgroundColor: direction === d ? theme.primary : theme.surface,
                  alignItems: 'center',
                }}>
                  <Text style={{ color: direction === d ? theme.primaryFg : theme.textSecondary, fontWeight: '600' }}>{d === 'above' ? 'Above ▲' : 'Below ▼'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {alertType === 'ai_confidence' && (
            <View style={{ marginBottom: 20, padding: 12, backgroundColor: theme.bullishBg, borderRadius: 10 }}>
              <Text style={{ color: theme.bullish, fontSize: 12, fontWeight: '600' }}>
                ✨ You'll be notified when Pav's AI confidence on this symbol exceeds your threshold.
              </Text>
            </View>
          )}
          <TouchableOpacity testID="btn-save-alert" onPress={create} style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 999, alignItems: 'center' }}>
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>Create alert</Text>
          </TouchableOpacity>
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
  row: { padding: 14, borderRadius: 12, borderWidth: 1 },
  trashAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderRadius: 12,
    flexDirection: 'column',
    marginLeft: 8,
  },
  trashText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 4 },
});
