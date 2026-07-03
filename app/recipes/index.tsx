import { useState, useCallback, useRef, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput, Share, Modal, Animated, Dimensions, Easing, Platform } from 'react-native';
import KeyboardScrollView from '@/components/KeyboardScrollView';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomRecipes, deleteCustomRecipe, saveSpoonacularRecipe, addCustomRecipe } from '@/lib/customRecipes';
import { shareContent } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { fetchRecipes } from '@/lib/spoonacular';
import { useAppAlert, AppToast, AppConfirmDialog } from '@/components/AppDialog';
import type { Recipe, EatInFilters, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, EFFORT_SHORT } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';

const EFFORT_COLOR: Record<string, string> = {
  quick: '#6F7D46',
  medium: '#C9962E',
  long: '#7E5233',
  weekend: '#9C3D2E',
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

function BottomSheetModal({ visible, onClose, children, avoidKeyboard = false }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      // Reset keyboard offset when closing
      keyboardOffset.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!avoidKeyboard) return;
    const { Keyboard } = require('react-native');
    const showSub = Keyboard.addListener('keyboardDidShow', (e: any) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[bsStyles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[bsStyles.sheetContainer, { transform: [{ translateY: sheetY }, { translateY: keyboardOffset }] }]}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

const bsStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,4,0.55)', zIndex: 1000 },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001 },
});

export default function RecipeBook() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 100, right: 16 });
  const menuBtnRef = useRef<any>(null);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const { showToast, showConfirm, toast, confirm, dismissConfirm } = useAppAlert();
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const load = useCallback(async () => {
    try { setRecipes(await getCustomRecipes()); }
    catch (e: any) { showToast(e.message, 'error'); }
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
    const doDelete = async () => {
      try { await deleteCustomRecipe(id); setRecipes(p => p.filter(r => r.id !== id)); showToast(`"${name}" removed.`, 'success'); }
      catch (e: any) { showToast(e.message, 'error'); }
    };
    showConfirm('Remove recipe', `Remove "${name}"?`, doDelete, { label: 'Remove', destructive: true });
  }


  async function handleExport() {
    if (!recipes.length) { showToast('Add some recipes first.', 'info'); return; }
    const json = JSON.stringify(recipes, null, 2);
    try { await shareContent(json, 'My Recipes'); }
    catch (e: any) { showToast(e.message, 'error'); }
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    setFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-recipe-url', {
        body: { url },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const r = data.recipe;
      const existingNames = new Set(recipes.map((x: any) => x.name.toLowerCase()));
      if (existingNames.has(r.name.toLowerCase())) {
        showToast(`"${r.name}" is already in your Recipe Book.`, 'error');
        return;
      }
      await addCustomRecipe({
        name: r.name, cuisine: r.cuisine ?? 'American',
        effort: r.effort ?? 'medium',
        readyInMinutes: r.readyInMinutes ?? 0,
        servings: r.servings ?? 4,
        ingredients: r.ingredients ?? [],
        steps: r.steps ?? [],
      });
      setShowUrlImport(false);
      setUrlInput('');
      load();
      showToast(`"${r.name}" added to your Recipe Book! 🎉`, 'success');
    } catch (e: any) {
      showToast(e.message ?? 'Could not import recipe.', 'error');
    } finally {
      setFetchingUrl(false);
    }
  }


  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importText.trim());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const existingNames = new Set(recipes.map((r: any) => r.name.toLowerCase()));
      let added = 0;
      for (const r of arr) {
        if (!r.name) continue;
        if (existingNames.has(r.name.toLowerCase())) continue;
        await addCustomRecipe({
          name: r.name, cuisine: r.cuisine ?? 'Custom',
          effort: r.effort ?? 'medium',
          readyInMinutes: r.readyInMinutes ?? 0,
          servings: r.servings ?? 2,
          ingredients: r.ingredients ?? [],
          steps: r.steps ?? [],
          sections: r.sections,
          imageUrl: r.imageUrl,
        });
        added++;
      }
      setShowImport(false);
      setImportText('');
      load();
      const skipped = arr.length - added;
      showToast(`Imported ${added} recipe${added !== 1 ? 's' : ''}.${skipped > 0 ? ` Skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}.` : ''}`, 'success');
    } catch {
      showToast('Invalid JSON — make sure you pasted the full exported text.', 'error');
    } finally { setImporting(false); }
  }

    async function handleFindRecipes() {
    setFinding(true);
    try {
      const results = await fetchRecipes(searchFilters);
      const saved = new Set(recipes.map(r => r.id));
      setSearchResults(results.filter(r => !saved.has(r.id)));
      setShowSearch(true); setFiltersExpanded(false);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setFinding(false); }
  }

  async function handleSaveRecipe(r: Recipe) {
    try {
      const saved = await saveSpoonacularRecipe(r);
      setRecipes(p => [saved, ...p]);
      setSearchResults(p => p.filter(x => x.id !== r.id));
    } catch (e: any) { showToast(e.message, 'error'); }
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
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />
      {confirm && <AppConfirmDialog visible title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} confirmDestructive={confirm.destructive} onConfirm={confirm.onConfirm} onCancel={dismissConfirm} />}
      <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }: { pressed: boolean }) => [
            styles.backBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.ink },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
          ]}
        >
          <Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text>
        </Pressable>

        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>THE ARCHIVE — No. 03</Text>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Recipe Book</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>{recipes.length} SAVED RECIPE{recipes.length !== 1 ? 'S' : ''}</Text>
          </View>

          {/* ⋯ menu button */}
          <View>
            <Pressable
              ref={menuBtnRef}
              onPress={() => {
                if (menuBtnRef.current) {
                  const el = Platform.OS === 'web'
                    ? menuBtnRef.current
                    : null;
                  if (el?.getBoundingClientRect) {
                    const rect = el.getBoundingClientRect();
                    const screenWidth = Dimensions.get('window').width;
                    setMenuPos({ top: rect.bottom + 4, right: screenWidth - rect.right });
                  } else {
                    menuBtnRef.current?.measure?.((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
                      const screenWidth = Dimensions.get('window').width;
                      setMenuPos({ top: py + h + 4, right: screenWidth - px - w });
                    });
                  }
                }
                setShowMenu(v => !v);
              }}
              style={[styles.menuBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}
            >
              <Text style={[styles.menuBtnTxt, { color: colors.textPrimary }]}>⋯</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }]}>
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
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, borderColor: colors.ink },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
            ]}
            onPress={() => router.push('/recipes/add')}
          >
            <Text style={styles.addBtnTxt}>+ ADD RECIPE</Text>
          </Pressable>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.findBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink, opacity: finding ? 0.6 : 1 },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
            ]}
            onPress={showSearch ? () => setShowSearch(false) : () => setFiltersExpanded(v => !v)}
            disabled={finding}
          >
            {finding
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={[styles.findBtnTxt, { color: colors.textPrimary }]}>{showSearch ? 'HIDE RESULTS' : (activeSearch > 0 ? `FIND RECIPES (${activeSearch})` : 'FIND RECIPES')}</Text>
            }
          </Pressable>
        </View>

        {!showSearch && filtersExpanded && (
          <View style={[styles.filterCard, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
            <Text style={[styles.filterCardTitle, { color: colors.textPrimary }]}>Search filters</Text>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => {
                const on = searchFilters.cuisines.includes(c);
                return (
                  <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => toggleSC(c)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => {
                const on = searchFilters.efforts.includes(value);
                return (
                  <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => toggleSE(value)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.searchGoBtn,
                { backgroundColor: colors.primary, borderColor: colors.ink, opacity: finding ? 0.6 : 1 },
                pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
              ]}
              onPress={handleFindRecipes}
              disabled={finding}
            >
              <Text style={styles.searchGoBtnTxt}>SEARCH SPOONACULAR</Text>
            </Pressable>
          </View>
        )}

        {showSearch && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {searchResults.length > 0 ? `${searchResults.length} found — tap to save` : 'No new recipes found.'}
            </Text>
            {searchResults.map(r => (
              <View key={r.id} style={[styles.resultRow, { borderBottomColor: colors.line }]}>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.resultMeta, { color: colors.textMuted }]}>{`${r.cuisine} · ${r.readyInMinutes} MIN`.toUpperCase()}</Text>
                </View>
                <Pressable style={[styles.saveResultBtn, { backgroundColor: colors.ink }]} onPress={() => handleSaveRecipe(r)}>
                  <Text style={[styles.saveResultBtnTxt, { color: colors.stampText }]}>SAVE</Text>
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
            style={[styles.filterToggleBtn, { borderColor: colors.ink, backgroundColor: activeList > 0 ? colors.ink : 'transparent' }]}
            onPress={() => setListFiltersExpanded(v => !v)}
          >
            <Text style={[styles.filterToggleTxt, { color: activeList > 0 ? colors.stampText : colors.textPrimary }]}>
              {listFiltersExpanded ? '▲' : '▼'} FILTER{activeList > 0 ? ` (${activeList})` : ''}
            </Text>
          </Pressable>
        </View>

        {listFiltersExpanded && (
          <View style={[styles.filterCard, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Cuisine</Text>
            <View style={styles.tagRow}>
              {CUISINE_OPTIONS.map(c => {
                const on = listCuisines.includes(c);
                return (
                  <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => toggleLC(c)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { color: colors.sectionLabel }]}>Effort</Text>
            <View style={styles.tagRow}>
              {EFFORT_OPTIONS.map(({ label, value }) => {
                const on = listEfforts.includes(value);
                return (
                  <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => toggleLE(value)}>
                    <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {activeList > 0 && (
              <Pressable onPress={() => { setListCuisines([]); setListEfforts([]); }}>
                <Text style={[styles.clearTxt, { color: colors.primary }]}>CLEAR FILTERS</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.list}>
          {filteredRecipes.length === 0
            ? <Text style={[styles.empty, { color: colors.textMuted }]}>{recipes.length === 0 ? 'No recipes yet. Add some manually or use Find Recipes.' : 'No recipes match your filters.'}</Text>
            : filteredRecipes.map(r => (
                <Swipeable
                  key={r.id}
                  friction={2}
                  rightThreshold={60}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.deleteAction}
                      onPress={() => handleDelete(r.id, r.name)}
                    >
                      <Text style={styles.deleteActionIcon}>🗑</Text>
                      <Text style={styles.deleteActionTxt}>Delete</Text>
                    </Pressable>
                  )}
                >
                  <Pressable
                    style={[styles.recipeCard, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}
                    onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })}
                  >
                    <View style={[styles.recipeAccent, { backgroundColor: EFFORT_COLOR[r.effort] ?? colors.primary }]} />
                    <View style={styles.recipeInfo}>
                      <Text style={[styles.recipeName, { color: colors.textPrimary }]}>{r.name}</Text>
                      <Text style={[styles.recipeMeta, { color: colors.textMuted }]}>{`${r.cuisine} · ${EFFORT_SHORT[r.effort]}`.toUpperCase()}</Text>
                    </View>
                  </Pressable>
                </Swipeable>
              ))
          }
        </View>
      </KeyboardScrollView>

      {/* ⋯ dropdown menu as Modal so it renders above everything */}
      {showMenu && (
        <Modal visible transparent animationType="none" onRequestClose={() => setShowMenu(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)} />
          <View style={[styles.dropdown, { backgroundColor: colors.bgCard, borderColor: colors.ink, top: menuPos.top, right: menuPos.right }, hardShadow(colors.shadow, 3)]}>
            <Pressable
              style={[styles.dropdownItem, { borderBottomColor: colors.line }]}
              onPress={() => { setShowMenu(false); handleExport(); }}
            >
              <Text style={[styles.dropdownTxt, { color: colors.textPrimary }]}>↑ Export</Text>
            </Pressable>
            <Pressable
              style={[styles.dropdownItem, { borderBottomColor: colors.line }]}
              onPress={() => { setShowMenu(false); setShowImport(true); }}
            >
              <Text style={[styles.dropdownTxt, { color: colors.textPrimary }]}>↓ Import JSON</Text>
            </Pressable>
            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setShowMenu(false); setShowUrlImport(true); }}
            >
              <Text style={[styles.dropdownTxt, { color: colors.textPrimary }]}>🔗 Import from URL</Text>
            </Pressable>
          </View>
        </Modal>
      )}

      {/* Import modal */}
      <BottomSheetModal visible={showImport} onClose={() => { setShowImport(false); setImportText(''); }} avoidKeyboard>
        <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.ink, paddingBottom: insets.bottom + 24 }]}>

          <View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Import Recipes</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>Long-press the box below and tap Paste</Text>
            </View>
            <Pressable onPress={() => { setShowImport(false); setImportText(''); }} style={[styles.modalClose, { borderColor: colors.ink }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={[styles.modalInput, {
              borderColor: importText.trim() ? colors.primary : colors.border,
              backgroundColor: colors.bg,
              color: colors.textPrimary,
            }]}
            placeholder="Paste JSON here..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={importText}
            onChangeText={setImportText}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />

          {importText.trim().length > 0 && (
            <Text style={[styles.modalHint, {
              color: (importText.trim().startsWith('[') || importText.trim().startsWith('{')) ? colors.accent : colors.danger,
            }]}>
              {(importText.trim().startsWith('[') || importText.trim().startsWith('{')) ? '✓ Looks good' : '✗ Should start with [ or {'}
            </Text>
          )}

          <View style={styles.modalBtns}>
            <Pressable onPress={() => { setShowImport(false); setImportText(''); }} style={[styles.modalBtn, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
              <Text style={[styles.modalBtnTxt, { color: colors.textPrimary }]}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={handleImport}
              disabled={importing || !importText.trim()}
              style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.ink, opacity: (importing || !importText.trim()) ? 0.5 : 1 }]}
            >
              {importing ? <ActivityIndicator color="#FFF6E8" size="small" /> : <Text style={[styles.modalBtnTxt, { color: '#FFF6E8' }]}>IMPORT</Text>}
            </Pressable>
          </View>

        </View>
      </BottomSheetModal>

      {/* Import from URL modal */}
      <BottomSheetModal visible={showUrlImport} onClose={() => { setShowUrlImport(false); setUrlInput(''); }} avoidKeyboard>
        <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.ink, paddingBottom: insets.bottom + 24 }]}>

          <View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Import from URL</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>Paste a link to any recipe page</Text>
            </View>
            <Pressable onPress={() => { setShowUrlImport(false); setUrlInput(''); }} style={[styles.modalClose, { borderColor: colors.ink }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={[styles.modalInput, {
              height: 56,
              borderColor: urlInput.trim() ? colors.primary : colors.border,
              backgroundColor: colors.bg,
              color: colors.textPrimary,
            }]}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleUrlImport}
          />

          <Text style={[styles.modalHint, { color: colors.textMuted }]}>
            Works with most major recipe sites that use standard recipe markup.
          </Text>

          <View style={styles.modalBtns}>
            <Pressable onPress={() => { setShowUrlImport(false); setUrlInput(''); }} style={[styles.modalBtn, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
              <Text style={[styles.modalBtnTxt, { color: colors.textPrimary }]}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={handleUrlImport}
              disabled={fetchingUrl || !urlInput.trim()}
              style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.ink, opacity: (fetchingUrl || !urlInput.trim()) ? 0.5 : 1 }]}
            >
              {fetchingUrl ? <ActivityIndicator color="#FFF6E8" size="small" /> : <Text style={[styles.modalBtnTxt, { color: '#FFF6E8' }]}>IMPORT</Text>}
            </Pressable>
          </View>

        </View>
      </BottomSheetModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, lineHeight: 21 },
  kicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: 6 },
  heading: { fontFamily: type.serifBlack, fontSize: 34, lineHeight: 40, marginBottom: 4 },
  sub: { fontFamily: type.mono, fontSize: 10, letterSpacing: 1.5 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.lg },
  menuBtn: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  menuBtnTxt: { fontSize: 16, fontWeight: '700' },
  dropdown: {
    position: 'absolute', borderRadius: radius.md,
    borderWidth: 1.5, overflow: 'hidden', zIndex: 99, minWidth: 170,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  dropdownTxt: { fontFamily: type.serifSemi, fontSize: font.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, marginBottom: spacing.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: type.mono, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  searchClear: { padding: 4 },
  searchClearTxt: { fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  addBtn: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, padding: 13, alignItems: 'center' },
  addBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  findBtn: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: 13, alignItems: 'center' },
  findBtnTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  filterCard: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.md },
  filterCardTitle: { fontFamily: type.serifBold, fontSize: font.md, marginBottom: spacing.sm },
  filterLabel: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 2, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1.5 },
  tagTxt: { fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
  searchGoBtn: { borderRadius: radius.md, borderWidth: 1.5, padding: 12, alignItems: 'center', marginTop: spacing.xs },
  searchGoBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontFamily: type.serifItalic, fontSize: font.sm, marginBottom: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: spacing.sm },
  resultInfo: { flex: 1 },
  resultName: { fontFamily: type.serifSemi, fontSize: font.md, marginBottom: 2 },
  resultMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 1 },
  saveResultBtn: { borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  saveResultBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.sm },
  listTitle: { fontFamily: type.serifBold, fontSize: font.lg },
  filterToggleBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1.5 },
  filterToggleTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 },
  clearTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1, textAlign: 'right', marginTop: 4 },
  list: { gap: 12, marginTop: 4 },
  recipeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden' },
  recipeAccent: { width: 5, alignSelf: 'stretch' },
  recipeInfo: { flex: 1, paddingVertical: 14, paddingHorizontal: spacing.md },
  recipeName: { fontFamily: type.serifSemi, fontSize: 17, marginBottom: 4 },
  recipeMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 1 },
  deleteAction: { backgroundColor: '#A93226', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: radius.md, marginLeft: 6 },
  deleteActionIcon: { fontSize: 18 },
  deleteActionTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1, color: '#FFF6E8', marginTop: 2 },
  empty: { fontFamily: type.serifItalic, fontSize: font.sm, textAlign: 'center', marginTop: spacing.xl },
  // Modal
  modalBox: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontFamily: type.serifBold, fontSize: 20, marginBottom: 2 },
  modalSub: { fontFamily: type.serifItalic, fontSize: font.sm },
  modalClose: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modalInput: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, height: 160, fontSize: 12, fontFamily: type.mono },
  modalHint: { marginHorizontal: spacing.lg, marginTop: spacing.sm, fontFamily: type.mono, fontSize: 10, letterSpacing: 0.5 },
  modalBtns: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  modalBtn: { flex: 1, borderRadius: radius.md, padding: 14, alignItems: 'center', borderWidth: 1.5 },
  modalBtnTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
});
