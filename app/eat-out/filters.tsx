import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useEatOutStore } from '@/store/wheelStore';
import { fetchNearbyRestaurants } from '@/lib/places';
import { getFavoriteRestaurants } from '@/lib/favoriteRestaurants';
import { CUISINE_OPTIONS, VIBE_OPTIONS, type CuisineOption, type VibeOption, type WheelItem, type Restaurant } from '@/types';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';
import * as Location from 'expo-location';

const VIBE_EMOJI: Record<string, string> = {
  Casual: '😊', Romantic: '🕯️', Fast: '⚡', Trendy: '✨', 'Family-friendly': '👨‍👩‍👧',
};

export default function EatOutFilters() {
  const { showToast, toast } = useAppAlert();
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
          showToast('Star some restaurants on the wheel first!', 'info');
          return null;
        }
        return restaurants;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showToast('Please allow location access to find restaurants.', 'error');
          return null;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const restaurants = await fetchNearbyRestaurants(loc.coords.latitude, loc.coords.longitude, filters);
        if (!restaurants.length) {
          showToast('No restaurants found. Try adjusting your filters or radius.', 'info');
          return null;
        }
        return restaurants;
      }
    } catch (e: any) {
      showToast(e.message, 'error');
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
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.ink },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
          ]}
        >
          <Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text>
        </Pressable>

        <Text style={[styles.kicker, { color: colors.primary }]}>EAT OUT — No. 01</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          Where to{'\n'}
          <Text style={[styles.headingAccent, { color: colors.primary }]}>tonight?</Text>
        </Text>

        {/* Favorites toggle */}
        <Pressable
          style={[
            styles.favToggle,
            { backgroundColor: favoritesOnly ? colors.toggleOnBg : colors.toggleBg, borderColor: colors.toggleBorder },
            hardShadow(colors.shadow, 2),
          ]}
          onPress={() => setFavoritesOnly(v => !v)}
        >
          <Text style={[styles.favIcon, { color: favoritesOnly ? colors.toggleOnText : colors.toggleText }]}>
            {favoritesOnly ? '★' : '☆'}
          </Text>
          <Text style={[styles.favTxt, { color: favoritesOnly ? colors.toggleOnText : colors.toggleText }]}>
            {favoritesOnly ? 'FAVORITES ONLY' : 'SPIN FROM FAVORITES'}
          </Text>
        </Pressable>

        {!favoritesOnly && (
          <>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>CUISINE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {CUISINE_OPTIONS.filter(c => c !== 'Spice Mixes' && c !== 'Sauces' && c !== 'Breakfast' && c !== 'Dessert').map(c => {
                const on = filters.cuisines.includes(c);
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]}
                    onPress={() => toggleCuisine(c)}
                  >
                    <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.sectionLabel }]}>VIBE</Text>
            <View style={styles.vibeGrid}>
              {VIBE_OPTIONS.map(v => {
                const on = filters.vibes.includes(v);
                return (
                  <Pressable
                    key={v}
                    style={[styles.vibeCard, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]}
                    onPress={() => toggleVibe(v)}
                  >
                    <Text style={styles.vibeEmoji}>{VIBE_EMOJI[v] ?? '🍴'}</Text>
                    <Text style={[styles.vibeName, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.sectionLabel }]}>DISTANCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {[1, 3, 5, 10, 20].map(miles => {
                const on = filters.radiusMiles === miles;
                return (
                  <Pressable
                    key={miles}
                    style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]}
                    onPress={() => setFilters({ radiusMiles: miles })}
                  >
                    <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{miles} MI</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.btnRow}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink, opacity: isLoading ? 0.6 : 1 },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
            ]}
            onPress={handleShowMap}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.btnTxt, { color: colors.textPrimary }]}>MAP 🗺️</Text>}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.primary, borderColor: colors.ink, opacity: isLoading ? 0.6 : 1 },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
            ]}
            onPress={handleBuildWheel}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#FFF6E8" /> : <Text style={[styles.btnTxt, { color: '#FFF6E8' }]}>WHEEL 🎡</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, lineHeight: 21 },
  kicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: spacing.sm },
  heading: { fontFamily: type.serifBlack, fontSize: 40, lineHeight: 46, marginBottom: spacing.lg },
  headingAccent: { fontFamily: type.serifBlackItalic },
  favToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, marginBottom: spacing.lg },
  favIcon: { fontSize: 20 },
  favTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 2 },
  label: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5, marginBottom: spacing.sm + 2 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1.5 },
  chipTxt: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  vibeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1.5 },
  vibeEmoji: { fontSize: 16 },
  vibeName: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  btn: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  btnTxt: { fontFamily: type.monoBold, fontSize: 13, letterSpacing: 2 },
});
