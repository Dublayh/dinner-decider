import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow } from '@/constants/theme';
import type { Store } from '@/lib/stores';

interface Props {
  visible: boolean;
  stores: Store[];
  current: string | null;       // store the tapped item is currently assigned to
  itemLabel?: string;           // ingredient name, shown in the header
  onSelect: (store: string | null) => void;   // pick existing store, or null to unassign
  onCreate: (name: string) => Promise<Store>;  // create a new store
  onDeleteStore: (store: Store) => void;
  onClose: () => void;
}

export default function StorePickerSheet({
  visible, stores, current, itemLabel, onSelect, onCreate, onDeleteStore, onClose,
}: Props) {
  const { colors } = useTheme();
  const [newStore, setNewStore] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleCreate() {
    const name = newStore.trim();
    if (!name || creating) return;
    // If it already exists (case-insensitive), just select it.
    const existing = stores.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) { setNewStore(''); onSelect(existing.name); return; }
    setCreating(true);
    try {
      const created = await onCreate(name);
      setNewStore('');
      onSelect(created.name);
    } finally {
      setCreating(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 3)]}
          onPress={e => e.stopPropagation?.()}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>WHICH STORE?</Text>
          {itemLabel ? (
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>{itemLabel.toUpperCase()}</Text>
          ) : null}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Unassigned option */}
            <Pressable
              style={[styles.row, { borderColor: colors.ink, backgroundColor: current === null ? colors.ink : colors.bgCard }]}
              onPress={() => onSelect(null)}
            >
              <Text style={[styles.rowTxt, { color: current === null ? colors.stampText : colors.textMuted }]}>UNASSIGNED</Text>
            </Pressable>

            {stores.map(s => {
              const on = current === s.name;
              const confirming = pendingDelete === s.id;
              return (
                <View key={s.id} style={styles.rowWrap}>
                  <Pressable
                    style={[styles.row, styles.rowFlex, { borderColor: colors.ink, backgroundColor: on ? colors.ink : colors.bgCard }]}
                    onPress={() => onSelect(s.name)}
                  >
                    <Text style={[styles.rowTxt, { color: on ? colors.stampText : colors.textPrimary }]} numberOfLines={1}>
                      {s.name.toUpperCase()}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.delBtn, { borderColor: confirming ? colors.danger : colors.borderStrong, backgroundColor: confirming ? colors.danger : colors.bgCard }]}
                    onPress={() => {
                      if (confirming) { onDeleteStore(s); setPendingDelete(null); }
                      else setPendingDelete(s.id);
                    }}
                  >
                    <Text style={[styles.delTxt, { color: confirming ? colors.stampText : colors.textMuted }]}>
                      {confirming ? 'REMOVE?' : '✕'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.addRow, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
            <TextInput
              style={[styles.addInput, { color: colors.textPrimary }, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
              placeholder="New store…"
              placeholderTextColor={colors.textMuted}
              value={newStore}
              onChangeText={setNewStore}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.ink, opacity: creating || !newStore.trim() ? 0.5 : 1 }]}
              onPress={handleCreate}
              disabled={creating || !newStore.trim()}
            >
              {creating
                ? <ActivityIndicator color={colors.stampText} size="small" />
                : <Text style={[styles.addBtnTxt, { color: colors.stampText }]}>+</Text>}
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.closeRow} hitSlop={8}>
            <Text style={[styles.closeTxt, { color: colors.textMuted }]}>CLOSE</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,12,4,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, borderRadius: radius.xl, borderWidth: 2, padding: spacing.lg },
  title: { fontFamily: type.monoBold, fontSize: 15, letterSpacing: 3, textAlign: 'center' },
  sub: { fontFamily: type.mono, fontSize: 9, letterSpacing: 2, textAlign: 'center', marginTop: 5 },
  list: { maxHeight: 260, marginTop: spacing.md },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  row: { paddingVertical: 11, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, marginBottom: spacing.sm },
  rowFlex: { flex: 1, marginBottom: 0 },
  rowTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  delBtn: { minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  delTxt: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden' },
  addInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: type.mono, fontSize: 13 },
  addBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { fontSize: 20, lineHeight: 24, fontFamily: type.mono },
  closeRow: { alignItems: 'center', marginTop: spacing.md, paddingVertical: 6 },
  closeTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2 },
});
