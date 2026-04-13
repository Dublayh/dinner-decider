import { useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipes, deleteCustomRecipe, saveSpoonacularRecipe } from '@/lib/customRecipes';
import { fetchRecipes } from '@/lib/spoonacular';
import type { Recipe, EatInFilters, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';

const EFFORT_COLOR: Record<string, string> = {
  quick: '#7A9E7E',
  medium: '#C17A3C',
  weekend: '#8A5228',
};

export default function RecipeBook() {
  const router = useRouter();
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
      setShowSearch(true);
      setFiltersExpanded(false);
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

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>

        <Text style={styles.heading}>Recipe Book</Text>
        <Text style={styles.sub}>{recipes.length} saved recipe{recipes.length !== 1 ? 's' : ''}</Text>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Text style={styles.searchClearTxt}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.addBtn} onPress={() => router.push('/recipes/add')}>
            <Text style={styles.addBtnTxt}>+ Add Recipe</Text>
          </Pressable>
          <Pressable
            style={[styles.findBtn, finding && styles.btnDisabled]}
            onPress={showSearch ? () => setShowSearch(false) : () => setFiltersExpanded(v => !v)}
            disabled={finding}
          >
            {finding
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={styles.findBtnTxt}>{showSearch ? 'Hide Results' : (activeSearch > 0 ? `Find Recipes (${activeSearch})` : 'Find Recipes')}</Text>
            }
          </Pressable>
        </View>

        {!showSearch && filtersExpanded && (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Search filters</Text>
            <Text style={styles.filterLabel}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => (
                <Pressable key={c} style={[styles.tag, searchFilters.cuisines.includes(c) && styles.tagOn]} onPress={() => toggleSC(c)}>
                  <Text style={[styles.tagTxt, searchFilters.cuisines.includes(c) && styles.tagTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.filterLabel}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => (
                <Pressable key={value} style={[styles.tag, searchFilters.efforts.includes(value) && styles.tagOn]} onPress={() => toggleSE(value)}>
                  <Text style={[styles.tagTxt, searchFilters.efforts.includes(value) && styles.tagTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.searchGoBtn, finding && styles.btnDisabled]} onPress={handleFindRecipes} disabled={finding}>
              <Text style={styles.searchGoBtnTxt}>Search Spoonacular</Text>
            </Pressable>
          </View>
        )}

        {showSearch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {searchResults.length > 0 ? `${searchResults.length} found — tap to save` : 'No new recipes found.'}
            </Text>
            {searchResults.map(r => (
              <View key={r.id} style={styles.resultRow}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultMeta}>{r.cuisine} · {r.readyInMinutes} min</Text>
                </View>
                <Pressable style={styles.saveResultBtn} onPress={() => handleSaveRecipe(r)}>
                  <Text style={styles.saveResultBtnTxt}>Save</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {filteredRecipes.length !== recipes.length ? `${filteredRecipes.length} of ${recipes.length}` : 'Your Recipes'}
          </Text>
          <Pressable style={[styles.filterToggleBtn, activeList > 0 && styles.filterToggleBtnActive]} onPress={() => setListFiltersExpanded(v => !v)}>
            <Text style={[styles.filterToggleTxt, activeList > 0 && styles.filterToggleTxtActive]}>
              {listFiltersExpanded ? '▲' : '▼'} Filter{activeList > 0 ? ` (${activeList})` : ''}
            </Text>
          </Pressable>
        </View>

        {listFiltersExpanded && (
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => (
                <Pressable key={c} style={[styles.tag, listCuisines.includes(c) && styles.tagOn]} onPress={() => toggleLC(c)}>
                  <Text style={[styles.tagTxt, listCuisines.includes(c) && styles.tagTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.filterLabel}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => (
                <Pressable key={value} style={[styles.tag, listEfforts.includes(value) && styles.tagOn]} onPress={() => toggleLE(value)}>
                  <Text style={[styles.tagTxt, listEfforts.includes(value) && styles.tagTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {activeList > 0 && <Pressable onPress={() => { setListCuisines([]); setListEfforts([]); }}><Text style={styles.clearTxt}>Clear filters</Text></Pressable>}
          </View>
        )}

        <View style={styles.list}>
          {filteredRecipes.length === 0
            ? <Text style={styles.empty}>{recipes.length === 0 ? 'No recipes yet. Add some manually or use Find Recipes.' : 'No recipes match your filters.'}</Text>
            : filteredRecipes.map(r => (
                <Pressable key={r.id} style={styles.recipeCard} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })}>
                  <View style={[styles.recipeAccent, { backgroundColor: EFFORT_COLOR[r.effort] ?? colors.primary }]} />
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName}>{r.name}</Text>
                    <Text style={styles.recipeMeta}>{r.cuisine} · {r.effort === 'quick' ? 'Quick' : r.effort === 'medium' ? 'Medium' : 'Weekend'}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(r.id, r.name)} hitSlop={8} style={styles.deleteBtn}>
                    <Text style={styles.deleteX}>✕</Text>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  heading: { fontSize: font.xxl, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  addBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  findBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  findBtnTxt: { color: colors.primary, fontWeight: '600', fontSize: font.sm },
  btnDisabled: { opacity: 0.6 },
  filterCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  filterCardTitle: { fontSize: font.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  filterLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  tagOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tagTxt: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '500' },
  tagTxtOn: { color: colors.primaryDark, fontWeight: '600' },
  searchGoBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 12, alignItems: 'center', marginTop: spacing.xs },
  searchGoBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  resultInfo: { flex: 1 },
  resultName: { fontSize: font.md, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  resultMeta: { fontSize: font.xs, color: colors.textMuted },
  saveResultBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  saveResultBtnTxt: { color: colors.primaryDark, fontWeight: '600', fontSize: font.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.sm },
  listTitle: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary },
  filterToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border },
  filterToggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterToggleTxt: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '500' },
  filterToggleTxtActive: { color: colors.primaryDark },
  clearTxt: { color: colors.primary, fontSize: font.sm, textAlign: 'right', marginTop: 4 },
  list: { gap: spacing.sm, marginTop: 4 },
  recipeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  recipeAccent: { width: 5, alignSelf: 'stretch' },
  recipeInfo: { flex: 1, paddingVertical: 14, paddingHorizontal: spacing.md },
  recipeName: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  recipeMeta: { fontSize: font.xs, color: colors.textMuted },
  deleteBtn: { paddingRight: spacing.md, paddingLeft: spacing.sm },
  deleteX: { color: colors.border, fontSize: 16 },
  empty: { fontSize: font.sm, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.xl },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.sm, color: colors.textPrimary },
  searchClear: { padding: 4 },
  searchClearTxt: { color: colors.textMuted, fontSize: 14 },
});
