import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Rect, Circle, LinearGradient, RadialGradient, vec } from '@shopify/react-native-skia';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Hero glow — soft radial, tuned per theme ─────────────────────────────────
function HeroGlow({ width, isDark }: { width: number; isDark: boolean }) {
  const cx = width / 2;
  const r = width * 0.78;

  const colors = isDark
    ? ['rgba(212,130,48,0.30)', 'rgba(212,130,48,0.16)', 'rgba(212,130,48,0.06)', 'rgba(212,130,48,0.00)']
    : ['rgba(193,122,60,0.13)', 'rgba(193,122,60,0.07)', 'rgba(193,122,60,0.02)', 'rgba(193,122,60,0.00)'];

  return (
    <Canvas
      style={{ position: 'absolute', top: -60, left: 0, width, height: width * 1.1 }}
      pointerEvents="none"
    >
      <Circle cx={cx} cy={0} r={r}>
        <RadialGradient
          c={vec(cx, 0)}
          r={r}
          colors={colors}
          positions={[0, 0.35, 0.65, 1]}
        />
      </Circle>
    </Canvas>
  );
}

// ── Card with Skia gradient background ───────────────────────────────────────
interface GradCardProps {
  gradColors: readonly [string, string, string];
  glowColor: string;
  onPress: () => void;
  children: React.ReactNode;
  borderColor?: string;
}

function GradCard({ gradColors, glowColor, onPress, children, borderColor }: GradCardProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cardOuter,
        { borderColor: borderColor ?? 'transparent' },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 && h > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={0} y={0} width={w} height={h}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(w, h)}
              colors={[gradColors[0], gradColors[1], gradColors[2]]}
              positions={[0, 0.55, 1]}
            />
          </Rect>
          <Circle cx={w * 1.05} cy={h / 2} r={h * 0.85}>
            <RadialGradient
              c={vec(w * 1.05, h / 2)}
              r={h * 0.85}
              colors={[glowColor, 'rgba(0,0,0,0)']}
              positions={[0, 1]}
            />
          </Circle>
        </Canvas>
      )}
      {children}
    </Pressable>
  );
}

// ── Card inner layout (shared) ────────────────────────────────────────────────
function CardInner({ emoji, title, sub, iconBg, iconBorder, titleColor, subColor, arrowColor }: {
  emoji: string; title: string; sub: string;
  iconBg: string; iconBorder: string;
  titleColor: string; subColor: string; arrowColor: string;
}) {
  return (
    <>
      <View style={[styles.iconBox, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Text style={styles.iconEmoji}>{emoji}</Text>
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.cardSub, { color: subColor }]}>{sub}</Text>
      </View>
      <Text style={[styles.cardArrow, { color: arrowColor }]}>›</Text>
    </>
  );
}

// ── Card configs ──────────────────────────────────────────────────────────────
const DARK = {
  eatOut:  { grad: ['#3D2410', '#2C1A0A', '#1A1005'] as const, glow: 'rgba(212,130,48,0.22)',   icon: { bg: 'rgba(212,130,48,0.18)', border: 'rgba(212,130,48,0.30)' } },
  eatIn:   { grad: ['#2B1F0C', '#1C1508', '#121005'] as const, glow: 'rgba(190,160,50,0.20)',   icon: { bg: 'rgba(180,150,60,0.18)', border: 'rgba(180,150,60,0.30)' } },
  recipe:  { grad: ['#141A22', '#0E1218', '#090E14'] as const, glow: 'rgba(100,140,210,0.20)',  icon: { bg: 'rgba(100,140,210,0.18)', border: 'rgba(100,140,210,0.28)' }, border: 'rgba(100,140,200,0.18)' },
};

const LIGHT = {
  eatOut:  { grad: ['#D4914F', '#C17A3C', '#AD6A2C'] as const, glow: 'rgba(255,210,160,0.30)', icon: { bg: 'rgba(255,255,255,0.28)', border: 'rgba(255,255,255,0.50)' } },
  eatIn:   { grad: ['#A06535', '#8A5228', '#764520'] as const, glow: 'rgba(210,170,120,0.25)', icon: { bg: 'rgba(255,255,255,0.22)', border: 'rgba(255,255,255,0.40)' } },
  recipe:  { grad: ['#FFFAF4', '#FFFFFF', '#FFF5EC'] as const, glow: 'rgba(193,122,60,0.07)',  icon: { bg: '#F5E6D3', border: '#E8DDD0' }, border: '#E8DDD0' },
};

// ── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const { width } = useWindowDimensions();
  const C = isDark ? DARK : LIGHT;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* Glow — both modes, different intensities */}
      <HeroGlow width={width} isDark={isDark} />

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={[styles.greetingLabel, { color: colors.heroLabel }]}>
            {getGreeting()} ✦
          </Text>
          <View style={styles.topBtns}>
            <Pressable
              onPress={() => router.push('/meal-plan')}
              style={[styles.themeBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
            </Pressable>
            <Pressable
              onPress={toggle}
              style={[styles.themeBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}
            >
              <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero */}
        <View style={[styles.hero, { borderBottomColor: colors.heroDivider }]}>
          <Text style={[styles.heroTitle, { color: colors.heroTitle }]}>
            Let's{'\n'}
            <Text style={[styles.heroTitleAccent, { color: colors.heroTitleAccent }]}>Eat.</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.heroSubtitle }]}>
            The eternal question, finally solved — together.
          </Text>
        </View>

        {/* Section label */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>
          What are we feeling?
        </Text>

        {/* Cards */}
        <View style={styles.cards}>

          <GradCard
            gradColors={C.eatOut.grad}
            glowColor={C.eatOut.glow}
            onPress={() => router.push('/eat-out/filters')}
          >
            <CardInner
              emoji="🍽️" title="Eat Out" sub="Find restaurants near you"
              iconBg={C.eatOut.icon.bg} iconBorder={C.eatOut.icon.border}
              titleColor={colors.cardText} subColor={colors.cardTextSub} arrowColor={colors.cardArrow}
            />
          </GradCard>

          <GradCard
            gradColors={C.eatIn.grad}
            glowColor={C.eatIn.glow}
            onPress={() => router.push('/eat-in/filters')}
          >
            <CardInner
              emoji="🎲" title="Eat In" sub="Spin the wheel for a recipe"
              iconBg={C.eatIn.icon.bg} iconBorder={C.eatIn.icon.border}
              titleColor={colors.cardText} subColor={colors.cardTextSub} arrowColor={colors.cardArrow}
            />
          </GradCard>

          <GradCard
            gradColors={C.recipe.grad}
            glowColor={C.recipe.glow}
            onPress={() => router.push('/recipes')}
            borderColor={C.recipe.border}
          >
            <CardInner
              emoji="📖" title="Recipe Book" sub="Your saved favourites"
              iconBg={C.recipe.icon.bg} iconBorder={C.recipe.icon.border}
              titleColor={isDark ? colors.cardRecipeText : colors.textPrimary}
              subColor={isDark ? colors.cardRecipeTextSub : colors.textSecondary}
              arrowColor={colors.cardRecipeArrow}
            />
          </GradCard>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  topBtns: { flexDirection: 'row', gap: spacing.sm },
  greetingLabel: { fontSize: font.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  themeBtn: { width: 38, height: 38, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { paddingTop: spacing.sm, paddingBottom: spacing.lg, borderBottomWidth: 1, marginBottom: spacing.lg },
  heroTitle: { fontSize: 52, fontWeight: '900', lineHeight: 54, letterSpacing: -1 },
  heroTitleAccent: { fontStyle: 'italic' },
  heroSubtitle: { marginTop: spacing.md, fontSize: font.sm, lineHeight: 20, maxWidth: 240 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: spacing.md, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  sectionLabel: { fontSize: font.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md },

  cards: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  cardOuter: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.xl, borderWidth: 1,
    flex: 1, overflow: 'hidden',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },

  iconBox: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  iconEmoji: { fontSize: 24 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: 3, letterSpacing: -0.3 },
  cardSub: { fontSize: font.sm, lineHeight: 18 },
  cardArrow: { fontSize: 22, fontWeight: '300', flexShrink: 0 },
});
