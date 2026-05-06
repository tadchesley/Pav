import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';

/**
 * Download a CSV from the backend and either share it (native) or trigger a browser download (web).
 * The endpoint must already require auth — we pull bytes via the authenticated axios client.
 */
export async function exportCsv(endpoint: string, suggestedName: string): Promise<void> {
  try {
    const resp = await api.get(endpoint, { responseType: 'text' as any });
    const csv: string = resp.data;
    const filename = suggestedName.endsWith('.csv') ? suggestedName : `${suggestedName}.csv`;

    if (Platform.OS === 'web') {
      // Browser: trigger download via Blob/anchor
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a: any = (globalThis as any).document?.createElement?.('a');
      if (a) {
        a.href = url;
        a.download = filename;
        (globalThis as any).document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }

    // Native: write to cacheDirectory and share
    const path = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    const can = await Sharing.isAvailableAsync();
    if (!can) {
      Alert.alert('Saved', `CSV saved to ${path}`);
      return;
    }
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
  } catch (e: any) {
    if (e?.response?.status === 403) {
      Alert.alert('Coming soon', 'CSV export is part of Pav Premium. Premium subscriptions aren\'t live yet — this feature will unlock soon.');
    } else {
      Alert.alert('Export failed', e?.response?.data?.detail || e?.message || 'Unknown error');
    }
  }
}
