import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Animated,
  TextInput, ScrollView, LayoutAnimation, Platform,
  UIManager, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import {
  getGroceryItems, addGroceryItem, toggleGroceryItem,
  deleteCheckedItems, clearAllItems,
} from '@/lib/groceryList';
import type { GroceryItem } from '@/lib/groceryList';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

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
  const sheetY = useRef(new Animated.Value(800)).current;
  const inputRef = useRef<TextInput>(null);

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);
  const sortedItems = [...unchecked, ...checked];

  // Animate modal in/out
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
        Animated.timing(sheetY, { toValue: 800, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Real-time subscription
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

  async function handleToggle(item: GroceryItem) {
    const next = !item.checked;
    // Optimistic update
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: next } : i));
    try {
      await toggleGroceryItem(item.id, next);
    } catch (e: any) {
      // Revert
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked } : i));
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
    if (!checked.length) { showToast('No checked items to clear.', 'info'); return; }
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

      {/* Dim overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        <View style={[styles.content, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
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

          {/* Add input */}
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

          {/* List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : sortedItems.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Your shopping list is empty.{'\n'}Add items above or they'll appear here from your meal plan.
              </Text>
            ) : (
              sortedItems.map(item => (
                <Pressable
                  key={item.id}
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
                  <View style={styles.itemContent}>
                    <Text style={[
                      styles.itemName,
                      {
                        color: item.checked ? colors.textMuted : colors.textPrimary,
                        textDecorationLine: item.checked ? 'line-through' : 'none',
                      },
                    ]}>
                      {item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ''} ` : ''}{item.text}
                    </Text>
                    {item.source !== 'manual' && (
                      <Text style={[styles.itemSource, { color: colors.textMuted }]}>{item.source}</Text>
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
  content: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
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
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemName: { fontSize: font.sm, fontWeight: '500' },
  itemSource: { fontSize: font.xs, marginTop: 2 },
});
