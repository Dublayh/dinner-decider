import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Animated,
  TextInput, ScrollView, LayoutAnimation, Platform,
  UIManager, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { parseAmount, formatAmount } from '@/lib/amountUtils';
import {
  getGroceryItems, addGroceryItem, toggleGroceryItem,
  deleteCheckedItems, clearAllItems,
} from '@/lib/groceryList';
import type { GroceryItem } from '@/lib/groceryList';

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

function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/(?<=[a-z])s\b/, '');
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT = Dimensions.get('window').height * 0.82;

export default function GroceryListModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast, toast } = useAppAlert();

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const inputRef = useRef<TextInput>(null);

  const combined = combineItems(items);
  const sortedCombined = [
    ...combined.filter(i => !i.checked),
    ...combined.filter(i => i.checked),
  ];

  useEffect(() => {
    if (visible) {
      setMounted(true);
      load();
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
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

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />

      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        <View style={[styles.content, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 16, maxHeight: SHEET_HEIGHT }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Shopping List</Text>
            <View style={styles.headerBtns}>
              <Pressable
                style={[styles.clearBtn, { backgroundColor: colors.bgMuted, borderColor: colors.border }]}
                onPress={handleClearChecked}
              >
                <Text style={[styles.clearBtnTxt, { color: colors.textSecondary }]}>Clear checked</Text>
              </Pressable>
              <Pressable
                style={[styles.clearBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
                onPress={handleClearAll}
              >
                <Text style={[styles.clearBtnTxt, { color: colors.danger }]}>Clear all</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.addRow, { borderColor: colors.border, backgroundColor: colors.bgMuted }]}>
            <TextInput
              ref={inputRef}
              style={[styles.addInput, { color: colors.textPrimary }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
              placeholder="Add an item..."
              placeholderTextColor={colors.textMuted}
              value={newItemText}
              onChangeText={setNewItemText}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.primary, opacity: adding ? 0.6 : 1 }]}
              onPress={handleAdd}
              disabled={adding}
            >
              {adding
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.addBtnTxt}>+</Text>
              }
            </Pressable>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : sortedCombined.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Your shopping list is empty.{'\n'}Add items above or they'll appear here from your meal plan.
              </Text>
            ) : (
              sortedCombined.map(item => (
                <Pressable
                  key={item.ids.join('-')}
                  style={[styles.item, { borderBottomColor: colors.border }]}
                  onPress={() => handleToggle(item)}
                >
                  <View style={[
                    styles.checkbox,
                    {
                      borderColor: item.checked ? colors.primary : colors.border,
                      backgroundColor: item.checked ? colors.primary : 'transparent',
                    },
                  ]}>
                    {item.checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.itemAmt, { color: colors.textMuted }]}>
                    {item.amount}{item.unit ? ` ${item.unit}` : ''}
                  </Text>
                  <View style={styles.itemRight}>
                    <Text style={[
                      styles.itemName,
                      {
                        color: item.checked ? colors.textMuted : colors.textPrimary,
                        textDecorationLine: item.checked ? 'line-through' : 'none',
                      },
                    ]}>
                      {item.text}
                    </Text>
                    {item.sources.length > 0 && (
                      <Text style={[styles.itemSources, { color: colors.textMuted }]}>
                        {item.sources.join(', ')}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  content: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: font.lg, fontWeight: '800' },
  headerBtns: { flexDirection: 'row', gap: spacing.sm },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  clearBtnTxt: { fontSize: font.xs, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  addInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: font.sm },
  addBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 22, fontWeight: '600', lineHeight: 26 },
  list: { paddingHorizontal: spacing.lg },
  empty: { textAlign: 'center', marginTop: 32, fontSize: font.sm, lineHeight: 22 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  itemAmt: { fontSize: font.sm, minWidth: 60 },
  itemRight: { flex: 1 },
  itemName: { fontSize: font.sm },
  itemSources: { fontSize: font.xs, marginTop: 2 },
});
