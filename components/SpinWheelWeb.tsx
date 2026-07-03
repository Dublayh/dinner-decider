import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useSharedValue, withTiming, Easing, runOnJS, useDerivedValue } from 'react-native-reanimated';
import type { WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { wheelColors, radius as themeRadius, type, hardShadow, pressedShadow } from '@/constants/theme';

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
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const R = size / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

        // Label — cream mono, like painted lettering on a fairground wheel
        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#F7EFDD';
        ctx.font = `10px "SpaceMono_700Bold", monospace`;
        const label = item.label.length > 13 ? item.label.slice(0, 12) + '…' : item.label;
        ctx.fillText(label, R - 12, 4);
        ctx.restore();
      });
    }

    // Ink rim
    ctx.beginPath();
    ctx.arc(R, R, R - 1.5, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.ink;
    ctx.stroke();

    // Center cap — paper with ink ring
    ctx.beginPath();
    ctx.arc(R, R, 22, 0, Math.PI * 2);
    ctx.fillStyle = colors.bgCard;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.ink;
    ctx.stroke();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    drawWheel(rotationRef.current);
  }, [items, size, colors]);

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
    <View style={[styles.empty, { width: size, height: size, backgroundColor: colors.bgMuted, borderColor: colors.borderStrong }]}>
      <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>Nothing on the wheel yet</Text>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pointer, { left: size / 2 - 12, borderTopColor: colors.ink }]} />
      <canvas
        ref={canvasRef}
        width={size * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
        height={size * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
      <Pressable
        style={({ pressed }) => [
          styles.spinBtn,
          { width: size * 0.6, backgroundColor: colors.primary, borderColor: colors.ink },
          pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
        ]}
        onPress={spin}
      >
        <Text style={styles.spinBtnTxt}>SPIN THE WHEEL</Text>
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
  empty: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
  emptyTxt: { fontFamily: type.serifItalic, fontSize: 14 },
  spinBtn: { marginTop: 22, borderRadius: themeRadius.md, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center' },
  spinBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 13, letterSpacing: 2.5 },
});
