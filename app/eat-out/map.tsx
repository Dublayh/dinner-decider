import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useEatOutStore } from '@/store/wheelStore';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';
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
            style={[styles.iconBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}
          >
            <Text style={[styles.iconBtnTxt, { color: colors.primary }]}>←</Text>
          </Pressable>
          <View style={[styles.badge, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.badgeTxt, { color: colors.textPrimary }]}>
              {restaurants.length} {restaurants.length === 1 ? 'restaurant' : 'restaurants'}
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
  iconBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  iconBtnSpacer: { width: 36 },
  badge: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  badgeTxt: { fontSize: font.sm, fontWeight: '600' },
});
