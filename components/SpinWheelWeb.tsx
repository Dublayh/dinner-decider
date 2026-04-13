import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useSharedValue, withTiming, Easing, runOnJS, useDerivedValue } from 'react-native-reanimated';
import type { WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { wheelColors } from '@/constants/theme';

interface Props<T> {
  items: WheelItem<T>[];
  onSpinEnd: (item: WheelItem<T>) => void;
  size?: number;
}

export default function SpinWheelWeb<T>({ items, onSpinEnd, size = 300 }: Props<T>) {
  const { colors } = useTheme();
  const canvasRef = useRef<any>(null);
  const rotation = useSharedValue(0);
  const isSpinning = useRef(false);
  const rotationRef = useRef(0);

  function drawWheel(angle: number) {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    const ctx = canvas.getContext('2d');
    const R = size / 2;
    ctx.clearRect(0, 0, size, size);

    if (items.length === 1) {
      ctx.beginPath();
      ctx.arc(R, R, R, 0, Math.PI * 2);
      ctx.fillStyle = wheelColors[0];
      ctx.fill();
    } else {
      const slice = (Math.PI * 2) / items.length;
      items.forEach((item, i) => {
        const start = angle + i * slice - Math.PI / 2;
        const end = start + slice;
        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, R, start, end);
        ctx.closePath();
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        ctx.fill();

        // Label
        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = `bold 11px sans-serif`;
        const label = item.label.length > 13 ? item.label.slice(0, 12) + '…' : item.label;
        ctx.fillText(label, R - 10, 4);
        ctx.restore();
      });
    }

    // Center cap
    ctx.beginPath();
    ctx.arc(R, R, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
  }

  useEffect(() => {
    drawWheel(0);
  }, [items, size]);

  const handleSpinEnd = useCallback((finalRad: number) => {
    isSpinning.current = false;
    if (!items.length) return;
    const slice = (Math.PI * 2) / items.length;
    const normalised = ((finalRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const adjusted = (Math.PI * 2 - normalised) % (Math.PI * 2);
    const idx = Math.floor(adjusted / slice) % items.length;
    onSpinEnd(items[idx]);
  }, [items, onSpinEnd]);

  const spin = useCallback(() => {
    if (isSpinning.current || !items.length) return;
    isSpinning.current = true;
    const target = rotation.value + (6 + Math.random() * 4) * Math.PI * 2 + Math.random() * Math.PI * 2;

    // Animate via requestAnimationFrame on web
    const startVal = rotation.value;
    const startTime = Date.now();
    const duration = 4000;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (target - startVal) * eased;
      rotationRef.current = current;
      drawWheel(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        rotation.value = target;
        handleSpinEnd(target);
      }
    }
    requestAnimationFrame(animate);
  }, [items, rotation, handleSpinEnd]);

  if (!items.length) return (
    <View style={[styles.empty, { width: size, height: size, backgroundColor: colors.bgMuted }]}>
      <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No items yet</Text>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pointer, { left: size / 2 - 12, borderTopColor: colors.primary }]} />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ borderRadius: size / 2 }}
      />
      <Pressable
        style={[styles.spinBtn, { width: size * 0.6, backgroundColor: colors.primary }]}
        onPress={spin}
      >
        <Text style={styles.spinBtnTxt}>Spin!</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginVertical: 8 },
  pointer: {
    position: 'absolute', top: -10, zIndex: 10,
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  empty: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  emptyTxt: { fontSize: 14 },
  spinBtn: { marginTop: 20, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  spinBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
