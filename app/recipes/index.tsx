import { useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipes, deleteCustomRecipe, saveSpoonacularRecipe } from '@/lib/customRecipes';
import { fetchRecipes } from '@/lib/spoonacular';
import type { Recipe, EatInFilters, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

const EFFORT_COLOR: Record<string, string> = {
  quick: '#7A9E7E',
  medium: '#C17A3C',
  weekend: '#8A5228',
};

export default function RecipeBook() {
  const router = useRouter();
  const { colors } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchFilters, setSearchFilters] = useState<EatInFilters>({ cuisines: [], efforts: [] });
  const [listFiltersExpanded, setListFiltersExpanded] = useState(false);
  const [listCuisines, setListCuisines] = useState<string[]>([]);
  const [listEfforts, setListEfforts] = useState<EffortLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try { setRecipes(await getCustomRecipes()); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredRecipes = recipes.filter(r => {
    if (listCuisines.length && !listCuisines.includes(r.cuisine)) return false;
    if (listEfforts.length && !listEfforts.includes(r.effort)) return false;
    if (searchQuery.trim() && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleLC = (c: string) => setListCuisines(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleLE = (e: EffortLevel) => setListEfforts(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);
  const toggleSC = (c: string) => setSearchFilters(f => ({ ...f, cuisines: f.cuisines.includes(c) ? f.cuisines.filter(x => x !== c) : [...f.cuisines, c] }));
  const toggleSE = (e: EffortLevel) => setSearchFilters(f => ({ ...f, efforts: f.efforts.includes(e) ? f.efforts.filter(x => x !== e) : [...f.efforts, e] }));

  async function handleDelete(id: string, name: string) {
    Alert.alert('Remove recipe', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteCustomRecipe(id); setRecipes(p => p.filter(r => r.id !== id)); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  async function handleFindRecipes() {
    setFinding(true);
    try {
      const results = await fetchRecipes(searchFilters);
      const saved = new Set(recipes.map(r => r.id));
      setSearchResults(results.filter(r => !saved.has(r.id)));
      setShowSearch(true); setFiltersExpanded(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setFinding(false); }
  }

  async function handleSaveRecipe(r: Recipe) {
    try {
      const saved = await saveSpoonacularRecipe(r);
      setRecipes(p => [saved, ...p]);
      setSearchResults(p => p.filter(x => x.id !== r.id));
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  const activeList = listCuisines.length + listEfforts.length;
  const activeSearch = searchFilters.cuisines.length + searchFilters.efforts.length;

  if (loading) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>← Back</Text>
        </Pressable>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>Recipe Book</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{recipes.length} saved recipe{recipes.length !== 1 ? 's' : ''}</Text>

        <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={[styles.searchClearTxt, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/recipes/add')}>
            <Text style={styles.addBtnTxt}>+ Add Recipe</Text>
          </Pressable>
          <Pressable
            style={[styles.findBtn, { borderColor: colors.primary, opacity: finding ? 0.6 : 1 }]}
            onPress={showSearch ? () => setShowSearch(false) : () => setFiltersExpanded(v => !v)}
            disabled={finding}
          >
            {finding
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={[styles.findBtnTxt, { color: colors.primary }]}>{showSearch ? 'Hide Results' : (activeSearch > 0 ? `Find Recipes (${activeSearch})` : 'Find Recipes')}</Text>
            }
          </Pressable>
        </View>

        {!showSearch && filtersExpanded && (
          <View style={[styles.filterCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.filterCardTitle, { color: colors.textPrimary }]}>Search filters</Text>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => {
                const on = searchFilters.cuisines.includes(c);
                return (
                  <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => toggleSC(c)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => {
                const on = searchFilters.efforts.includes(value);
                return (
                  <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => toggleSE(value)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={[styles.searchGoBtn, { backgroundColor: colors.primary, opacity: finding ? 0.6 : 1 }]} onPress={handleFindRecipes} disabled={finding}>
              <Text style={styles.searchGoBtnTxt}>Search Spoonacular</Text>
            </Pressable>
          </View>
        )}

        {showSearch && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {searchResults.length > 0 ? `${searchResults.length} found — tap to save` : 'No new recipes found.'}
            </Text>
            {searchResults.map(r => (
              <View key={r.id} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.resultMeta, { color: colors.textMuted }]}>{r.cuisine} · {r.readyInMinutes} min</Text>
                </View>
                <Pressable style={[styles.saveResultBtn, { backgroundColor: colors.primaryLight }]} onPress={() => handleSaveRecipe(r)}>
                  <Text style={[styles.saveResultBtnTxt, { color: colors.primaryDark }]}>Save</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]}>
            {filteredRecipes.length !== recipes.length ? `${filteredRecipes.length} of ${recipes.length}` : 'Your Recipes'}
          </Text>
          <Pressable
            style={[styles.filterToggleBtn, { borderColor: activeList > 0 ? colors.primary : colors.border, backgroundColor: activeList > 0 ? colors.primaryLight : 'transparent' }]}
            onPress={() => setListFiltersExpanded(v => !v)}
          >
            <Text style={[styles.filterToggleTxt, { color: activeList > 0 ? colors.primaryDark : colors.textSecondary }]}>
              {listFiltersExpanded ? '▲' : '▼'} Filter{activeList > 0 ? ` (${activeList})` : ''}
            </Text>
          </Pressable>
        </View>

        {listFiltersExpanded && (
          <View style={[styles.filterCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => {
                const on = listCuisines.includes(c);
                return (
                  <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => toggleLC(c)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => {
                const on = listEfforts.includes(value);
                return (
                  <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => toggleLE(value)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {activeList > 0 && (
              <Pressable onPress={() => { setListCuisines([]); setListEfforts([]); }}>
                <Text style={[styles.clearTxt, { color: colors.primary }]}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.list}>
          {filteredRecipes.length === 0
            ? <Text style={[styles.empty, { color: colors.textMuted }]}>{recipes.length === 0 ? 'No recipes yet. Add some manually or use Find Recipes.' : 'No recipes match your filters.'}</Text>
            : filteredRecipes.map(r => (
                <Pressable key={r.id} style={[styles.recipeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })}>
                  <View style={[styles.recipeAccent, { backgroundColor: EFFORT_COLOR[r.effort] ?? colors.primary }]} />
                  <View style={styles.recipeInfo}>
                    <Text style={[styles.recipeName, { color: colors.textPrimary }]}>{r.name}</Text>
                    <Text style={[styles.recipeMeta, { color: colors.textMuted }]}>{r.cuisine} · {r.effort === 'quick' ? 'Quick' : r.effort === 'medium' ? 'Medium' : 'Weekend'}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(r.id, r.name)} hitSlop={8} style={styles.deleteBtn}>
                    <Text style={[styles.deleteX, { color: colors.border }]}>✕</Text>
                  </Pressable>
                </Pressable>
              ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md },
  heading: { fontSize: font.xxl, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: font.sm, marginBottom: spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, marginBottom: spacing.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.sm },
  searchClear: { padding: 4 },
  searchClearTxt: { fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  addBtn: { flex: 1, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  findBtn: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  findBtnTxt: { fontWeight: '600', fontSize: font.sm },
  filterCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  filterCardTitle: { fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  filterLabel: { fontSize: font.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5 },
  tagTxt: { fontSize: font.xs },
  searchGoBtn: { borderRadius: radius.md, padding: 12, alignItems: 'center', marginTop: spacing.xs },
  searchGoBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: font.sm, marginBottom: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: spacing.sm },
  resultInfo: { flex: 1 },
  resultName: { fontSize: font.md, fontWeight: '500', marginBottom: 2 },
  resultMeta: { fontSize: font.xs },
  saveResultBtn: { borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  saveResultBtnTxt: { fontWeight: '600', fontSize: font.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.sm },
  listTitle: { fontSize: font.md, fontWeight: '600' },
  filterToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5 },
  filterToggleTxt: { fontSize: font.xs, fontWeight: '500' },
  clearTxt: { fontSize: font.sm, textAlign: 'right', marginTop: 4 },
  list: { gap: spacing.sm, marginTop: 4 },
  recipeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', elevation: 1 },
  recipeAccent: { width: 5, alignSelf: 'stretch' },
  recipeInfo: { flex: 1, paddingVertical: 14, paddingHorizontal: spacing.md },
  recipeName: { fontSize: font.md, fontWeight: '600', marginBottom: 3 },
  recipeMeta: { fontSize: font.xs },
  deleteBtn: { paddingRight: spacing.md, paddingLeft: spacing.sm },
  deleteX: { fontSize: 16 },
  empty: { fontSize: font.sm, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.xl },
});
