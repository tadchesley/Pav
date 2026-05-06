import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/ThemeContext';
import { processAlertsForNotifications, ensureNotificationPermission } from '../../src/notifications';

export default function Alerts() {
  const { theme } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/alerts');
      setItems(data.items);
      // Fire local notifications for newly-triggered alerts
      processAlertsForNotifications(data.items).catch(() => {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    ensureNotificationPermission().catch(() => {});
    // Poll alerts every 30s while alerts page is mounted to catch triggers
    const id = setInterval(() => load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const create = async () => {
    if (!symbol || !target) { Alert.alert('Missing', 'Enter symbol and price'); return; }
    try {
      await api.post('/alerts', { symbol: symbol.toUpperCase(), target_price: parseFloat(target), direction });
      setModal(false); setSymbol(''); setTarget(''); load();
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
  };

  const remove = (id: string) => {
    Alert.alert('Delete alert?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/alerts/${id}`); load(); } },
    ]);
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
            const progress = item.direction === 'above'
              ? Math.min(1, item.current_price / item.target_price)
              : Math.min(1, item.target_price / Math.max(item.current_price, 0.01));
            return (
              <TouchableOpacity testID={`alert-${item.id}`} onLongPress={() => remove(item.id)} style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16, flex: 1 }}>{item.symbol}</Text>
                  {triggered ? (
                    <View style={{ backgroundColor: theme.bullishBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: theme.bullish, fontSize: 11, fontWeight: '700' }}>TRIGGERED</Text>
                    </View>
                  ) : (
                    <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Active</Text>
                  )}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  Notify when price goes <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{item.direction}</Text> ${item.target_price.toFixed(2)}
                </Text>
                <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 4 }}>Current: ${item.current_price?.toFixed(2) || '—'}</Text>
                <View style={{ marginTop: 10, height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: triggered ? theme.bullish : theme.neutral }} />
                </View>
                <Text style={{ color: theme.textTertiary, fontSize: 10, marginTop: 6 }}>Long-press to delete</Text>
              </TouchableOpacity>
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
          <TextInput testID="alert-symbol" placeholder="Symbol (e.g. AAPL)" placeholderTextColor={theme.textTertiary} value={symbol} onChangeText={setSymbol} autoCapitalize="characters"
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary, marginBottom: 12 }} />
          <TextInput testID="alert-price" placeholder="Target price" placeholderTextColor={theme.textTertiary} value={target} onChangeText={setTarget} keyboardType="decimal-pad"
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary, marginBottom: 12 }} />
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
  row: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
});
