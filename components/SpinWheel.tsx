import React, { useRef, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import {
  Canvas, Path, Skia, Group, vec,
  Paragraph, TextAlign, listFontFamilies,
} from '@shopify/react-native-skia';
import {
  useSharedValue, useDerivedValue, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';
import type { WheelItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { wheelColors, radius as themeRadius, type, hardShadow, pressedShadow } from '@/constants/theme';

const FONT_SIZE = 11;
const LABEL_WIDTH = 100;

const systemFamilies = listFontFamilies();
const fontFamily = systemFamilies.find(f => f.toLowerCase().includes('roboto')) ?? systemFamilies[0] ?? 'sans-serif';

function makeParagraph(text: string) {
  const para = Skia.ParagraphBuilder.Make(
    { textAlign: TextAlign.Center },
    Skia.FontMgr.System(),
  ).pushStyle({
    color: Skia.Color('#F7EFDD'),
    fontSize: FONT_SIZE,
    fontFamilies: [fontFamily],
  }).addText(text).build();
  para.layout(LABEL_WIDTH);
  return para;
}

interface Props<T> {
  items: WheelItem<T>[];
  onSpinEnd: (item: WheelItem<T>) => void;
  size?: number;
}

export default function SpinWheel<T>({ items, onSpinEnd, size = 300 }: Props<T>) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const isSpinning = useRef(false);
  const R = size / 2;
  const wheelTransform = useDerivedValue(() => [{ rotate: rotation.value }]);

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
    rotation.value = withTiming(target, { duration: 4000, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(handleSpinEnd)(rotation.value);
    });
  }, [items, rotation, handleSpinEnd]);

  if (!items.length) return (
    <View style={[styles.empty, { width: size, height: size, backgroundColor: colors.bgMuted, borderColor: colors.borderStrong }]}>
      <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>Nothing on the wheel yet</Text>
    </View>
  );

  const sliceAngle = (Math.PI * 2) / items.length;

  const segments = items.map((item, i) => {
    const path = Skia.Path.Make();

    if (items.length === 1) {
      // Skia drops a 360° arc — use addCircle for single item
      path.addCircle(R, R, R);
    } else {
      const startAngle = i * sliceAngle - Math.PI / 2;
      path.moveTo(R, R);
      path.lineTo(R + R * Math.cos(startAngle), R + R * Math.sin(startAngle));
      path.arcToOval(
        { x: 0, y: 0, width: size, height: size },
        (startAngle * 180) / Math.PI,
        (sliceAngle * 180) / Math.PI,
        false,
      );
      path.close();
    }

    const startAngle = i * sliceAngle - Math.PI / 2;
    const midAngle = startAngle + sliceAngle / 2;
    const lx = R + R * 0.6 * Math.cos(midAngle);
    const ly = R + R * 0.6 * Math.sin(midAngle);
    const label = item.label.length > 13 ? item.label.slice(0, 12) + '…' : item.label;
    return { path, color: wheelColors[i % wheelColors.length], lx, ly, midAngle, para: makeParagraph(label) };
  });

  const capPath = Skia.Path.Make();
  capPath.addCircle(R, R, 22);

  const rimPath = Skia.Path.Make();
  rimPath.addCircle(R, R, R - 1.5);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pointer, { left: R - 12, borderTopColor: colors.ink }]} />
      <Canvas style={{ width: size, height: size }}>
        <Group transform={wheelTransform} origin={vec(R, R)}>
          {segments.map(({ path, color }, i) => <Path key={i} path={path} color={color} />)}
        </Group>
        <Group transform={wheelTransform} origin={vec(R, R)}>
          {segments.map(({ lx, ly, midAngle, para }, i) => (
            <Group key={`l-${i}`} origin={vec(lx, ly)} transform={[{ rotate: midAngle }]}>
              <Paragraph paragraph={para} x={lx - LABEL_WIDTH / 2} y={ly - FONT_SIZE / 2} width={LABEL_WIDTH} />
            </Group>
          ))}
        </Group>
        {/* Ink rim + paper centre cap */}
        <Path path={rimPath} color={colors.ink} style="stroke" strokeWidth={3} />
        <Path path={capPath} color={colors.bgCard} />
        <Path path={capPath} color={colors.ink} style="stroke" strokeWidth={2.5} />
      </Canvas>
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
