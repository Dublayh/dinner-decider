import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useEatOutStore } from '@/store/wheelStore';
import { fetchNearbyRestaurants } from '@/lib/places';
import { getFavoriteRestaurants } from '@/lib/favoriteRestaurants';
import { CUISINE_OPTIONS, VIBE_OPTIONS, type CuisineOption, type VibeOption, type WheelItem, type Restaurant } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';
import * as Location from 'expo-location';

const VIBE_EMOJI: Record<string, string> = {
  Casual: '😊', Romantic: '🕯️', Fast: '⚡', Trendy: '✨', 'Family-friendly': '👨‍👩‍👧',
};

export default function EatOutFilters() {
  const router = useRouter();
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

  async function handleBuildWheel() {
    setLoading(true);
    try {
      let restaurants: Restaurant[] = [];

      if (favoritesOnly) {
        restaurants = await getFavoriteRestaurants();
        if (!restaurants.length) {
          Alert.alert('No favorites yet', 'Star some restaurants on the wheel first!');
          return;
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location needed', 'Please allow location access to find nearby restaurants.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        restaurants = await fetchNearbyRestaurants(loc.coords.latitude, loc.coords.longitude, filters);
        if (!restaurants.length) {
          Alert.alert('No restaurants found', 'Try adjusting your filters or radius.');
          return;
        }
      }

      setWheelItems(restaurants.map((r): WheelItem<Restaurant> => ({ id: r.id, label: r.name, data: r })));
      router.push('/eat-out/wheel');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Where to{'\n'}tonight?</Text>

        {/* Favorites toggle */}
        <Pressable style={[styles.favToggle, favoritesOnly && styles.favToggleOn]} onPress={() => setFavoritesOnly(v => !v)}>
          <Text style={styles.favToggleIcon}>{favoritesOnly ? '★' : '☆'}</Text>
          <Text style={[styles.favToggleTxt, favoritesOnly && styles.favToggleTxtOn]}>
            {favoritesOnly ? 'Favorites only' : 'Spin from favorites'}
          </Text>
        </Pressable>

        {/* Hide other filters when favorites only */}
        {!favoritesOnly && (
          <>
            <Text style={styles.label}>Cuisine</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {CUISINE_OPTIONS.filter(c => c !== 'Spice Mixes' && c !== 'Sauces' && c !== 'Breakfast' && c !== 'Dessert').map(c => (
                <Pressable key={c} style={[styles.chip, filters.cuisines.includes(c) && styles.chipOn]} onPress={() => toggleCuisine(c)}>
                  <Text style={[styles.chipTxt, filters.cuisines.includes(c) && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Vibe</Text>
            <View style={styles.vibeGrid}>
              {VIBE_OPTIONS.map(v => {
                const on = filters.vibes.includes(v);
                return (
                  <Pressable key={v} style={[styles.vibeCard, on && styles.vibeCardOn]} onPress={() => toggleVibe(v)}>
                    <Text style={styles.vibeEmoji}>{VIBE_EMOJI[v] ?? '🍴'}</Text>
                    <Text style={[styles.vibeName, on && styles.vibeNameOn]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Distance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {[1, 3, 5, 10, 20].map(miles => (
                <Pressable key={miles} style={[styles.chip, filters.radiusMiles === miles && styles.chipOn]} onPress={() => setFilters({ radiusMiles: miles })}>
                  <Text style={[styles.chipTxt, filters.radiusMiles === miles && styles.chipTxtOn]}>{miles} mi</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Pressable style={[styles.btn, isLoading && styles.btnDisabled]} onPress={handleBuildWheel} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Build the Wheel 🎡</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  heading: { fontSize: 36, fontWeight: '800', color: colors.textPrimary, lineHeight: 42, marginBottom: spacing.lg },
  favToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgCard, marginBottom: spacing.lg },
  favToggleOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  favToggleIcon: { fontSize: 22, color: colors.textMuted },
  favToggleTxt: { fontSize: font.md, fontWeight: '600', color: colors.textSecondary },
  favToggleTxtOn: { color: colors.primaryDark },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgCard },
  chipOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipTxt: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '500' },
  chipTxtOn: { color: colors.primaryDark, fontWeight: '700' },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  vibeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border },
  vibeCardOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  vibeEmoji: { fontSize: 18 },
  vibeName: { fontSize: font.sm, fontWeight: '500', color: colors.textSecondary },
  vibeNameOn: { color: colors.primaryDark, fontWeight: '700' },
  btn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
