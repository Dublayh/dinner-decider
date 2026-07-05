import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Animated,
  TextInput, ScrollView, LayoutAnimation, Platform,
  UIManager, ActivityIndicator, PanResponder, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { parseAmount, formatAmount } from '@/lib/amountUtils';
import {
  getGroceryItems, addGroceryItem, toggleGroceryItem,
  deleteCheckedItems, clearAllItems, addRecipeToGroceryList,
  setItemStore, normalizeIngredientName,
} from '@/lib/groceryList';
import type { GroceryItem } from '@/lib/groceryList';
import { getStores, addStore, deleteStore } from '@/lib/stores';
import type { Store } from '@/lib/stores';
import StorePickerSheet from '@/components/StorePickerSheet';
import { getCustomRecipes } from '@/lib/customRecipes';
import type { Recipe } from '@/types';

// Count ingredients a recipe would contribute (flat + sections, named only)
function recipeIngredientCount(r: Recipe): number {
  const ings = [
    ...(r.ingredients ?? []),
    ...(r.sections?.flatMap(s => s.ingredients ?? []) ?? []),
  ];
  return ings.filter(i => i.name?.trim()).length;
}

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface CombinedItem {
  ids: string[];
  text: string;
  amount: string;
  unit: string;
  checked: boolean;
  sources: string[];
}

interface StoreGroup {
  store: string | null;   // null = unassigned
  label: string;
  items: CombinedItem[];
}

function combineItems(items: GroceryItem[]): CombinedItem[] {
  const map = new Map<string, CombinedItem>();

  for (const item of items) {
    const normName = normalizeIngredientName(item.text);
    const normUnit = (item.unit ?? '').toLowerCase().trim();
    const key = `${normName}|${normUnit}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      const existingAmt = parseAmount(existing.amount);
      const newAmt = parseAmount(item.amount ?? '');
      if (existingAmt !== null && newAmt !== null) {
        existing.amount = formatAmount(existingAmt + newAmt);
      }
      existing.ids.push(item.id);
      if (item.source !== 'manual' && !existing.sources.includes(item.source)) {
        existing.sources.push(item.source);
      }
      if (!item.checked) existing.checked = false;
    } else {
      map.set(key, {
        ids: [item.id],
        text: item.text,
        amount: item.amount ?? '',
        unit: item.unit ?? '',
        checked: item.checked,
        sources: item.source !== 'manual' ? [item.source] : [],
      });
    }
  }

  return Array.from(map.values());
}

// Bucket raw items by store, combine within each bucket, and order the buckets:
// known stores in their configured order, then any orphan stores, then unassigned last.
// Within a bucket, unchecked items sort above checked ones (matches the flat list).
function buildStoreGroups(items: GroceryItem[], stores: Store[]): StoreGroup[] {
  const byStore = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const key = item.store || '';
    (byStore.get(key) ?? byStore.set(key, []).get(key)!).push(item);
  }

  const orderedKeys: string[] = [];
  for (const s of stores) if (byStore.has(s.name)) orderedKeys.push(s.name);
  for (const key of byStore.keys()) {
    if (key !== '' && !orderedKeys.includes(key)) orderedKeys.push(key); // orphan store names
  }
  if (byStore.has('')) orderedKeys.push('');

  return orderedKeys.map(key => {
    const combined = combineItems(byStore.get(key)!);
    return {
      store: key || null,
      label: key || 'UNASSIGNED',
      items: [...combined.filter(i => !i.checked), ...combined.filter(i => i.checked)],
    };
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Receipt perforation rule — text-based so it renders identically everywhere
function DashRule({ color, style }: { color: string; style?: any }) {
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="clip"
      style={[{ fontFamily: type.mono, fontSize: 10, lineHeight: 12, color, overflow: 'hidden' }, style]}
    >
      {'– '.repeat(120)}
    </Text>
  );
}

export default function GroceryListModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { showToast, toast } = useAppAlert();

  // Cap the sheet so the handle always stays on screen, whatever the viewport
  // is doing (keyboard open, PWA chrome, rotation).
  const sheetMax = winHeight - insets.top - 48;

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFilter, setStoreFilter] = useState<string | null>(null); // null = ALL, '' = unassigned, else store name
  const [pickerFor, setPickerFor] = useState<CombinedItem | null>(null);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(winHeight)).current;
  const inputRef = useRef<TextInput>(null);

  // Latest values for the PanResponder (created once, closes over refs)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const winHeightRef = useRef(winHeight);
  winHeightRef.current = winHeight;

  // Drag the handle to collapse the sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) {
          onCloseRef.current();
        } else {
          Animated.spring(sheetY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
      },
    })
  ).current;

  const allGroups = buildStoreGroups(items, stores);
  const totalCount = allGroups.reduce((n, g) => n + g.items.length, 0);
  // The store feature stays invisible until there's at least one store or a placed item.
  const storeFeatureActive = stores.length > 0 || items.some(i => i.store);
  const hasUnassigned = allGroups.some(g => g.store === null && g.items.length > 0);
  const visibleGroups = storeFilter === null
    ? allGroups
    : allGroups.filter(g => (storeFilter === '' ? g.store === null : g.store === storeFilter));

  // Recipe search: match the typed text against recipe names
  const query = newItemText.trim().toLowerCase();
  const listSources = new Set(items.map(i => i.source));
  const matchingRecipes = query.length >= 2
    ? recipes.filter(r => r.name.toLowerCase().includes(query)).slice(0, 5)
    : [];

  useEffect(() => {
    if (visible) {
      setMounted(true);
      load();
      getStores().then(setStores).catch(() => {});
      if (recipes.length === 0) getCustomRecipes().then(setRecipes).catch(() => {});
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: winHeightRef.current, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const channel = supabase
      .channel('grocery_list_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'grocery_list' }, payload => {
        setItems(prev => {
          if (prev.find(i => i.id === payload.new.id)) return prev;
          return [payload.new as GroceryItem, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'grocery_list' }, payload => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as GroceryItem : i));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'grocery_list' }, payload => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems(prev => prev.filter(i => i.id !== payload.old.id));
      })
      // Keep both users' store lists in sync as either edits them
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
        getStores().then(setStores).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [visible]);

  async function load() {
    setLoading(true);
    try {
      const data = await getGroceryItems();
      setItems(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(combinedItem: CombinedItem) {
    const next = !combinedItem.checked;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems(prev => prev.map(i =>
      combinedItem.ids.includes(i.id) ? { ...i, checked: next } : i
    ));
    try {
      await Promise.all(combinedItem.ids.map(id => toggleGroceryItem(id, next)));
    } catch (e: any) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems(prev => prev.map(i =>
        combinedItem.ids.includes(i.id) ? { ...i, checked: !next } : i
      ));
      showToast(e.message, 'error');
    }
  }

  async function handleAdd() {
    const text = newItemText.trim();
    if (!text) return;
    setAdding(true);
    try {
      const item = await addGroceryItem(text);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems(prev => [item, ...prev]);
      setNewItemText('');
      inputRef.current?.focus();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleAddRecipe(r: Recipe) {
    try {
      const n = await addRecipeToGroceryList(r);
      setNewItemText('');
      inputRef.current?.focus();
      // Silent refetch (realtime also updates, but this is immediate and avoids a spinner flash)
      getGroceryItems().then(setItems).catch(() => {});
      showToast(
        n > 0 ? `Added ${n} item${n === 1 ? '' : 's'} from ${r.name}` : 'That recipe has no ingredients.',
        n > 0 ? 'success' : 'info',
      );
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function handleClearChecked() {
    if (!items.some(i => i.checked)) { showToast('No checked items to clear.', 'info'); return; }
    try {
      await deleteCheckedItems();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems(prev => prev.filter(i => !i.checked));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function handleClearAll() {
    if (!items.length) { showToast('List is already empty.', 'info'); return; }
    try {
      await clearAllItems();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems([]);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  // Assign (or clear) a combined item's store; teaches the memory for next time.
  async function handleAssignStore(item: CombinedItem, store: string | null) {
    setPickerFor(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems(prev => prev.map(i => item.ids.includes(i.id) ? { ...i, store } : i));
    try {
      await setItemStore(item.ids, item.text, store);
    } catch (e: any) {
      getGroceryItems().then(setItems).catch(() => {});
      showToast(e.message, 'error');
    }
  }

  async function handleCreateStore(name: string): Promise<Store> {
    const created = await addStore(name);
    setStores(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
    return created;
  }

  async function handleDeleteStore(store: Store) {
    try {
      await deleteStore(store);
      setStores(prev => prev.filter(s => s.id !== store.id));
      setItems(prev => prev.map(i => i.store === store.name ? { ...i, store: null } : i));
      if (storeFilter === store.name) setStoreFilter(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />

      <StorePickerSheet
        visible={!!pickerFor}
        stores={stores}
        current={pickerFor ? (items.find(i => pickerFor.ids.includes(i.id))?.store ?? null) : null}
        itemLabel={pickerFor?.text}
        onSelect={store => pickerFor && handleAssignStore(pickerFor, store)}
        onCreate={handleCreateStore}
        onDeleteStore={handleDeleteStore}
        onClose={() => setPickerFor(null)}
      />

      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        <View style={[styles.content, { backgroundColor: colors.bgCard, borderColor: colors.ink, paddingBottom: insets.bottom + 16, maxHeight: sheetMax }]}>
          {/* Drag zone: handle + masthead collapse the sheet when pulled down */}
          <View {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.ink }]} />

            {/* Receipt masthead */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>SHOPPING LIST</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                ITEMS — {totalCount}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close shopping list"
              style={[styles.closeBtn, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 17 }}>✕</Text>
            </Pressable>
          </View>
          <DashRule color={colors.borderStrong} style={{ marginHorizontal: spacing.lg }} />

          <View style={styles.headerBtns}>
            <Pressable
              style={[styles.clearBtn, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}
              onPress={handleClearChecked}
            >
              <Text style={[styles.clearBtnTxt, { color: colors.textPrimary }]}>CLEAR CHECKED</Text>
            </Pressable>
            <Pressable
              style={[styles.clearBtn, { borderColor: colors.danger, backgroundColor: colors.bgCard }]}
              onPress={handleClearAll}
            >
              <Text style={[styles.clearBtnTxt, { color: colors.danger }]}>CLEAR ALL</Text>
            </Pressable>
          </View>

          <View style={[styles.addRow, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
            <TextInput
              ref={inputRef}
              style={[styles.addInput, { color: colors.textPrimary }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
              placeholder="Add an item or search recipes…"
              placeholderTextColor={colors.textMuted}
              value={newItemText}
              onChangeText={setNewItemText}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.ink, opacity: adding ? 0.6 : 1 }]}
              onPress={handleAdd}
              disabled={adding}
            >
              {adding
                ? <ActivityIndicator color={colors.stampText} size="small" />
                : <Text style={[styles.addBtnTxt, { color: colors.stampText }]}>+</Text>
              }
            </Pressable>
          </View>

          {matchingRecipes.length > 0 && (
            <View style={[styles.recipeResults, { borderColor: colors.ink, backgroundColor: colors.bgMuted }]}>
              <Text style={[styles.recipeResultsLabel, { color: colors.sectionLabel }]}>FROM THE RECIPE BOOK</Text>
              {matchingRecipes.map(r => {
                const count = recipeIngredientCount(r);
                const added = listSources.has(r.name);
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.recipeResultRow, { borderTopColor: colors.line }]}
                    onPress={() => handleAddRecipe(r)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipeResultName, { color: colors.textPrimary }]} numberOfLines={1}>{r.name}</Text>
                      <Text style={[styles.recipeResultMeta, { color: colors.textMuted }]}>
                        {r.cuisine.toUpperCase()} · {count} INGREDIENT{count === 1 ? '' : 'S'}
                      </Text>
                    </View>
                    <View style={[styles.recipeResultAction, added
                      ? { backgroundColor: 'transparent', borderColor: colors.borderStrong }
                      : { backgroundColor: colors.ink, borderColor: colors.ink }]}
                    >
                      <Text style={[styles.recipeResultActionTxt, { color: added ? colors.textMuted : colors.stampText }]}>
                        {added ? '✓ ON LIST' : `+ ${count}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {storeFeatureActive && (
            <View style={styles.filterBarWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterBar}
                keyboardShouldPersistTaps="handled"
              >
                {[
                  { key: null as string | null, label: 'ALL' },
                  ...stores.map(s => ({ key: s.name as string | null, label: s.name.toUpperCase() })),
                  ...(hasUnassigned ? [{ key: '' as string | null, label: 'UNASSIGNED' }] : []),
                ].map(chip => {
                  const on = storeFilter === chip.key;
                  return (
                    <Pressable
                      key={chip.label}
                      onPress={() => setStoreFilter(chip.key)}
                      style={[styles.filterChip, { borderColor: colors.ink, backgroundColor: on ? colors.ink : colors.bgCard }]}
                    >
                      <Text style={[styles.filterChipTxt, { color: on ? colors.stampText : colors.textSecondary }]}>{chip.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : totalCount === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Nothing on the list.{'\n'}Add an item above, or type a recipe name to ring up its ingredients.
              </Text>
            ) : (
              <>
                {visibleGroups.map(group => (
                  <View key={group.store ?? '__unassigned'}>
                    {storeFeatureActive && (
                      <View style={styles.groupHeader}>
                        <Text style={[styles.groupHeaderTxt, { color: group.store ? colors.primary : colors.textMuted }]}>
                          {group.label.toUpperCase()}
                        </Text>
                        <Text style={[styles.groupHeaderCount, { color: colors.textMuted }]}>
                          {group.items.length}
                        </Text>
                      </View>
                    )}
                    {group.items.map(item => (
                      <Pressable
                        key={item.ids.join('-')}
                        style={[styles.item, { borderBottomColor: colors.line }]}
                        onPress={() => handleToggle(item)}
                      >
                        <View style={[
                          styles.checkbox,
                          {
                            borderColor: colors.ink,
                            backgroundColor: item.checked ? colors.ink : 'transparent',
                          },
                        ]}>
                          {item.checked && <Text style={[styles.checkmark, { color: colors.stampText }]}>✓</Text>}
                        </View>
                        <View style={styles.itemMain}>
                          <Text style={[
                            styles.itemName,
                            {
                              color: item.checked ? colors.textMuted : colors.textPrimary,
                              textDecorationLine: item.checked ? 'line-through' : 'none',
                            },
                          ]}>
                            {item.text}
                          </Text>
                          <View style={styles.itemMeta}>
                            {item.sources.length > 0 && (
                              <Text style={[styles.itemSources, { color: colors.textMuted }]} numberOfLines={1}>
                                {item.sources.join(' · ').toUpperCase()}
                              </Text>
                            )}
                            <Pressable
                              onPress={(e) => { (e as any).stopPropagation?.(); setPickerFor(item); }}
                              hitSlop={6}
                              style={[styles.storeTag, group.store
                                ? { borderColor: colors.borderStrong, backgroundColor: colors.bgMuted }
                                : { borderColor: colors.line, borderStyle: 'dashed', backgroundColor: 'transparent' }]}
                            >
                              <Text style={[styles.storeTagTxt, { color: group.store ? colors.textSecondary : colors.textMuted }]}>
                                {group.store ? `📍 ${group.store.toUpperCase()}` : '＋ STORE'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <Text style={[styles.itemAmt, { color: item.checked ? colors.textMuted : colors.textSecondary }]}>
                          {item.amount}{item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <DashRule color={colors.borderStrong} style={{ marginTop: spacing.md }} />
                <Text style={[styles.receiptFooter, { color: colors.textMuted }]}>· THANK YOU · COME AGAIN ·</Text>
              </>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,4,0.55)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  content: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, overflow: 'hidden' },
  handle: { width: 44, height: 3, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  closeBtn: { position: 'absolute', top: 12, right: spacing.md, width: 30, height: 30, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: type.monoBold, fontSize: 16, letterSpacing: 4 },
  subtitle: { fontFamily: type.mono, fontSize: 10, letterSpacing: 2, marginTop: 4 },
  headerBtns: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1.5 },
  clearBtnTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden' },
  addInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 11, fontFamily: type.mono, fontSize: 13 },
  addBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { fontSize: 22, lineHeight: 26, fontFamily: type.mono },
  recipeResults: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderRadius: radius.md, overflow: 'hidden' },
  recipeResultsLabel: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 2, paddingHorizontal: spacing.md, paddingTop: 9, paddingBottom: 7 },
  recipeResultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.md, borderTopWidth: 1 },
  recipeResultName: { fontFamily: type.serifSemi, fontSize: font.md },
  recipeResultMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 1, marginTop: 3 },
  recipeResultAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1.5, minWidth: 48, alignItems: 'center' },
  recipeResultActionTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 },
  list: { paddingHorizontal: spacing.lg, flexShrink: 1 },
  empty: { textAlign: 'center', marginTop: 32, fontFamily: type.serifItalic, fontSize: font.sm, lineHeight: 22 },
  filterBarWrap: { paddingLeft: spacing.lg, marginBottom: spacing.sm },
  filterBar: { gap: 6, paddingRight: spacing.lg },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1.5 },
  filterChipTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: 6 },
  groupHeaderTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5 },
  groupHeaderCount: { fontFamily: type.mono, fontSize: 10, letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 11, lineHeight: 14, fontFamily: type.monoBold },
  itemMain: { flex: 1 },
  itemName: { fontFamily: type.mono, fontSize: 13, lineHeight: 18 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  storeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  storeTagTxt: { fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1 },
  itemSources: { fontFamily: type.mono, fontSize: 8, letterSpacing: 1 },
  itemAmt: { fontFamily: type.mono, fontSize: 12, textAlign: 'right', maxWidth: 110 },
  receiptFooter: { fontFamily: type.mono, fontSize: 9, letterSpacing: 2, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
});
