import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useEatOutStore } from '@/store/wheelStore';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';
import RestaurantMap from '@/components/RestaurantMap';

export default function EatOutMap() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wheelItems } = useEatOutStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);

  const restaurants = wheelItems.map(w => w.data);

  useEffect(() => {
    Location.getCurrentPositionAsync({})
      .then(loc => setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
      .catch(() => {})
      .finally(() => setLocating(false));
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Map fills the screen */}
      {!locating && <RestaurantMap restaurants={restaurants} userLocation={userLocation} />}
      {locating && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />}

      {/* Top bar floats over map */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topBar}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
            ]}
          >
            <Text style={[styles.iconBtnTxt, { color: colors.textPrimary }]}>←</Text>
          </Pressable>
          <View style={[styles.badge, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
            <Text style={[styles.badgeTxt, { color: colors.textPrimary }]}>
              {restaurants.length} {restaurants.length === 1 ? 'RESTAURANT' : 'RESTAURANTS'}
            </Text>
          </View>
          <View style={styles.iconBtnSpacer} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, lineHeight: 21 },
  iconBtnSpacer: { width: 38 },
  badge: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5 },
  badgeTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5 },
});
