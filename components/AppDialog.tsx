import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, Alert, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow } from '@/constants/theme';

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

  // Paper slip with a coloured edge — not a floating coloured pill.
  const edge = type === 'error' ? colors.danger : type === 'success' ? colors.accent : colors.primary;

  return (
    // box-none so the toast body still lets touches pass through (as before),
    // but the action button can receive taps when present.
    <Animated.View
      pointerEvents={action ? 'box-none' : 'none'}
      style={[
        styles.toastBox,
        { backgroundColor: colors.bgCard, borderColor: colors.ink, opacity, transform: [{ translateY }] },
        hardShadow(colors.shadow, 3),
      ]}
    >
      <View style={[styles.toastEdge, { backgroundColor: edge }]} />
      <Text style={[styles.toastTxt, { color: colors.textPrimary }, action ? styles.toastTxtWithAction : null]}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} style={[styles.toastAction, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastActionTxt, { color: colors.stampText }]}>{action.label.toUpperCase()}</Text>
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
        <View style={[styles.dialogBox, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 6)]}>
          <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.dialogMsg, { color: colors.textSecondary }]}>{message}</Text> : null}
          <View style={styles.dialogBtns}>
            <Pressable
              style={[styles.dialogBtn, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}
              onPress={onCancel}
            >
              <Text style={[styles.dialogBtnTxt, { color: colors.textPrimary }]}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, {
                backgroundColor: confirmDestructive ? colors.danger : colors.ink,
                borderColor: confirmDestructive ? colors.danger : colors.ink,
              }]}
              onPress={onConfirm}
            >
              <Text style={[styles.dialogBtnTxt, { color: confirmDestructive ? '#FFF6E8' : colors.stampText }]}>
                {confirmLabel.toUpperCase()}
              </Text>
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
  toastBox: { position: 'absolute', bottom: 48, left: 24, right: 24, borderRadius: radius.md, borderWidth: 1.5, paddingVertical: 13, paddingLeft: 18, paddingRight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 9999 },
  toastEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  toastTxt: { fontFamily: type.mono, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  toastTxtWithAction: { flexShrink: 1, textAlign: 'left' },
  toastAction: { marginLeft: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm },
  toastActionTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1 },
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(20,12,4,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialogBox: { width: '100%', maxWidth: 340, borderRadius: radius.lg, borderWidth: 2, padding: spacing.lg + 4 },
  dialogTitle: { fontFamily: type.serifBold, fontSize: 21, marginBottom: spacing.sm, textAlign: 'center' },
  dialogMsg: { fontFamily: type.serif, fontSize: font.sm, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  dialogBtns: { flexDirection: 'row', gap: spacing.sm },
  dialogBtn: { flex: 1, borderRadius: radius.md, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center' },
  dialogBtnTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
});
