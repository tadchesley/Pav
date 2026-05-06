import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Foreground behaviour: show banner + play sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    if (permissionRequested) return false;
    permissionRequested = true;
    const req = await Notifications.requestPermissionsAsync();
    if (req.granted && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Price alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    return req.granted;
  } catch {
    return false;
  }
}

const NOTIFIED_KEY = 'pav_notified_alerts';

async function getNotifiedSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

async function saveNotifiedSet(set: Set<string>) {
  try { await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(set))); } catch {}
}

export async function fireAlertNotification(symbol: string, direction: 'above' | 'below', target: number, currentPrice: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 ${symbol} alert triggered`,
      body: `${symbol} is now $${currentPrice.toFixed(2)} — crossed your ${direction} $${target.toFixed(2)} target.`,
      sound: 'default',
      data: { symbol },
    },
    trigger: null, // immediate
  });
}

/**
 * Given the current alerts list, fire a local notification for any newly-triggered alert
 * we haven't already notified about. Returns count of new notifications fired.
 */
export async function processAlertsForNotifications(items: any[]): Promise<number> {
  const granted = await ensureNotificationPermission();
  if (!granted) return 0;
  const notified = await getNotifiedSet();
  let count = 0;
  for (const a of items) {
    if (a.triggered && !notified.has(a.id)) {
      await fireAlertNotification(a.symbol, a.direction, a.target_price, a.current_price ?? 0);
      notified.add(a.id);
      count++;
    }
    // Also drop entries that are no longer triggered (allows re-notify if recreated)
    if (!a.triggered && notified.has(a.id)) {
      notified.delete(a.id);
    }
  }
  await saveNotifiedSet(notified);
  return count;
}

export async function getNotificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const s = await Notifications.getPermissionsAsync();
    if (s.granted) return 'granted';
    if (s.canAskAgain) return 'undetermined';
    return 'denied';
  } catch { return 'undetermined'; }
}
