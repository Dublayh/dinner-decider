import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, Alert, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

// ── Toast ─────────────────────────────────────────────────────────────────────
export interface ToastAction { label: string; onPress: () => void }

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  visible: boolean;
  action?: ToastAction;
}

export function AppToast({ message, type, visible, action }: ToastProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: visible ? 0 : 20, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible && !message) return null;

  const bg = type === 'error' ? colors.danger : type === 'success' ? colors.primary : colors.textSecondary;

  return (
    // box-none so the toast body still lets touches pass through (as before),
    // but the action button can receive taps when present.
    <Animated.View
      pointerEvents={action ? 'box-none' : 'none'}
      style={[styles.toastBox, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}
    >
      <Text style={[styles.toastTxt, action ? styles.toastTxtWithAction : null]}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} style={styles.toastAction}>
          <Text style={styles.toastActionTxt}>{action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
interface ConfirmProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AppConfirmDialog({ visible, title, message, confirmLabel = 'Confirm', confirmDestructive = false, onConfirm, onCancel }: ConfirmProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.dialogMsg, { color: colors.textSecondary }]}>{message}</Text> : null}
          <View style={styles.dialogBtns}>
            <Pressable
              style={[styles.dialogBtn, { borderColor: colors.border, backgroundColor: colors.bgMuted, borderWidth: 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.dialogBtnTxt, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, { backgroundColor: confirmDestructive ? colors.danger : colors.primary }]}
              onPress={onConfirm}
            >
              <Text style={[styles.dialogBtnTxt, { color: '#fff' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
interface ToastState { msg: string; type: 'error' | 'success' | 'info'; action?: ToastAction }
interface ConfirmState { title: string; message?: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void }

export function useAppAlert() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastTimer = useRef<any>(null);

  function showToast(msg: string, type: 'error' | 'success' | 'info' = 'info', action?: ToastAction) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Wrap the action so tapping it also dismisses the toast immediately.
    const wrapped: ToastAction | undefined = action
      ? { label: action.label, onPress: () => { setToast(null); action.onPress(); } }
      : undefined;
    setToast({ msg, type, action: wrapped });
    // Give a little longer to react when there's an undo affordance.
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3500);
  }

  function showConfirm(title: string, message?: string, onConfirmCb?: () => void, opts?: { label?: string; destructive?: boolean }) {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: opts?.label ?? 'Confirm', style: opts?.destructive ? 'destructive' : 'default', onPress: onConfirmCb },
      ]);
    } else {
      setConfirm({
        title, message,
        confirmLabel: opts?.label,
        destructive: opts?.destructive,
        onConfirm: () => { setConfirm(null); onConfirmCb?.(); },
      });
    }
  }

  // Return state so screens can render components themselves (avoids hook-defined component remount issues)
  return { showToast, showConfirm, toast, confirm, dismissConfirm: () => setConfirm(null) };
}

const styles = StyleSheet.create({
  toastBox: { position: 'absolute', bottom: 48, left: 24, right: 24, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, zIndex: 9999 },
  toastTxt: { color: '#fff', fontSize: font.sm, fontWeight: '600', textAlign: 'center' },
  toastTxtWithAction: { flexShrink: 1, textAlign: 'left' },
  toastAction: { marginLeft: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.25)' },
  toastActionTxt: { color: '#fff', fontSize: font.sm, fontWeight: '800' },
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialogBox: { width: '100%', maxWidth: 340, borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  dialogTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  dialogMsg: { fontSize: font.sm, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  dialogBtns: { flexDirection: 'row', gap: spacing.sm },
  dialogBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center' },
  dialogBtnTxt: { fontSize: font.sm, fontWeight: '700' },
});
