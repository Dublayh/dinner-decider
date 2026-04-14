import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useEatOutStore } from '@/store/wheelStore';
import { fetchNearbyRestaurants } from '@/lib/places';
import { getFavoriteRestaurants } from '@/lib/favoriteRestaurants';
import { CUISINE_OPTIONS, VIBE_OPTIONS, type CuisineOption, type VibeOption, type WheelItem, type Restaurant } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';
import * as Location from 'expo-location';

const VIBE_EMOJI: Record<string, string> = {
  Casual: '😊', Romantic: '🕯️', Fast: '⚡', Trendy: '✨', 'Family-friendly': '👨‍👩‍👧',
};

export default function EatOutFilters() {
  const router = useRouter();
  const { colors } = useTheme();
  const { filters, setFilters, setWheelItems, setLoading, isLoading } = useEatOutStore();
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const toggleCuisine = (c: CuisineOption) => {
    const next = filters.cuisines.includes(c) ? filters.cuisines.filter(x => x !== c) : [...filters.cuisines, c];
    setFilters({ cuisines: next });
  };

  const toggleVibe = (v: VibeOption) => {
    const next = filters.vibes.includes(v) ? filters.vibes.filter(x => x !== v) : [...filters.vibes, v];
    setFilters({ vibes: next });
  };

  async function getRestaurants(): Promise<Restaurant[] | null> {
    setLoading(true);
    try {
      if (favoritesOnly) {
        const restaurants = await getFavoriteRestaurants();
        if (!restaurants.length) {
          Alert.alert('No favorites yet', 'Star some restaurants on the wheel first!');
          return null;
        }
        return restaurants;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location needed', 'Please allow location access to find nearby restaurants.');
          return null;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const restaurants = await fetchNearbyRestaurants(loc.coords.latitude, loc.coords.longitude, filters);
        if (!restaurants.length) {
          Alert.alert('No restaurants found', 'Try adjusting your filters or radius.');
          return null;
        }
        return restaurants;
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildWheel() {
    const restaurants = await getRestaurants();
    if (!restaurants) return;
    setWheelItems(restaurants.map((r): WheelItem<Restaurant> => ({ id: r.id, label: r.name, data: r })));
    router.push('/eat-out/wheel');
  }

  async function handleShowMap() {
    const restaurants = await getRestaurants();
    if (!restaurants) return;
    setWheelItems(restaurants.map((r): WheelItem<Restaurant> => ({ id: r.id, label: r.name, data: r })));
    router.push('/eat-out/map');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>←</Text>
        </Pressable>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          Where to{'\n'}tonight?
        </Text>

        {/* Favorites toggle */}
        <Pressable
          style={[styles.favToggle, {
            backgroundColor: favoritesOnly ? colors.toggleOnBg : colors.toggleBg,
            borderColor: favoritesOnly ? colors.toggleOnBorder : colors.toggleBorder,
          }]}
          onPress={() => setFavoritesOnly(v => !v)}
        >
          <Text style={styles.favIcon}>{favoritesOnly ? '★' : '☆'}</Text>
          <Text style={[styles.favTxt, { color: favoritesOnly ? colors.toggleOnText : colors.toggleText }]}>
            {favoritesOnly ? 'Favorites only' : 'Spin from favorites'}
          </Text>
        </Pressable>

        {!favoritesOnly && (
          <>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {CUISINE_OPTIONS.filter(c => c !== 'Spice Mixes' && c !== 'Sauces' && c !== 'Breakfast' && c !== 'Dessert').map(c => {
                const on = filters.cuisines.includes(c);
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: on ? colors.chipOnBorder : colors.chipBorder }]}
                    onPress={() => toggleCuisine(c)}
                  >
                    <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontWeight: on ? '700' : '500' }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.sectionLabel }]}>Vibe</Text>
            <View style={styles.vibeGrid}>
              {VIBE_OPTIONS.map(v => {
                const on = filters.vibes.includes(v);
                return (
                  <Pressable
                    key={v}
                    style={[styles.vibeCard, { backgroundColor: on ? colors.chipOnBg : colors.bgCard, borderColor: on ? colors.chipOnBorder : colors.border }]}
                    onPress={() => toggleVibe(v)}
                  >
                    <Text style={styles.vibeEmoji}>{VIBE_EMOJI[v] ?? '🍴'}</Text>
                    <Text style={[styles.vibeName, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '700' : '500' }]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.sectionLabel }]}>Distance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {[1, 3, 5, 10, 20].map(miles => {
                const on = filters.radiusMiles === miles;
                return (
                  <Pressable
                    key={miles}
                    style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: on ? colors.chipOnBorder : colors.chipBorder }]}
                    onPress={() => setFilters({ radiusMiles: miles })}
                  >
                    <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontWeight: on ? '700' : '500' }]}>{miles} mi</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn, styles.btnSecondary, { borderColor: colors.primary, opacity: isLoading ? 0.6 : 1 }]}
            onPress={handleShowMap}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.btnTxt, { color: colors.primary }]}>Map 🗺️</Text>}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary, opacity: isLoading ? 0.6 : 1 }]}
            onPress={handleBuildWheel}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Wheel 🎡</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  heading: { fontSize: 36, fontWeight: '800', lineHeight: 42, marginBottom: spacing.lg },
  favToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.lg },
  favIcon: { fontSize: 22 },
  favTxt: { fontSize: font.md, fontWeight: '600' },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1.5 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5 },
  chipTxt: { fontSize: font.sm },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  vibeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1.5 },
  vibeEmoji: { fontSize: 18 },
  vibeName: { fontSize: font.sm },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  btnPrimary: {},
  btnSecondary: { borderWidth: 1.5, backgroundColor: 'transparent' },
  btnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
