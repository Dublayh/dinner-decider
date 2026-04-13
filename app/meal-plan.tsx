import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Alert, Modal, ActivityIndicator, FlatList, TextInput,
  Animated, Dimensions, Easing,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';
import { getMealPlanForRange, setMealPlanEntry, clearMealPlanEntry, getShoppingChecks, saveShoppingChecks } from '@/lib/mealPlan';
import { getCustomRecipes } from '@/lib/customRecipes';
import { useMealPlanSpinStore } from '@/store/wheelStore';
import type { MealPlanEntry } from '@/lib/mealPlan';
import type { Recipe } from '@/types';

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
  quick: '#7A9E7E', medium: '#C17A3C', weekend: '#8A5228',
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
      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetY }] }]} pointerEvents="box-none">
        {children}
      </Animated.View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function MealPlanScreen() {
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
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Load checks when shopping list opens
  async function openShoppingList() {
    setShowShoppingList(true);
    ensureRecipesLoaded();
    try {
      const keys = await getShoppingChecks(weekStartStr);
      setCheckedItems(new Set(keys));
    } catch {}
  }

  // Save checks when shopping list closes
  async function closeShoppingList() {
    setShowShoppingList(false);
    try {
      await saveShoppingChecks(weekStartStr, Array.from(checkedItems));
    } catch {}
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
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, [rangeStart, rangeEnd]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useFocusEffect(useCallback(() => { loadPlan(); }, [loadPlan]));

  async function ensureRecipesLoaded() {
    if (recipesLoaded) return;
    const all = await getCustomRecipes();
    setRecipes(all);
    setRecipesLoaded(true);
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
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function clearDay() {
    if (!selectedDate) return;
    setShowPicker(false);
    try {
      await clearMealPlanEntry(selectedDate);
      setPlan(p => { const n = { ...p }; delete n[selectedDate]; return n; });
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  function handleSpin() {
    if (!selectedDate) return;
    setPendingDate(selectedDate);
    setShowPicker(false);
    router.push('/eat-in/filters');
  }

  function toggleCheck(key: string) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Filter out sauces/spice mixes, apply search
  const filteredRecipes = recipes.filter(r =>
    r.cuisine !== 'Sauces' && r.cuisine !== 'Spice Mixes' &&
    (!recipeSearch.trim() || r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  // Shopping list
  const weekEntries = weekDays.map(d => plan[toDateStr(d)]).filter(Boolean);
  const weekRecipeIds = new Set(weekEntries.filter(e => e?.type === 'recipe' && e.recipe_id).map(e => e.recipe_id));
  const weekRecipes = recipes.filter(r => weekRecipeIds.has(r.id));

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
      <Pressable style={[styles.monthCell, { borderColor: isToday ? colors.primary : colors.border, backgroundColor: isToday ? colors.primaryLight : colors.bgCard, borderWidth: isToday ? 1.5 : 1, opacity: isPast ? 0.55 : 1 }]} onPress={() => openDayPicker(ds)}>
        <Text style={[styles.monthCellDay, { color: isToday ? colors.primary : colors.textMuted }]}>{date.getDate()}</Text>
        {entry?.type === 'leftovers' && <Text style={styles.monthCellEmoji}>🥡</Text>}
        {entry?.type === 'eat_out' && <Text style={styles.monthCellEmoji}>🍴</Text>}
        {entry?.type === 'recipe' && <View style={[styles.monthCellDot, { backgroundColor: colors.primary }]} />}
      </Pressable>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}>
            <Text style={[styles.iconBtnTxt, { color: colors.primary }]}>←</Text>
          </Pressable>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Meal Plan</Text>
          <Pressable
            onPress={() => openShoppingList()}
            style={[styles.iconBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}
          >
            <Text style={{ fontSize: 16 }}>🛒</Text>
          </Pressable>
        </View>

        <View style={[styles.toggleRow, { backgroundColor: colors.bgMuted }]}>
          {(['week', 'month'] as const).map(m => (
            <Pressable key={m} style={[styles.toggleBtn, viewMode === m && { backgroundColor: colors.bgCard, borderRadius: radius.md }]} onPress={() => setViewMode(m)}>
              <Text style={[styles.toggleBtnTxt, { color: viewMode === m ? colors.textPrimary : colors.textMuted }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
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
                    <Pressable key={ds} style={[styles.weekRow, { backgroundColor: isToday ? colors.primaryLight : colors.bgCard, borderColor: isToday ? colors.primary : colors.border, borderWidth: isToday ? 1.5 : 1, opacity: isPast ? 0.6 : 1 }]} onPress={() => openDayPicker(ds)}>
                      <View style={styles.weekDayLabel}>
                        <Text style={[styles.weekDayName, { color: isToday ? colors.primary : colors.textMuted }]}>{DAYS[i]}</Text>
                        <Text style={[styles.weekDayNum, { color: isToday ? colors.primary : colors.textPrimary }]}>{day.getDate()}</Text>
                      </View>
                      <View style={styles.weekRowContent}>
                        {!entry && <Text style={[styles.weekEmpty, { color: colors.textMuted }]}>Tap to plan</Text>}
                        {entry?.type === 'leftovers' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🥡</Text><Text style={[styles.weekEntryName, { color: colors.textSecondary }]}>Leftovers</Text></View>}
                        {entry?.type === 'eat_out' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🍴</Text><Text style={[styles.weekEntryName, { color: colors.textSecondary }]}>Eating Out</Text></View>}
                        {entry?.type === 'recipe' && <View style={styles.weekEntryRow}><Text style={styles.weekEntryEmoji}>🍽️</Text><Text style={[styles.weekEntryName, { color: colors.textPrimary }]} numberOfLines={1}>{entry.recipe_name}</Text></View>}
                      </View>
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
        <View style={[styles.modalBox, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedDayLabel}</Text>
              {selectedEntry && (
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  {selectedEntry.type === 'leftovers' ? '🥡 Leftovers' : selectedEntry.type === 'eat_out' ? '🍴 Eating Out' : `🍽️ ${selectedEntry.recipe_name}`}
                </Text>
              )}
            </View>
            <Pressable onPress={() => setShowPicker(false)} style={[styles.closeBtn, { backgroundColor: colors.bgMuted }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          <View style={[styles.quickOptions, { borderBottomColor: colors.border }]}>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgMuted, borderColor: colors.border }]} onPress={() => assign({ type: 'leftovers' })} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🥡</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>Leftovers</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgMuted, borderColor: colors.border }]} onPress={() => assign({ type: 'eat_out' })} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🍴</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>Eat Out</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { backgroundColor: colors.bgMuted, borderColor: colors.border }]} onPress={handleSpin} disabled={saving}>
              <Text style={styles.quickBtnEmoji}>🎲</Text>
              <Text style={[styles.quickBtnTxt, { color: colors.textPrimary }]}>Spin</Text>
            </Pressable>
            {selectedEntry && (
              <Pressable style={[styles.quickBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]} onPress={clearDay} disabled={saving}>
                <Text style={styles.quickBtnEmoji}>🗑</Text>
                <Text style={[styles.quickBtnTxt, { color: colors.danger }]}>Clear</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <TextInput style={[styles.searchInput, { color: colors.textPrimary }]} placeholder="Search recipes..." placeholderTextColor={colors.textMuted} value={recipeSearch} onChangeText={setRecipeSearch} returnKeyType="search" />
            {recipeSearch.length > 0 && <Pressable onPress={() => setRecipeSearch('')}><Text style={{ color: colors.textMuted, fontSize: 14, paddingRight: 4 }}>✕</Text></Pressable>}
          </View>

          <Text style={[styles.pickerLabel, { color: colors.sectionLabel }]}>Recipe Book</Text>

          <FlatList
            data={filteredRecipes}
            keyExtractor={r => r.id}
            style={styles.recipeList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: r }) => (
              <Pressable style={[styles.recipeRow, { borderBottomColor: colors.border }]} onPress={() => assign({ type: 'recipe', recipe_id: r.id, recipe_name: r.name })} disabled={saving}>
                <View style={[styles.recipeAccent, { backgroundColor: EFFORT_COLOR[r.effort] ?? colors.primary }]} />
                <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: spacing.md }}>
                  <Text style={[styles.recipeName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.recipeMeta, { color: colors.textMuted }]}>{r.cuisine} · {r.effort === 'quick' ? '⚡ Quick' : r.effort === 'medium' ? '👨‍🍳 Medium' : '🌟 Weekend'}</Text>
                </View>
                <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.emptyTxt, { color: colors.textMuted }]}>{recipes.length === 0 ? 'No recipes yet.' : 'No recipes match your search.'}</Text>}
          />
        </View>
      </BottomSheetModal>

      {/* ── Shopping list ── */}
      <BottomSheetModal visible={showShoppingList} onClose={closeShoppingList}>
        <View style={[styles.modalBox, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Shopping List</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>{weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} – {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()]}</Text>
            </View>
            <Pressable onPress={closeShoppingList} style={[styles.closeBtn, { backgroundColor: colors.bgMuted }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.shoppingScroll} contentContainerStyle={{ paddingBottom: 24 }}>
            {weekRecipes.length === 0
              ? <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No recipes planned this week yet.</Text>
              : weekRecipes.map(r => {
                  const ings = [...(r.ingredients ?? []), ...(r.sections?.flatMap(s => s.ingredients ?? []) ?? [])];
                  return (
                    <View key={r.id}>
                      <View style={[styles.shoppingRecipeHeader, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.shoppingRecipeName, { color: colors.primaryDark }]}>{r.name}</Text>
                      </View>
                      {ings.map((ing, i) => {
                        const key = `${r.id}-${i}`;
                        const checked = checkedItems.has(key);
                        return (
                          <Pressable key={key} style={[styles.shoppingRow, { borderBottomColor: colors.border }]} onPress={() => toggleCheck(key)}>
                            <View style={[styles.shoppingCheck, {
                              borderColor: checked ? colors.primary : colors.border,
                              backgroundColor: checked ? colors.primary : 'transparent',
                            }]}>
                              {checked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 16 }}>✓</Text>}
                            </View>
                            <Text style={[styles.shoppingAmt, { color: checked ? colors.textMuted : colors.textMuted }]}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                            <Text style={[styles.shoppingName, { color: checked ? colors.textMuted : colors.textPrimary, textDecorationLine: checked ? 'line-through' : 'none' }]}>{ing.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })
            }
          </ScrollView>
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  heading: { flex: 1, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  toggleRow: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: radius.md, padding: 3, marginBottom: spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  toggleBtnTxt: { fontSize: font.sm, fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  navBtn: { padding: spacing.sm },
  navBtnTxt: { fontSize: 28, lineHeight: 32 },
  navLabel: { flex: 1, textAlign: 'center', fontSize: font.md, fontWeight: '600' },
  weekRow: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  weekDayLabel: { width: 44, alignItems: 'center' },
  weekDayName: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  weekDayNum: { fontSize: font.xl, fontWeight: '800', lineHeight: 28 },
  weekRowContent: { flex: 1, paddingHorizontal: spacing.md },
  weekEmpty: { fontSize: font.sm, fontStyle: 'italic' },
  weekEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekEntryEmoji: { fontSize: 18 },
  weekEntryName: { fontSize: font.sm, fontWeight: '500', flex: 1 },
  weekChevron: { fontSize: 22 },
  monthHeader: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  monthHeaderDay: { flex: 1, textAlign: 'center', fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 4 },
  monthCell: { width: '13%', aspectRatio: 1, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthCellEmpty: { width: '13%', aspectRatio: 1 },
  monthCellDay: { fontSize: font.xs, fontWeight: '600' },
  monthCellEmoji: { fontSize: 10 },
  monthCellDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  // Bottom sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.88 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: 2 },
  modalSub: { fontSize: font.sm },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickOptions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1 },
  quickBtn: { flex: 1, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  quickBtnEmoji: { fontSize: 22 },
  quickBtnTxt: { fontSize: font.xs, fontWeight: '600', textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: font.sm },
  pickerLabel: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  recipeList: { maxHeight: 300 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  recipeAccent: { width: 4, alignSelf: 'stretch' },
  recipeName: { fontSize: font.sm, fontWeight: '600', marginBottom: 2 },
  recipeMeta: { fontSize: font.xs },
  rowChevron: { fontSize: 20, paddingRight: spacing.md },
  emptyTxt: { fontSize: font.sm, fontStyle: 'italic', padding: spacing.lg },
  shoppingScroll: { paddingHorizontal: spacing.lg },
  shoppingRecipeHeader: { paddingHorizontal: spacing.md, paddingVertical: 8, marginTop: spacing.md, borderRadius: radius.sm },
  shoppingRecipeName: { fontSize: font.sm, fontWeight: '700' },
  shoppingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1 },
  shoppingCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  shoppingAmt: { fontSize: font.sm, minWidth: 60 },
  shoppingName: { fontSize: font.sm, flex: 1 },
});
