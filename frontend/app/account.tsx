import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/ThemeContext';
import { api } from '../src/api';

export default function Account() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPwForEmail, setCurrentPwForEmail] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();

  const saveProfile = async () => {
    if (!fullName && !emailChanged) { Alert.alert('No changes', 'Edit your name or email to save'); return; }
    if (emailChanged && !currentPwForEmail) { Alert.alert('Password required', 'Enter your current password to change email'); return; }
    setSavingProfile(true);
    try {
      const body: any = {};
      if (fullName !== user?.full_name) body.full_name = fullName;
      if (emailChanged) { body.email = email.trim(); body.current_password = currentPwForEmail; }
      await api.put('/auth/profile', body);
      await refreshUser();
      setCurrentPwForEmail('');
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to update profile');
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (!pwCurrent || !pwNew) { Alert.alert('Missing', 'Enter current and new password'); return; }
    if (pwNew.length < 6) { Alert.alert('Too short', 'Password must be at least 6 characters'); return; }
    if (pwNew !== pwNew2) { Alert.alert('Mismatch', 'New passwords do not match'); return; }
    setSavingPw(true);
    try {
      await api.put('/auth/password', { current_password: pwCurrent, new_password: pwNew });
      setPwCurrent(''); setPwNew(''); setPwNew2('');
      Alert.alert('Updated', 'Your password has been changed.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to change password');
    } finally { setSavingPw(false); }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe} testID="account-screen">
      <View style={s.header}>
        <TouchableOpacity testID="btn-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.textPrimary }]}>Account</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={[s.section, { color: theme.textSecondary }]}>PROFILE</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Full name</Text>
            <TextInput
              testID="input-full-name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]}
            />
            <Text style={[s.label, { color: theme.textSecondary, marginTop: 14 }]}>Email</Text>
            <TextInput
              testID="input-email-edit"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={theme.textTertiary}
              style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]}
            />
            {emailChanged && user?.email && (
              <>
                <Text style={[s.label, { color: theme.textSecondary, marginTop: 14 }]}>Current password (required to change email)</Text>
                <TextInput
                  testID="input-pw-for-email"
                  value={currentPwForEmail}
                  onChangeText={setCurrentPwForEmail}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={theme.textTertiary}
                  style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]}
                />
              </>
            )}
            <TouchableOpacity testID="btn-save-profile" onPress={saveProfile} disabled={savingProfile} style={[s.primaryBtn, { backgroundColor: theme.primary }]}>
              {savingProfile ? <ActivityIndicator color={theme.primaryFg} /> : <Text style={[s.primaryBtnText, { color: theme.primaryFg }]}>Save profile</Text>}
            </TouchableOpacity>
          </View>

          <Text style={[s.section, { color: theme.textSecondary }]}>PASSWORD</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.label, { color: theme.textSecondary }]}>Current password</Text>
            <TextInput testID="input-pw-current" value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.textTertiary} style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]} />
            <Text style={[s.label, { color: theme.textSecondary, marginTop: 14 }]}>New password</Text>
            <TextInput testID="input-pw-new" value={pwNew} onChangeText={setPwNew} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={theme.textTertiary} style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]} />
            <Text style={[s.label, { color: theme.textSecondary, marginTop: 14 }]}>Confirm new password</Text>
            <TextInput testID="input-pw-confirm" value={pwNew2} onChangeText={setPwNew2} secureTextEntry placeholder="Repeat" placeholderTextColor={theme.textTertiary} style={[s.input, { color: theme.textPrimary, borderColor: theme.border }]} />
            <TouchableOpacity testID="btn-change-pw" onPress={changePassword} disabled={savingPw} style={[s.primaryBtn, { backgroundColor: theme.primary }]}>
              {savingPw ? <ActivityIndicator color={theme.primaryFg} /> : <Text style={[s.primaryBtnText, { color: theme.primaryFg }]}>Change password</Text>}
            </TouchableOpacity>
          </View>

          <Text style={[s.section, { color: theme.textSecondary }]}>PAYMENT METHOD</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="card" size={22} color={theme.textPrimary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 15 }}>Managed by Apple / Google</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                  Your Pav Premium subscription is billed through the App Store (iOS) or Google Play (Android) using the payment method on file with your Apple ID or Google account. Pav never stores your card or bank details.
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 19 }}>
                  To update your card or cancel:
                </Text>
                <Text style={{ color: theme.textPrimary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                  • <Text style={{ fontWeight: '600' }}>iPhone</Text>: Settings → [your name] → Subscriptions{'\n'}
                  • <Text style={{ fontWeight: '600' }}>Android</Text>: Play Store → Profile → Payments & subscriptions
                </Text>
              </View>
            </View>
          </View>

          <Text style={{ color: theme.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 }}>
            Pav · Account ID: {user?.id?.slice(0, 8)}…
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  title: { fontSize: 17, fontWeight: '600' },
  section: { fontSize: 11, letterSpacing: 1.4, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1 },
  label: { fontSize: 11, letterSpacing: 0.5, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 6 },
  primaryBtn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
});
