import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Alert, Modal, ActivityIndicator, FlatList, TextInput,
  Animated, Dimensions, Easing,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';
import { getMealPlanForRange, setMealPlanEntry, clearMealPlanEntry } from '@/lib/mealPlan';
import { addRecipeToGroceryList, deleteGroceryItemsBySource, getGroceryItems } from '@/lib/groceryList';
import GroceryListModal from '@/components/GroceryListModal';
import { getCustomRecipes } from '@/lib/customRecipes';
import { useMealPlanSpinStore } from '@/store/wheelStore';
import type { MealPlanEntry } from '@/lib/mealPlan';
import { EFFORT_SHORT, type Recipe } from '@/types';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + diff); return mon;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(d.getDate() + n); return r;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const EFFORT_COLOR: Record<string, string> = {
  quick: '#6F7D46', medium: '#C9962E', long: '#7E5233', weekend: '#9C3D2E',
};

// ── Animated bottom sheet ────────────────────────────────────────────────────
function BottomSheetModal({ visible, onClose, children }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.sheetContainer, { transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function MealPlanScreen() {
  const { showToast, toast } = useAppAlert();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingDate } = useMealPlanSpinStore();

  const today = new Date();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(getMonday(today));
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [plan, setPlan] = useState<Record<string, MealPlanEntry>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  // Recipe names currently on the shopping list → drives the "already added" dot
  const [listSources, setListSources] = useState<Set<string>>(new Set());

  async function loadListSources() {
    try {
      const items = await getGroceryItems();
      setListSources(new Set(items.map(i => i.source)));
    } catch {}
  }

  // Low-level ops (DB + local dot state), no toast — used by the toggle and its undo
  async function addRecipeItems(r: Recipe): Promise<number> {
    const n = await addRecipeToGroceryList(r);
    setListSources(prev => new Set(prev).add(r.name));
    return n;
  }
  async function removeRecipeItems(source: string): Promise<void> {
    await deleteGroceryItemsBySource(source);
    setListSources(prev => { const n = new Set(prev); n.delete(source); return n; });
  }

  // Tapping the card 🛒 toggles the recipe on/off the shopping list
  async function toggleEntryOnList(entry: MealPlanEntry) {
    if (entry.type !== 'recipe' || !entry.recipe_id) return;
    setSaving(true);
    try {
      const all = await ensureRecipesLoaded();
      const r = all.find(x => x.id === entry.recipe_id);
      if (!r) { showToast('Recipe not found.', 'error'); return; }

      if (listSources.has(r.name)) {
        await removeRecipeItems(r.name);
        showToast('Removed from shopping list', 'info', { label: 'Undo', onPress: () => addBack(r) });
      } else {
        const n = await addRecipeItems(r);
        if (n === 0) { showToast('No ingredients to add.', 'info'); return; }
        showToast(
          `Added ${n} item${n === 1 ? '' : 's'} to shopping list`,
          'success',
          { label: 'Undo', onPress: () => removeBack(r.name) },
        );
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function addBack(r: Recipe) {
    try { const n = await addRecipeItems(r); showToast(`Added ${n} item${n === 1 ? '' : 's'} to shopping list`, 'success'); }
    catch (e: any) { showToast(e.message, 'error'); }
  }
  async function removeBack(source: string) {
    try { await removeRecipeItems(source); showToast('Removed from shopping list', 'info'); }
    catch (e: any) { showToast(e.message, 'error'); }
  }

  const weekDays = getWeekDays(weekStart);
  const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());
  const weekStartStr = toDateStr(weekDays[0]);

  const rangeStart = viewMode === 'week'
    ? toDateStr(weekDays[0])
    : toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const rangeEnd = viewMode === 'week'
    ? toDateStr(weekDays[6])
    : toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getMealPlanForRange(rangeStart, rangeEnd);
      const map: Record<string, MealPlanEntry> = {};
      entries.forEach(e => { map[e.plan_date] = e; });
      setPlan(map);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [rangeStart, rangeEnd]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useFocusEffect(useCallback(() => { loadPlan(); loadListSources(); }, [loadPlan]));

  // Preload recipes so the per-day "add to list" button is instant
  useEffect(() => { ensureRecipesLoaded(); }, []);

  async function ensureRecipesLoaded(): Promise<Recipe[]> {
    if (recipesLoaded) return recipes;
    const all = await getCustomRecipes();
    setRecipes(all);
    setRecipesLoaded(true);
    return all;
  }

  function openDayPicker(dateStr: string) {
    setSelectedDate(dateStr);
    setRecipeSearch('');
    setShowPicker(true);
    ensureRecipesLoaded();
  }

  async function assign(entry: Omit<MealPlanEntry, 'id' | 'plan_date'>) {
    if (!selectedDate) return;
    setSaving(true);
    // Close immediately — no animation conflict
    setShowPicker(false);
    try {
      await setMealPlanEntry(selectedDate, entry);
      setPlan(p => ({ ...p, [selectedDate]: { id: '', plan_date: selectedDate, ...entry } }));
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function clearDay() {
    if (!selectedDate) return;
    setShowPicker(false);
    try {
      await clearMealPlanEntry(selectedDate);
      setPlan(p => { const n = { ...p }; delete n[selectedDate]; return n; });
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  function handleSpin() {
    if (!selectedDate) return;
    setPendingDate(selectedDate);
    setShowPicker(false);
    router.push('/eat-in/filters');
  }

  // Filter out sauces/spice mixes, apply search
  const filteredRecipes = recipes.filter(r =>
    r.cuisine !== 'Sauces' && r.cuisine !== 'Spice Mixes' &&
    (!recipeSearch.trim() || r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  const selectedEntry = selectedDate ? plan[selectedDate] : null;
  const selectedDayLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  function DayCell({ date }: { date: Date | null }) {
    if (!date) return <View style={styles.monthCellEmpty} />;
    const ds = toDateStr(date);
    const entry = plan[ds];
    const isToday = ds === toDateStr(today);
    const isPast = date < today && !isToday;
    return (
      <Pressable style={[styles.monthCell, { borderColor: isToday ? colors.ink : colors.borderStrong, backgroundColor: isToday ? colors.bgCardAlt : colors.bgCard, borderWidth: isToday ? 2 : 1, opacity: isPast ? 0.55 : 1 }]} onPress={() => openDayPicker(ds)}>
        <Text style={[styles.monthCellDay, { color: isToday ? colors.primary : colors.textMuted }]}>{date.getDate()}</Text>
        {entry?.type === 'leftovers' && <Text style={styles.monthCellEmoji}>🥡</Text>}
        {entry?.type === 'eat_out' && <Text style={styles.monthCellEmoji}>🍴</Text>}
        {entry?.type === 'recipe' && <View style={[styles.monthCellDot, { backgroundColor: colors.primary }]} />}
      </Pressable>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} action={toast?.action} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
            ]}
          >
            <Text style={[styles.iconBtnTxt, { color: colors.textPrimary }]}>←</Text>
          </Pressable>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Meal Plan</Text>
          <Pressable
            onPress={() => setShowShoppingList(true)}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
            ]}
          >
            <Text style={{ fontSize: 16 }}>🛒</Text>
          </Pressable>
        </View>

        <View style={[styles.toggleRow, { borderColor: colors.ink, backgroundColor: colors.bgCard }, hardShadow(colors.shadow, 2)]}>
          {(['week', 'month'] as const).map(m => (
            <Pressable key={m} style={[styles.toggleBtn, viewMode === m && { backgroundColor: colors.ink }]} onPress={() => setViewMode(m)}>
              <Text style={[styles.toggleBtnTxt, { color: viewMode === m ? colors.stampText : colors.textSecondary }]}>{m.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {viewMode === 'week' ? (
            <>
              <View style={styles.navRow}>
                <Pressable onPress={() => setWeekStart(d => addDays(d, -7))} style={styles.navBtn}><Text style={[styles.navBtnTxt, { color: colors.primary }]}>‹</Text></Pressable>
                <Text style={[styles.navLabel, { color: colors.textPrimary }]}>{weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} – {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}</Text>
                <Pressable onPress={() => setWeekStart(d => addDays(d, 7))} style={styles.navBtn}><Text style={[styles.navBtnTxt, { color: colors.primary }]}>›</Text></Pressable>
              </View>
              {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> :
                weekDays.map((day, i) => {
                  const ds = toDateStr(day);
                  const entry = plan[ds];
                  const isToday = ds === toDateStr(today);
                  const isPast = day < today && !isToday;
                  return (
                    <Pressable
                      key={ds}
                      style={[
                        styles.weekRow,
                        { backgroundColor: isToday ? colors.bgCardAlt : colors.bgCard, borderColor: colors.ink, borderWidth: isToday ? 2 : 1.5, opacity: isPast ? 0.55 : 1 },
                        hardShadow(colors.shadow, isToday ? 3 : 2),
                      ]}
                      onPress={() => openDayPicker(ds)}
                    >
                      <View style={styles.weekDayLabel}>
                        <Text style={[styles.weekDayName, { color: isToday ? colors.primary : colors.textMuted }]}>{DAYS[i].toUpperCase()}</Text>
                        <Text style={[styles.weekDayNum, { color: isToday ? colors.primary : colors.textPrimary }]}>{day.getDate()}</Text>
                      </View>
                      <View style={[styles.weekDivider, { backgroundColor: colors.line }]} />
                      <View style={styles.weekRowContent}>
                        {!entry && <Text style={[styles.weekEmpty, { color: colors.textMuted }]}>Tap to plan</Text>}
                        {entry?.type === 'leftovers' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🥡</Text><Text style={[styles.weekEntryName, { color: colors.textSecondary }]}>Leftovers</Text></View>}
                        {entry?.type === 'eat_out' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🍴</Text><Text style={[styles.weekEntryName, { color: colors.textSecondary }]}>Eating Out</Text></View>}
                        {entry?.type === 'recipe' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🍽️</Text><Text style={[styles.weekEntryName, { color: colors.textPrimary }]} numberOfLines={1}>{entry.recipe_name}</Text></View>}
                      </View>
                      {entry?.type === 'recipe' && (() => {
                        const added = !!entry.recipe_name && listSources.has(entry.recipe_name);
                        return (
                          <Pressable
                            onPress={(e) => { (e as any)?.stopPropagation?.(); toggleEntryOnList(entry); }}
                            disabled={saving}
                            hitSlop={8}
                            accessibilityLabel={added ? 'Remove ingredients from shopping list' : 'Add ingredients to shopping list'}
                            style={[styles.weekAddBtn, { borderColor: colors.ink, backgroundColor: added ? colors.primaryLight : 'transparent' }]}
                          >
                            <Text style={{ fontSize: 15 }}>🛒</Text>
                            {added && <View style={[styles.listDot, { backgroundColor: colors.primary, borderColor: colors.ink }]} />}
                          </Pressable>
                        );
                      })()}
                      <Text style={[styles.weekChevron, { color: colors.textMuted }]}>›</Text>
                    </Pressable>
                  );
                })
              }
            </>
          ) : (
            <>
              <View style={styles.navRow}>
                <Pressable onPress={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={styles.navBtn}><Text style={[styles.navBtnTxt, { color: colors.primary }]}>‹</Text></Pressable>
                <Text style={[styles.navLabel, { color: colors.textPrimary }]}>{MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}</Text>
                <Pressable onPress={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={styles.navBtn}><Text style={[styles.navBtnTxt, { color: colors.primary }]}>›</Text></Pressable>
              </View>
              <View style={styles.monthHeader}>{DAYS.map(d => <Text key={d} style={[styles.monthHeaderDay, { color: colors.textMuted }]}>{d}</Text>)}</View>
              {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> :
                <View style={styles.monthGrid}>{monthDays.map((day, i) => <DayCell key={i} date={day} />)}</View>
              }
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Day picker ── */}
      <BottomSheetModal visible={showPicker} onClose={() => setShowPicker(false)}>
        <View style={[styles.modalBox, { backgroundColor: colors.bgCard, borderColor: colors.ink, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedDayLabel}</Text>
              {selectedEntry && (
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  {selectedEntry.type === 'leftovers' ? '🥡 Leftovers' : selectedEntry.type === 'eat_out' ? '🍴 Eating Out' : `🍽️ ${selectedEntry.recipe_name}`}
                </Text>
              )}
            </View>
            <Pressable onPress={() => setShowPicker(false)} style={[styles.closeBtn, { borderColor: colors.ink }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.quickOptions, { borderBottomColor: colors.line }]}>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }]} onPress={() => assign({ type: 'leftovers' })} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🥡</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>LEFTOVERS</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }]} onPress={() => assign({ type: 'eat_out' })} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🍴</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>EAT OUT</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }]} onPress={handleSpin} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🎲</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>SPIN</Text>
            </Pressable>
            {selectedEntry && (
              <Pressable style={[styles.quickBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]} onPress={clearDay} disabled={saving}>
                <Text style={styles.quickBtnEmoji}>🗑</Text>
                <Text style={[styles.quickBtnTxt, { color: colors.danger }]}>CLEAR</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.borderStrong }]}>
            <TextInput style={[styles.searchInput, { color: colors.textPrimary }]} placeholder="Search recipes…" placeholderTextColor={colors.textMuted} value={recipeSearch} onChangeText={setRecipeSearch} returnKeyType="search" />
            {recipeSearch.length > 0 && <Pressable onPress={() => setRecipeSearch('')}><Text style={{ color: colors.textMuted, fontSize: 14, paddingRight: 4 }}>✕</Text></Pressable>}
          </View>

          <Text style={[styles.pickerLabel, { color: colors.sectionLabel }]}>FROM THE RECIPE BOOK</Text>

          <FlatList
            data={filteredRecipes}
            keyExtractor={r => r.id}
            style={styles.recipeList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: r }) => (
              <Pressable style={[styles.recipeRow, { borderBottomColor: colors.line }]} onPress={() => assign({ type: 'recipe', recipe_id: r.id, recipe_name: r.name })} disabled={saving}>
                <View style={[styles.recipeAccent, { backgroundColor: EFFORT_COLOR[r.effort] ?? colors.primary }]} />
                <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: spacing.md }}>
                  <Text style={[styles.recipeName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.recipeMeta, { color: colors.textMuted }]}>{`${r.cuisine} · ${EFFORT_SHORT[r.effort]}`.toUpperCase()}</Text>
                </View>
                <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.emptyTxt, { color: colors.textMuted }]}>{recipes.length === 0 ? 'No recipes yet.' : 'No recipes match your search.'}</Text>}
          />
        </View>
      </BottomSheetModal>

      <GroceryListModal visible={showShoppingList} onClose={() => { setShowShoppingList(false); loadListSources(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, lineHeight: 21 },
  heading: { flex: 1, fontFamily: type.serifBold, fontSize: 21, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden', marginBottom: spacing.md + 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  toggleBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  navBtn: { padding: spacing.sm },
  navBtnTxt: { fontSize: 28, lineHeight: 32 },
  navLabel: { flex: 1, textAlign: 'center', fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  weekRow: { marginHorizontal: spacing.lg, marginBottom: 12, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  weekDayLabel: { width: 42, alignItems: 'center' },
  weekDayName: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5 },
  weekDayNum: { fontFamily: type.serifBold, fontSize: 22, lineHeight: 28 },
  weekDivider: { width: 1, alignSelf: 'stretch', marginLeft: spacing.sm },
  weekRowContent: { flex: 1, paddingHorizontal: spacing.md },
  weekEmpty: { fontFamily: type.serifItalic, fontSize: font.sm },
  weekEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekEntryEmoji: { fontSize: 18 },
  weekEntryName: { fontFamily: type.serifSemi, fontSize: font.md, flex: 1 },
  weekAddBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  listDot: { position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: radius.sm, borderWidth: 1.5 },
  weekChevron: { fontSize: 22 },
  monthHeader: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  monthHeaderDay: { flex: 1, textAlign: 'center', fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 4 },
  monthCell: { width: '13%', aspectRatio: 1, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthCellEmpty: { width: '13%', aspectRatio: 1 },
  monthCellDay: { fontFamily: type.mono, fontSize: 11 },
  monthCellEmoji: { fontSize: 10 },
  monthCellDot: { width: 5, height: 5, borderRadius: 1, marginTop: 2 },
  // Bottom sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,4,0.55)' },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalBox: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, maxHeight: SCREEN_HEIGHT * 0.88 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontFamily: type.serifBold, fontSize: 20, marginBottom: 2 },
  modalSub: { fontFamily: type.serifItalic, fontSize: font.sm },
  closeBtn: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quickOptions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1 },
  quickBtn: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', paddingVertical: spacing.md, gap: 5 },
  quickBtnEmoji: { fontSize: 22 },
  quickBtnTxt: { fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: type.mono, fontSize: 13 },
  pickerLabel: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  recipeList: { maxHeight: 300 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  recipeAccent: { width: 4, alignSelf: 'stretch' },
  recipeName: { fontFamily: type.serifSemi, fontSize: font.md, marginBottom: 2 },
  recipeMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 1 },
  rowChevron: { fontSize: 20, paddingRight: spacing.md },
  emptyTxt: { fontFamily: type.serifItalic, fontSize: font.sm, padding: spacing.lg },
});
