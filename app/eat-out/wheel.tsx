import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Alert, Linking, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput as BSTextInput } from '@gorhom/bottom-sheet';
import { TextInput } from 'react-native';
const BottomSheetTextInput = Platform.OS === 'web' ? TextInput : BSTextInput;
import * as Location from 'expo-location';
import { useEatOutStore } from '@/store/wheelStore';
import SpinWheel from '@/components/SpinWheelUniversal';
import { addCustomRestaurant } from '@/lib/customRestaurants';
import { searchRestaurants } from '@/lib/places';
import { getFavoritePlaceIds, addFavoriteRestaurant, removeFavoriteRestaurant } from '@/lib/favoriteRestaurants';
import type { Restaurant, WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

function openInMaps(restaurant: Restaurant) {
  const query = encodeURIComponent(restaurant.address || restaurant.name);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
}

const CONFETTI = [
  { angle: 0,   color: '#D4822F', dist: 80 },
  { angle: 45,  color: '#7A9E7E', dist: 90 },
  { angle: 90,  color: '#E8A24B', dist: 74 },
  { angle: 135, color: '#C0695A', dist: 86 },
  { angle: 180, color: '#5B7FA6', dist: 80 },
  { angle: 225, color: '#C4A882', dist: 92 },
  { angle: 270, color: '#D4822F', dist: 74 },
  { angle: 315, color: '#7A9E7E', dist: 86 },
];

function ConfettiDot({ angle, color, dist, trigger }: {
  angle: number; color: string; dist: number; trigger: number;
}) {
  const progress = useSharedValue(0);
  const rad = (angle * Math.PI) / 180;
  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [trigger]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: Math.cos(rad) * dist * p },
        { translateY: Math.sin(rad) * dist * p },
        { scale: p < 0.25 ? p / 0.25 : 1 },
      ],
      opacity: p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1,
    };
  });
  return <Animated.View style={[styles.confettiDot, { backgroundColor: color }, style]} />;
}

export default function EatOutWheel() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { wheelItems, addWheelItem, removeWheelItem, winner, setWinner, filters } = useEatOutStore();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['9%', '75%'], []);
  const sheetPeek = height * 0.08;
  const onWheelIds = useMemo(() => new Set(wheelItems.map(w => w.id)), [wheelItems]);

  const winnerOpacity = useSharedValue(0);
  const winnerY = useSharedValue(30);
  const winnerScale = useSharedValue(0.92);

  useEffect(() => {
    if (winner) {
      winnerOpacity.value = withDelay(80, withTiming(1, { duration: 250 }));
      winnerY.value = withDelay(80, withSpring(0, { damping: 14, stiffness: 140 }));
      winnerScale.value = withDelay(80, withSequence(
        withSpring(1.05, { damping: 7, stiffness: 280 }),
        withSpring(1,    { damping: 14, stiffness: 200 }),
      ));
      setCelebrateTrigger(t => t + 1);
    } else {
      winnerOpacity.value = withTiming(0, { duration: 120 });
      winnerY.value = withTiming(30, { duration: 120 });
      winnerScale.value = withTiming(0.92, { duration: 120 });
    }
  }, [winner]);

  const winnerAnimStyle = useAnimatedStyle(() => ({
    opacity: winnerOpacity.value,
    transform: [{ translateY: winnerY.value }, { scale: winnerScale.value }],
  }));

  useEffect(() => { getFavoritePlaceIds().then(setFavoriteIds).catch(() => {}); }, []);

  async function getLocation() {
    if (userLoc) return userLoc;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLoc(coords); return coords;
    } catch { return null; }
  }

  async function toggleFavorite(restaurant: Restaurant) {
    setTogglingId(restaurant.id);
    try {
      if (favoriteIds.has(restaurant.id)) {
        await removeFavoriteRestaurant(restaurant.id);
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(restaurant.id); return next; });
      } else {
        await addFavoriteRestaurant(restaurant);
        setFavoriteIds(prev => new Set(prev).add(restaurant.id));
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setTogglingId(null); }
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const loc = await getLocation();
        if (!loc) { setSearching(false); return; }
        const results = await searchRestaurants(text, loc.lat, loc.lng, filters.radiusMiles);
        setSuggestions(results.filter(r => !onWheelIds.has(r.id)));
      } catch (e: any) { console.warn(e.message); }
      finally { setSearching(false); }
    }, 500);
  }

  function handleAddFromSuggestion(r: Restaurant) {
    addWheelItem({ id: r.id, label: r.name, data: r });
    setQuery(''); setSuggestions([]);
  }

  async function handleAddCustom() {
    const name = query.trim();
    if (!name) return;
    try {
      const saved = await addCustomRestaurant({ name, address: 'Custom entry', distanceMiles: 0, cuisineTypes: [], location: { lat: 0, lng: 0 } });
      addWheelItem({ id: saved.id, label: saved.name, data: saved });
      setQuery(''); setSuggestions([]);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function handleRemove(item: WheelItem<Restaurant>) {
    removeWheelItem(item.id);
  }

  function handleBack() {
    setWinner(null);
    router.back();
  }

  const noMatches = query.trim().length > 1 && !searching && suggestions.length === 0;
  const wheelSize = Math.min(300, width - 48);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={[styles.iconBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}
          >
            <Text style={[styles.iconBtnTxt, { color: colors.primary }]}>←</Text>
          </Pressable>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            {wheelItems.length} {wheelItems.length === 1 ? 'restaurant' : 'restaurants'} on the wheel
          </Text>
          <View style={styles.iconBtnSpacer} />
        </View>

        <View style={[styles.mainContent, { paddingBottom: sheetPeek + 30 }]}>
          <View>
            <SpinWheel items={wheelItems} onSpinEnd={(item) => setWinner(item.data)} size={wheelSize} />
          </View>

          <Animated.View style={[styles.winnerOuter, winnerAnimStyle]}>
            {winner && (
              <Pressable
                style={[styles.resultCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                onPress={() => openInMaps(winner)}
              >
                <View style={styles.confettiOrigin} pointerEvents="none">
                  {CONFETTI.map((c, i) => <ConfettiDot key={i} {...c} trigger={celebrateTrigger} />)}
                </View>
                <View style={styles.resultTop}>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultEmoji}>🎉</Text>
                    <Text style={[styles.resultName, { color: colors.primaryDark }]}>{winner.name}</Text>
                    {winner.address ? <Text style={[styles.resultSub, { color: colors.primary }]}>{winner.address}</Text> : null}
                    <View style={styles.resultMeta}>
                      {winner.distanceMiles > 0 && <Text style={[styles.metaChip, { color: colors.primary }]}>{winner.distanceMiles.toFixed(1)} mi</Text>}
                      {winner.rating ? <Text style={[styles.metaChip, { color: colors.primary }]}>★ {winner.rating.toFixed(1)}</Text> : null}
                    </View>
                  </View>
                  <Pressable
                    style={[styles.starBtn, { backgroundColor: favoriteIds.has(winner.id) ? colors.primary : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => toggleFavorite(winner)}
                    disabled={togglingId === winner.id}
                  >
                    <Text style={{ fontSize: 18, color: favoriteIds.has(winner.id) ? '#fff' : colors.primaryDark }}>
                      {favoriteIds.has(winner.id) ? '★' : '☆'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.resultHint, { color: colors.primaryDark }]}>📍 Tap to open in Google Maps</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: colors.bgCard }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.searchRow}>
            <BottomSheetTextInput
              style={[styles.input, {
                flex: 1,
                borderColor: colors.border,
                backgroundColor: isDark ? colors.bgMuted : colors.bg,
                color: colors.textPrimary,
              }]}
              placeholder="Add a restaurant..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator style={styles.searchSpinner} color={colors.primary} size="small" />}
          </View>

          {suggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              {suggestions.map(r => (
                <Pressable key={r.id} style={[styles.suggestionRow, { borderBottomColor: colors.border }]} onPress={() => handleAddFromSuggestion(r)}>
                  <View style={styles.suggestionInfo}>
                    <Text style={[styles.suggestionName, { color: colors.textPrimary }]}>{r.name}</Text>
                    <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>
                      {r.address}{r.distanceMiles > 0 ? ` · ${r.distanceMiles.toFixed(1)} mi` : ''}
                      {r.rating ? ` · ★ ${r.rating.toFixed(1)}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.suggestionAdd, { color: colors.primary }]}>+ Add</Text>
                </Pressable>
              ))}
            </View>
          )}

          {noMatches && (
            <Pressable style={[styles.addCustomRow, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={handleAddCustom}>
              <Text style={[styles.addCustomTxt, { color: colors.primaryDark }]}>
                Add "<Text style={styles.addCustomBold}>{query.trim()}</Text>" manually
              </Text>
            </Pressable>
          )}

          <Text style={[styles.sheetLabel, { color: colors.sectionLabel }]}>On the wheel</Text>
          {wheelItems.length === 0 && (
            <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No restaurants yet — add some above.</Text>
          )}
          {wheelItems.map(item => (
            <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.label}</Text>
              <View style={styles.itemActions}>
                <Pressable onPress={() => toggleFavorite(item.data)} disabled={togglingId === item.id} hitSlop={12}>
                  <Text style={{ fontSize: 20, color: favoriteIds.has(item.id) ? colors.primary : colors.textMuted }}>
                    {favoriteIds.has(item.id) ? '★' : '☆'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleRemove(item)} hitSlop={12}>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  iconBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  iconBtnSpacer: { width: 36 },
  heading: { flex: 1, fontSize: font.sm, fontWeight: '600', textAlign: 'center' },
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  winnerOuter: { width: '100%', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  resultCard: { borderRadius: radius.xl, borderWidth: 1.5, padding: spacing.lg, overflow: 'visible' },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  resultInfo: { flex: 1, gap: 3 },
  resultEmoji: { fontSize: 24, marginBottom: 2 },
  resultName: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.3 },
  resultSub: { fontSize: font.sm },
  resultMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  metaChip: { fontSize: font.xs, fontWeight: '600' },
  starBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  resultHint: { fontSize: font.xs, fontWeight: '500', marginTop: spacing.sm, opacity: 0.8 },
  confettiOrigin: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  confettiDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  sheetContent: { paddingHorizontal: spacing.lg },
  sheetTitle: { fontSize: font.md, fontWeight: '700', marginBottom: spacing.md },
  sheetLabel: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyTxt: { fontSize: font.sm, fontStyle: 'italic' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: font.sm },
  searchSpinner: { position: 'absolute', right: 12 },
  suggestions: { borderWidth: 1.5, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: font.sm, fontWeight: '600' },
  suggestionMeta: { fontSize: font.xs },
  suggestionAdd: { fontSize: font.sm, fontWeight: '600' },
  addCustomRow: { borderRadius: radius.md, padding: 12, marginBottom: spacing.sm, borderWidth: 1 },
  addCustomTxt: { fontSize: font.sm },
  addCustomBold: { fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  itemName: { fontSize: font.sm, flex: 1 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  removeX: { fontSize: 16, paddingLeft: 4 },
});
