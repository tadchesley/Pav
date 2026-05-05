import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/ThemeContext';

export default function AuthScreen() {
  const { signIn, signUp, socialSignIn } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const needsAgreement = mode === 'signup';

  const submit = async () => {
    if (!email || !password) { Alert.alert('Missing fields', 'Enter email and password'); return; }
    if (needsAgreement && !agreed) { Alert.alert('Agreement required', 'Please accept Terms & acknowledge that AI predictions are not financial advice.'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, fullName || undefined);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Auth failed', e?.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const social = async (provider: 'google' | 'apple') => {
    if (!agreed && mode === 'signup') { Alert.alert('Agreement required', 'Please accept the Terms first.'); return; }
    Alert.prompt?.(
      `Sign in with ${provider}`,
      'Enter your email to continue (demo social sign-in)',
      async (input?: string) => {
        if (!input) return;
        setLoading(true);
        try {
          await socialSignIn(provider, input.trim(), input.split('@')[0]);
          router.replace('/(tabs)/dashboard');
        } catch (e: any) {
          Alert.alert('Social sign-in failed', e?.response?.data?.detail || e.message);
        } finally { setLoading(false); }
      },
      'plain-text'
    ) ?? (async () => {
      const demoEmail = `demo_${provider}_${Date.now()}@example.com`;
      setLoading(true);
      try {
        await socialSignIn(provider, demoEmail, `Demo ${provider}`);
        router.replace('/(tabs)/dashboard');
      } catch (e: any) {
        Alert.alert('Social sign-in failed', e?.response?.data?.detail || e.message);
      } finally { setLoading(false); }
    })();
  };

  const s = styles(theme);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Image
            source={{ uri: 'https://images.pexels.com/photos/29832997/pexels-photo-29832997.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
            style={s.heroImage}
          />
          <View style={[s.heroOverlay, { backgroundColor: theme.background + 'CC' }]} />
          <View style={s.heroContent}>
            <Text style={[s.brand, { color: theme.textPrimary }]}>AlphaPulse</Text>
            <Text style={[s.tagline, { color: theme.textSecondary }]}>AI-driven market forecasts.{'\n'}Confidence-ranked.</Text>
          </View>
        </View>

        <View style={s.form}>
          <View style={s.tabs}>
            <TouchableOpacity testID="tab-signin" onPress={() => setMode('signin')} style={[s.tab, mode === 'signin' && { borderBottomColor: theme.textPrimary }]}>
              <Text style={[s.tabText, { color: mode === 'signin' ? theme.textPrimary : theme.textTertiary }]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="tab-signup" onPress={() => setMode('signup')} style={[s.tab, mode === 'signup' && { borderBottomColor: theme.textPrimary }]}>
              <Text style={[s.tabText, { color: mode === 'signup' ? theme.textPrimary : theme.textTertiary }]}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <TextInput
              testID="input-name"
              placeholder="Full name"
              placeholderTextColor={theme.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
            />
          )}
          <TextInput
            testID="input-email"
            placeholder="Email"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
          />
          <TextInput
            testID="input-password"
            placeholder="Password (min 6 chars)"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
          />

          {needsAgreement && (
            <TouchableOpacity testID="toggle-agree" onPress={() => setAgreed(a => !a)} style={s.agreeRow}>
              <View style={[s.checkbox, { borderColor: theme.border, backgroundColor: agreed ? theme.primary : 'transparent' }]}>
                {agreed && <Ionicons name="checkmark" size={14} color={theme.primaryFg} />}
              </View>
              <Text style={[s.agreeText, { color: theme.textSecondary }]}>
                I agree to the <Text onPress={() => router.push('/terms')} style={{ color: theme.textPrimary, fontWeight: '600' }}>Terms of Service</Text> and acknowledge that AI predictions are <Text style={{ color: theme.bearish, fontWeight: '600' }}>not financial advice</Text>.
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity testID="btn-submit" onPress={submit} disabled={loading} style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: (needsAgreement && !agreed) ? 0.5 : 1 }]}>
            {loading ? <ActivityIndicator color={theme.primaryFg} /> : (
              <Text style={[s.primaryBtnText, { color: theme.primaryFg }]}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={[s.line, { backgroundColor: theme.border }]} />
            <Text style={[s.orText, { color: theme.textTertiary }]}>OR</Text>
            <View style={[s.line, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity testID="btn-google" onPress={() => social('google')} style={[s.socialBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="logo-google" size={20} color={theme.textPrimary} />
            <Text style={[s.socialText, { color: theme.textPrimary }]}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="btn-apple" onPress={() => social('apple')} style={[s.socialBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="logo-apple" size={20} color={theme.textPrimary} />
            <Text style={[s.socialText, { color: theme.textPrimary }]}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/terms')} testID="link-terms">
            <Text style={[s.disclaimer, { color: theme.textTertiary }]}>
              Predictions are informational only — not financial advice. Read Terms →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (t: any) => StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { position: 'absolute', bottom: 24, left: 24, right: 24 },
  brand: { fontSize: 42, fontWeight: '700', letterSpacing: -1.5, marginBottom: 8 },
  tagline: { fontSize: 16, lineHeight: 22 },
  form: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 12 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  agreeText: { flex: 1, marginLeft: 10, fontSize: 12, lineHeight: 18 },
  primaryBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orText: { marginHorizontal: 12, fontSize: 12, letterSpacing: 1 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, borderWidth: 1, gap: 10, marginBottom: 10 },
  socialText: { fontSize: 15, fontWeight: '500' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
  const { signIn, signUp, socialSignIn } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('Missing fields', 'Enter email and password'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, fullName || undefined);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Auth failed', e?.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const social = async (provider: 'google' | 'apple') => {
    // For MVP: prompt for email to simulate social sign-in (real OAuth requires Google/Apple client IDs)
    Alert.prompt?.(
      `Sign in with ${provider}`,
      'Enter your email to continue (demo social sign-in)',
      async (input?: string) => {
        if (!input) return;
        setLoading(true);
        try {
          await socialSignIn(provider, input.trim(), input.split('@')[0]);
          router.replace('/(tabs)/dashboard');
        } catch (e: any) {
          Alert.alert('Social sign-in failed', e?.response?.data?.detail || e.message);
        } finally { setLoading(false); }
      },
      'plain-text'
    ) ?? (async () => {
      // Fallback for Android where Alert.prompt doesn't exist
      const demoEmail = `demo_${provider}_${Date.now()}@example.com`;
      setLoading(true);
      try {
        await socialSignIn(provider, demoEmail, `Demo ${provider}`);
        router.replace('/(tabs)/dashboard');
      } catch (e: any) {
        Alert.alert('Social sign-in failed', e?.response?.data?.detail || e.message);
      } finally { setLoading(false); }
    })();
  };

  const s = styles(theme);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Image
            source={{ uri: 'https://images.pexels.com/photos/29832997/pexels-photo-29832997.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
            style={s.heroImage}
          />
          <View style={[s.heroOverlay, { backgroundColor: theme.background + 'CC' }]} />
          <View style={s.heroContent}>
            <Text style={[s.brand, { color: theme.textPrimary }]}>AlphaPulse</Text>
            <Text style={[s.tagline, { color: theme.textSecondary }]}>AI-driven market forecasts.{'\n'}Confidence-ranked.</Text>
          </View>
        </View>

        <View style={s.form}>
          <View style={s.tabs}>
            <TouchableOpacity testID="tab-signin" onPress={() => setMode('signin')} style={[s.tab, mode === 'signin' && { borderBottomColor: theme.textPrimary }]}>
              <Text style={[s.tabText, { color: mode === 'signin' ? theme.textPrimary : theme.textTertiary }]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="tab-signup" onPress={() => setMode('signup')} style={[s.tab, mode === 'signup' && { borderBottomColor: theme.textPrimary }]}>
              <Text style={[s.tabText, { color: mode === 'signup' ? theme.textPrimary : theme.textTertiary }]}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <TextInput
              testID="input-name"
              placeholder="Full name"
              placeholderTextColor={theme.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
            />
          )}
          <TextInput
            testID="input-email"
            placeholder="Email"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
          />
          <TextInput
            testID="input-password"
            placeholder="Password (min 6 chars)"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[s.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
          />

          <TouchableOpacity testID="btn-submit" onPress={submit} disabled={loading} style={[s.primaryBtn, { backgroundColor: theme.primary }]}>
            {loading ? <ActivityIndicator color={theme.primaryFg} /> : (
              <Text style={[s.primaryBtnText, { color: theme.primaryFg }]}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={[s.line, { backgroundColor: theme.border }]} />
            <Text style={[s.orText, { color: theme.textTertiary }]}>OR</Text>
            <View style={[s.line, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity testID="btn-google" onPress={() => social('google')} style={[s.socialBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="logo-google" size={20} color={theme.textPrimary} />
            <Text style={[s.socialText, { color: theme.textPrimary }]}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="btn-apple" onPress={() => social('apple')} style={[s.socialBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="logo-apple" size={20} color={theme.textPrimary} />
            <Text style={[s.socialText, { color: theme.textPrimary }]}>Continue with Apple</Text>
          </TouchableOpacity>

          <Text style={[s.disclaimer, { color: theme.textTertiary }]}>
            Predictions are for informational purposes only — not financial advice.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (t: any) => StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { position: 'absolute', bottom: 24, left: 24, right: 24 },
  brand: { fontSize: 42, fontWeight: '700', letterSpacing: -1.5, marginBottom: 8 },
  tagline: { fontSize: 16, lineHeight: 22 },
  form: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 12 },
  primaryBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orText: { marginHorizontal: 12, fontSize: 12, letterSpacing: 1 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, borderWidth: 1, gap: 10, marginBottom: 10 },
  socialText: { fontSize: 15, fontWeight: '500' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
