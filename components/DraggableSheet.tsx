import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, PanResponder, StyleSheet,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { radius } from '@/constants/theme';

interface Props {
  /** Pixels of sheet visible when collapsed (handle strip). */
  peek: number;
  /** Share of window height when expanded. */
  expandedFraction?: number;
  children: React.ReactNode;
  contentContainerStyle?: any;
}

/**
 * Persistent two-position bottom sheet in the House Menu style.
 * Drag the handle strip to expand/collapse (or tap it to toggle) — same
 * gesture language as the shopping-list receipt. Replaces @gorhom/bottom-sheet
 * on the wheel screens, whose drag was unreliable on web.
 */
export default function DraggableSheet({ peek, expandedFraction = 0.75, children, contentContainerStyle }: Props) {
  const { colors } = useTheme();
  const { height: winH } = useWindowDimensions();

  const sheetH = Math.round(winH * expandedFraction);
  const collapsedY = sheetH - peek;

  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const y = useRef(new Animated.Value(collapsedY)).current;
  const collapsedYRef = useRef(collapsedY);
  collapsedYRef.current = collapsedY;

  // Re-seat the sheet if the viewport changes while collapsed (keyboard, rotation)
  useEffect(() => {
    if (!expandedRef.current) y.setValue(collapsedY);
  }, [collapsedY]);

  function snapTo(open: boolean) {
    expandedRef.current = open;
    setExpanded(open);
    Animated.spring(y, { toValue: open ? 0 : collapsedYRef.current, bounciness: 4, useNativeDriver: true }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const base = expandedRef.current ? 0 : collapsedYRef.current;
        y.setValue(Math.min(Math.max(base + g.dy, 0), collapsedYRef.current));
      },
      onPanResponderRelease: (_, g) => {
        // A tap (no real movement) toggles between the two positions
        if (Math.abs(g.dy) < 6 && Math.abs(g.vy) < 0.1) { snapTo(!expandedRef.current); return; }
        if (g.vy > 0.5) { snapTo(false); return; }
        if (g.vy < -0.5) { snapTo(true); return; }
        const pos = (expandedRef.current ? 0 : collapsedYRef.current) + g.dy;
        snapTo(pos < collapsedYRef.current / 2);
      },
      onPanResponderTerminate: () => snapTo(expandedRef.current),
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: sheetH, backgroundColor: colors.bgCard, borderColor: colors.ink, transform: [{ translateY: y }] },
      ]}
    >
      <View {...pan.panHandlers} style={styles.dragZone}>
        <View style={[styles.handle, { backgroundColor: colors.ink }]} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={expanded}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2,
    overflow: 'hidden',
  },
  dragZone: { paddingTop: 14, paddingBottom: 12, alignItems: 'center' },
  handle: { width: 44, height: 3 },
  scroll: { flex: 1 },
});
