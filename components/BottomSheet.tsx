import { useEffect, useRef, useState } from 'react';
import {
  View, Pressable, StyleSheet, Modal, Animated, PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showHandle?: boolean;     // drag-to-dismiss handle at the top (default true)
  padded?: boolean;         // horizontal + bottom padding on the content (default true)
  topOffset?: number;       // px below the top inset the sheet may reach (default 48)
}

// Reusable bottom sheet. The overlay fades in place while the sheet slides up
// independently — so the dark backdrop never travels with the sheet (the bug you
// get from Modal's built-in animationType="slide").
export default function BottomSheet({
  visible, onClose, children, showHandle = true, padded = true, topOffset = 48,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();

  const [mounted, setMounted] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(winHeight)).current;

  // Latest values for the PanResponder (created once, closes over refs)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const winHeightRef = useRef(winHeight);
  winHeightRef.current = winHeight;

  const sheetMax = winHeight - insets.top - topOffset;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => { if (g.dy > 0) sheetY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) onCloseRef.current();
        else Animated.spring(sheetY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
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

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]} pointerEvents="box-none">
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.ink,
              maxHeight: sheetMax,
              paddingBottom: padded ? insets.bottom + spacing.md : 0,
              paddingHorizontal: padded ? spacing.lg : 0,
            },
          ]}
        >
          {showHandle && (
            <View {...panResponder.panHandlers} style={styles.dragZone}>
              <View style={[styles.handle, { backgroundColor: colors.ink }]} />
            </View>
          )}
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,4,0.55)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  content: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, overflow: 'hidden',
    paddingTop: spacing.sm,
  },
  dragZone: { alignItems: 'center', paddingVertical: 6, marginTop: -6, marginBottom: 4 },
  handle: { width: 44, height: 3 },
});
