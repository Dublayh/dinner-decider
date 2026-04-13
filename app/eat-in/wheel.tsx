import { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEatInStore } from '@/store/wheelStore';
import SpinWheel from '@/components/SpinWheel';
import { addCustomRecipe, deleteCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import type { Recipe, WheelItem } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';

export default function EatInWheel() {
  const router = useRouter();
  const { wheelItems, addWheelItem, removeWheelItem, winner, setWinner } = useEatInStore();
  const [query, setQuery] = useState('');
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);

  // Load all recipes once for search
  async function ensureRecipesLoaded() {
    if (recipesLoaded) return;
    try {
      const data = await getCustomRecipes();
      setAllRecipes(data);
      setRecipesLoaded(true);
    } catch {}
  }

  // IDs already on the wheel
  const onWheelIds = useMemo(() => new Set(wheelItems.map(w => w.id)), [wheelItems]);

  // Filter recipes that match query and aren't already on wheel
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allRecipes.filter(r => !onWheelIds.has(r.id) && r.name.toLowerCase().includes(q));
  }, [query, allRecipes, onWheelIds]);

  const noMatches = query.trim().length > 0 && suggestions.length === 0;

  function handleAddFromSuggestion(recipe: Recipe) {
    addWheelItem({ id: recipe.id, label: recipe.name, data: recipe });
    setQuery('');
  }

  async function handleAddCustom() {
    const name = query.trim();
    if (!name) return;
    try {
      const saved = await addCustomRecipe({
        name, cuisine: 'Custom', effort: 'medium',
        readyInMinutes: 0, servings: 2, ingredients: [], steps: [],
      });
      addWheelItem({ id: saved.id, label: saved.name, data: saved });
      setQuery('');
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function handleRemove(item: WheelItem<Recipe>) {
    try {
      if (item.data.isCustom) await deleteCustomRecipe(item.id);
      removeWheelItem(item.id);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>{wheelItems.length} recipes on the wheel</Text>

        <SpinWheel items={wheelItems} onSpinEnd={(item) => setWinner(item.data)} />

        {winner && (
          <Pressable
            style={styles.resultCard}
            onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: winner.id } })}
          >
            <Text style={styles.resultName}>{winner.name}</Text>
            <Text style={styles.resultSub}>
              {winner.cuisine}{winner.readyInMinutes > 0 ? ` · ${winner.readyInMinutes} min` : ''}
            </Text>
            <Text style={styles.recipeHint}>📖 Tap to view full recipe</Text>
          </Pressable>
        )}

        <View style={styles.divider} />
        <Text style={styles.label}>Edit the wheel</Text>

        {/* Search input */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search your recipes..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={ensureRecipesLoaded}
            returnKeyType="done"
          />
        </View>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map(r => (
              <Pressable key={r.id} style={styles.suggestionRow} onPress={() => handleAddFromSuggestion(r)}>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{r.name}</Text>
                  <Text style={styles.suggestionMeta}>{r.cuisine} · {r.effort === 'quick' ? 'Quick' : r.effort === 'medium' ? 'Medium' : 'Weekend'}</Text>
                </View>
                <Text style={styles.suggestionAdd}>+ Add</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* No matches — offer to add as custom */}
        {noMatches && (
          <Pressable style={styles.addCustomRow} onPress={handleAddCustom}>
            <Text style={styles.addCustomTxt}>Add "<Text style={styles.addCustomBold}>{query.trim()}</Text>" as a custom recipe</Text>
          </Pressable>
        )}

        {/* Current wheel items */}
        {wheelItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.label}</Text>
            <Pressable onPress={() => handleRemove(item)} hitSlop={8}>
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.md },
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  heading: { fontSize: font.lg, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  resultCard: { marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.primaryLight, borderRadius: radius.xl, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary },
  resultName: { fontSize: font.xl, fontWeight: '700', color: colors.primaryDark },
  resultSub: { fontSize: font.sm, color: colors.primary },
  recipeHint: { marginTop: 6, fontSize: font.sm, color: colors.primaryDark, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  searchRow: { marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: font.sm, backgroundColor: colors.bgCard, color: colors.textPrimary },
  suggestions: { backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: font.sm, fontWeight: '600', color: colors.textPrimary },
  suggestionMeta: { fontSize: font.xs, color: colors.textMuted },
  suggestionAdd: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  addCustomRow: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: 12, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.primary },
  addCustomTxt: { fontSize: font.sm, color: colors.primaryDark },
  addCustomBold: { fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: font.sm, color: colors.textPrimary, flex: 1 },
  removeX: { fontSize: 16, color: colors.textMuted, paddingLeft: 12 },
});
