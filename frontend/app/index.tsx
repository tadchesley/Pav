import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/ThemeContext';

export default function Splash() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade + scale entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    // Heartbeat pulse loop on the dot
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.6, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ])).start();

    // Loading dots progress
    Animated.loop(Animated.timing(dotAnim, { toValue: 3, duration: 1200, easing: Easing.linear, useNativeDriver: false })).start();
  }, []);

  // Navigate after auth state resolves and minimum splash time elapses
  useEffect(() => {
    const minTime = setTimeout(() => {
      if (!loading) {
        if (user) router.replace('/(tabs)/dashboard');
        else router.replace('/auth');
      }
    }, 1800);
    return () => clearTimeout(minTime);
  }, [user, loading]);

  const ringScale = pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [0.6, 0] });

  return (
    <View testID="splash-screen" style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <View style={styles.logoRow}>
          <Text style={[styles.brand, { color: theme.textPrimary }]}>Pav</Text>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, {
              borderColor: theme.bullish,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            }]} />
            <Animated.View style={[styles.pulseDot, { backgroundColor: theme.bullish, transform: [{ scale: pulseAnim }] }]} />
          </View>
        </View>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>The pulse of the market.</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <LoadingDots dotAnim={dotAnim} color={theme.textTertiary} />
        <Text style={[styles.disclaimer, { color: theme.textTertiary }]}>AI predictions · Not financial advice</Text>
      </View>
    </View>
  );
}

const LoadingDots: React.FC<{ dotAnim: Animated.Value; color: string }> = ({ dotAnim, color }) => {
  const opacities = [0, 1, 2].map((i) => dotAnim.interpolate({
    inputRange: [i, i + 0.5, i + 1, 3],
    outputRange: [0.25, 1, 0.25, 0.25],
    extrapolate: 'clamp',
  }));
  return (
    <View style={styles.dotsRow}>
      {opacities.map((op, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity: op }]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  brand: { fontSize: 88, fontWeight: '800', letterSpacing: -3.5, lineHeight: 96 },
  pulseWrap: { width: 24, height: 24, marginTop: 18, marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  tagline: { fontSize: 14, marginTop: 12, letterSpacing: 0.3 },
  bottom: { position: 'absolute', bottom: 60, alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  disclaimer: { fontSize: 11, letterSpacing: 0.5 },
});
