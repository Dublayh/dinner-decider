import { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEatInStore } from '@/store/wheelStore';
import SpinWheel from '@/components/SpinWheel';
import { addCustomRecipe, deleteCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import type { Recipe, WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

export default function EatInWheel() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wheelItems, addWheelItem, removeWheelItem, winner, setWinner } = useEatInStore();
  const [query, setQuery] = useState('');
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);

  async function ensureRecipesLoaded() {
    if (recipesLoaded) return;
    try { const data = await getCustomRecipes(); setAllRecipes(data); setRecipesLoaded(true); } catch {}
  }

  const onWheelIds = useMemo(() => new Set(wheelItems.map(w => w.id)), [wheelItems]);

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
      const saved = await addCustomRecipe({ name, cuisine: 'Custom', effort: 'medium', readyInMinutes: 0, servings: 2, ingredients: [], steps: [] });
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{wheelItems.length} recipes on the wheel</Text>

        <SpinWheel items={wheelItems} onSpinEnd={(item) => setWinner(item.data)} />

        {winner && (
          <Pressable
            style={[styles.resultCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: winner.id } })}
          >
            <Text style={[styles.resultName, { color: colors.primaryDark }]}>{winner.name}</Text>
            <Text style={[styles.resultSub, { color: colors.primary }]}>
              {winner.cuisine}{winner.readyInMinutes > 0 ? ` · ${winner.readyInMinutes} min` : ''}
            </Text>
            <Text style={[styles.recipeHint, { color: colors.primaryDark }]}>📖 Tap to view full recipe</Text>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.sectionLabel }]}>Edit the wheel</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }]}
            placeholder="Search your recipes..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={ensureRecipesLoaded}
            returnKeyType="done"
          />
        </View>

        {suggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {suggestions.map(r => (
              <Pressable key={r.id} style={[styles.suggestionRow, { borderBottomColor: colors.border }]} onPress={() => handleAddFromSuggestion(r)}>
                <View style={styles.suggestionInfo}>
                  <Text style={[styles.suggestionName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>{r.cuisine} · {r.effort === 'quick' ? 'Quick' : r.effort === 'medium' ? 'Medium' : 'Weekend'}</Text>
                </View>
                <Text style={[styles.suggestionAdd, { color: colors.primary }]}>+ Add</Text>
              </Pressable>
            ))}
          </View>
        )}

        {noMatches && (
          <Pressable style={[styles.addCustomRow, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={handleAddCustom}>
            <Text style={[styles.addCustomTxt, { color: colors.primaryDark }]}>Add "<Text style={styles.addCustomBold}>{query.trim()}</Text>" as a custom recipe</Text>
          </Pressable>
        )}

        {wheelItems.map((item) => (
          <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.label}</Text>
            <Pressable onPress={() => handleRemove(item)} hitSlop={8}>
              <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
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
  resultCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.xl, alignItems: 'center', gap: 6, borderWidth: 1.5 },
  resultName: { fontSize: font.xl, fontWeight: '700' },
  resultSub: { fontSize: font.sm },
  recipeHint: { marginTop: 6, fontSize: font.sm, fontWeight: '500' },
  divider: { height: 1, marginVertical: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1.5 },
  searchRow: { marginBottom: 4 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: font.sm },
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
  removeX: { fontSize: 16, paddingLeft: 12 },
});
