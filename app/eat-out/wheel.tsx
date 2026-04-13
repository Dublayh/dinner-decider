import { useState, useRef, useMemo, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useEatOutStore } from '@/store/wheelStore';
import SpinWheel from '@/components/SpinWheel';
import { addCustomRestaurant, deleteCustomRestaurant } from '@/lib/customRestaurants';
import { searchRestaurants } from '@/lib/places';
import { getFavoritePlaceIds, addFavoriteRestaurant, removeFavoriteRestaurant } from '@/lib/favoriteRestaurants';
import type { Restaurant, WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

function openInMaps(restaurant: Restaurant) {
  const query = encodeURIComponent(restaurant.address || restaurant.name);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
}

export default function EatOutWheel() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wheelItems, addWheelItem, removeWheelItem, winner, setWinner, filters } = useEatOutStore();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWheelIds = useMemo(() => new Set(wheelItems.map(w => w.id)), [wheelItems]);

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
      } catch (e: any) { console.warn('Search error:', e.message); }
      finally { setSearching(false); }
    }, 500);
  }

  function handleAddFromSuggestion(restaurant: Restaurant) {
    addWheelItem({ id: restaurant.id, label: restaurant.name, data: restaurant });
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
    try {
      if (item.data.isCustom) await deleteCustomRestaurant(item.id);
      removeWheelItem(item.id);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  const noMatches = query.trim().length > 1 && !searching && suggestions.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{wheelItems.length} restaurants on the wheel</Text>

        <SpinWheel items={wheelItems} onSpinEnd={(item) => setWinner(item.data)} />

        {winner && (
          <Pressable style={[styles.resultCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => openInMaps(winner)}>
            <View style={styles.resultTop}>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: colors.primaryDark }]}>{winner.name}</Text>
                <Text style={[styles.resultSub, { color: colors.primary }]}>
                  {winner.address}{winner.distanceMiles > 0 ? ` · ${winner.distanceMiles.toFixed(1)} mi` : ''}
                </Text>
                {winner.rating && <Text style={[styles.resultSub, { color: colors.primary }]}>★ {winner.rating.toFixed(1)}</Text>}
              </View>
              <Pressable
                style={[styles.starBtn, { backgroundColor: favoriteIds.has(winner.id) ? colors.primary : 'rgba(255,255,255,0.5)' }]}
                onPress={() => toggleFavorite(winner)}
                disabled={togglingId === winner.id}
              >
                <Text style={[styles.starTxt, { color: favoriteIds.has(winner.id) ? '#fff' : colors.primaryDark }]}>
                  {favoriteIds.has(winner.id) ? '★' : '☆'}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.mapsHint, { color: colors.primaryDark }]}>📍 Tap to open in Google Maps</Text>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.sectionLabel }]}>Edit the wheel</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1, borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }]}
            placeholder="Search for a restaurant..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator style={styles.searchSpinner} color={colors.primary} size="small" />}
        </View>

        {suggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
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

        {wheelItems.map((item) => (
          <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.label}</Text>
            <View style={styles.itemActions}>
              <Pressable onPress={() => toggleFavorite(item.data)} disabled={togglingId === item.id} hitSlop={8}>
                <Text style={[styles.itemStar, { color: favoriteIds.has(item.id) ? colors.primary : colors.textMuted }]}>
                  {favoriteIds.has(item.id) ? '★' : '☆'}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleRemove(item)} hitSlop={8}>
                <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.md },
  backTxt: { fontSize: font.md },
  heading: { fontSize: font.lg, fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' },
  resultCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.xl, gap: 6, borderWidth: 1.5 },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { fontSize: font.xl, fontWeight: '700' },
  resultSub: { fontSize: font.sm },
  starBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  starTxt: { fontSize: 20 },
  mapsHint: { fontSize: font.sm, fontWeight: '500', marginTop: 4 },
  divider: { height: 1, marginVertical: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
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
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1 },
  itemName: { fontSize: font.sm, flex: 1 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemStar: { fontSize: 20 },
  removeX: { fontSize: 16 },
});
