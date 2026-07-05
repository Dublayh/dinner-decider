import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, PanResponder, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '@/components/BottomSheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { getCustomRecipeById } from '@/lib/customRecipes';
import { parseAmount, formatAmount } from '@/lib/amountUtils';
import type { Recipe, Ingredient } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow } from '@/constants/theme';

const ALARM = require('../../assets/sounds/timer-done.wav');

interface FlatStep { sectionName?: string; text: string }
interface Timer { id: number; label: string; total: number; remaining: number; done: boolean }
interface Duration { label: string; seconds: number }

function scaled(amount: string, scale: number): string {
  if (scale === 1) return amount;
  const p = parseAmount(amount);
  if (p === null) return amount;
  return formatAmount(p * scale);
}

function clock(s: number): string {
  const total = Math.max(0, Math.round(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Pull cook-able durations ("20 minutes", "1 hr", "45 sec") out of a step's text.
function parseDurations(text: string): Duration[] {
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;
  const out: Duration[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    let seconds: number, u: string;
    if (unit.startsWith('h')) { seconds = num * 3600; u = 'hr'; }
    else if (unit.startsWith('m')) { seconds = num * 60; u = 'min'; }
    else { seconds = num; u = 'sec'; }
    seconds = Math.round(seconds);
    if (seconds <= 0 || seen.has(seconds)) continue;
    seen.add(seconds);
    out.push({ label: `${m[1]} ${u}`, seconds });
  }
  return out;
}

export default function CookMode() {
  useKeepAwake(); // screen stays on while cooking (native + web wake lock)
  const router = useRouter();
  const { colors } = useTheme();
  const { id, scale: scaleParam } = useLocalSearchParams<{ id: string; scale?: string }>();
  const scale = Math.min(3, Math.max(1, parseInt(scaleParam ?? '1') || 1));

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<Timer[]>([]);
  const timerId = useRef(0);

  const player = useAudioPlayer(ALARM);

  useEffect(() => {
    if (!id) return;
    getCustomRecipeById(id).then(setRecipe).finally(() => setLoading(false));
  }, [id]);

  const steps: FlatStep[] = useMemo(() => {
    if (!recipe) return [];
    const secs = recipe.sections ?? [];
    if (secs.length > 0) {
      return secs.flatMap(sec => sec.steps.map(st => ({ sectionName: sec.name, text: st.step })));
    }
    return recipe.steps.map(st => ({ text: st.step }));
  }, [recipe]);

  const allIngredients: { sectionName?: string; items: Ingredient[] }[] = useMemo(() => {
    if (!recipe) return [];
    const secs = recipe.sections ?? [];
    if (secs.length > 0) return secs.map(sec => ({ sectionName: sec.name, items: sec.ingredients }));
    return [{ items: recipe.ingredients }];
  }, [recipe]);

  // ── Timers ─────────────────────────────────────────────────────────────────
  function fireAlarm() {
    // seekTo is async — play once it resolves so repeat alarms restart from 0
    try { Promise.resolve(player.seekTo(0)).then(() => player.play()).catch(() => player.play()); } catch {}
    if (Platform.OS !== 'web') {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    }
  }

  function startTimer(d: Duration) {
    if (Platform.OS !== 'web') {
      try { Haptics.selectionAsync(); } catch {}
    }
    setTimers(prev => [...prev, { id: ++timerId.current, label: d.label, total: d.seconds, remaining: d.seconds, done: false }]);
  }

  function dismissTimer(tid: number) {
    setTimers(prev => prev.filter(t => t.id !== tid));
  }

  useEffect(() => {
    const iv = setInterval(() => {
      setTimers(prev => {
        if (!prev.some(t => !t.done)) return prev;
        let fired = false;
        const next = prev.map(t => {
          if (t.done) return t;
          const r = t.remaining - 1;
          if (r <= 0) { fired = true; return { ...t, remaining: 0, done: true }; }
          return { ...t, remaining: r };
        });
        if (fired) setTimeout(fireAlarm, 0); // defer side effect out of the updater
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = () => setIdx(i => Math.min(steps.length - 1, i + 1));
  const goPrev = () => setIdx(i => Math.max(0, i - 1));
  const navRef = useRef({ next: goNext, prev: goPrev });
  navRef.current = { next: goNext, prev: goPrev };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 26 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -44) navRef.current.next();
        else if (g.dx > 44) navRef.current.prev();
      },
    })
  ).current;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!recipe || steps.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink, margin: spacing.lg }, hardShadow(colors.shadow, 2)]}>
          <Text style={[styles.iconBtnTxt, { color: colors.textPrimary }]}>←</Text>
        </Pressable>
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {recipe ? 'This recipe has no steps to cook.' : 'Recipe not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  const step = steps[idx];
  const durations = parseDurations(step.text);
  const isLast = idx === steps.length - 1;
  const progress = (idx + 1) / steps.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
          <Text style={[styles.iconBtnTxt, { color: colors.textPrimary }]}>✕</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={[styles.topTitle, { color: colors.textMuted }]} numberOfLines={1}>{recipe.name.toUpperCase()}</Text>
          <Text style={[styles.topStep, { color: colors.textPrimary }]}>STEP {idx + 1} / {steps.length}</Text>
        </View>
        <Pressable onPress={() => setShowIngredients(true)} style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
          <Text style={{ fontSize: 16 }}>🧺</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.bgMuted, borderColor: colors.borderStrong }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
      </View>

      {/* Active timers tray */}
      {timers.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trayWrap} contentContainerStyle={styles.tray}>
          {timers.map(t => (
            <Pressable
              key={t.id}
              onPress={() => dismissTimer(t.id)}
              style={[styles.timerChip, t.done
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.bgCard, borderColor: colors.ink }]}
            >
              <Text style={[styles.timerChipClock, { color: t.done ? colors.stampText : colors.textPrimary }]}>
                {t.done ? '⏰ DONE' : clock(t.remaining)}
              </Text>
              <Text style={[styles.timerChipLabel, { color: t.done ? colors.stampText : colors.textMuted }]}>
                {t.label.toUpperCase()} · ✕
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Step */}
      <View style={styles.stepArea} {...pan.panHandlers}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          {step.sectionName ? (
            <Text style={[styles.sectionName, { color: colors.primary }]}>{step.sectionName.toUpperCase()}</Text>
          ) : null}
          <View style={[styles.stepNumStamp, { borderColor: colors.ink }]}>
            <Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{idx + 1}</Text>
          </View>
          <Text style={[styles.stepText, { color: colors.textPrimary }]}>{step.text}</Text>

          {durations.length > 0 && (
            <View style={styles.durRow}>
              {durations.map((d, i) => (
                <Pressable
                  key={i}
                  onPress={() => startTimer(d)}
                  style={[styles.durChip, { borderColor: colors.ink, backgroundColor: colors.bgCard }, hardShadow(colors.shadow, 2)]}
                >
                  <Text style={[styles.durChipTxt, { color: colors.textPrimary }]}>⏱ START {d.label.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <Pressable
          onPress={goPrev}
          disabled={idx === 0}
          style={[styles.navBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink, opacity: idx === 0 ? 0.4 : 1 }, hardShadow(colors.shadow, 2)]}
        >
          <Text style={[styles.navBtnTxt, { color: colors.textPrimary }]}>← PREV</Text>
        </Pressable>
        {isLast ? (
          <Pressable onPress={() => router.back()} style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: colors.accent, borderColor: colors.ink }, hardShadow(colors.shadow, 3)]}>
            <Text style={[styles.navBtnTxt, { color: '#FFF6E8' }]}>✓ DONE</Text>
          </Pressable>
        ) : (
          <Pressable onPress={goNext} style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: colors.primary, borderColor: colors.ink }, hardShadow(colors.shadow, 3)]}>
            <Text style={[styles.navBtnTxt, { color: '#FFF6E8' }]}>NEXT →</Text>
          </Pressable>
        )}
      </View>

      {/* Ingredient peek drawer */}
      <BottomSheet visible={showIngredients} onClose={() => setShowIngredients(false)}>
        <View style={styles.drawerHead}>
          <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>INGREDIENTS</Text>
          {scale > 1 && <Text style={[styles.drawerScale, { color: colors.primary }]}>{scale}× BATCH</Text>}
        </View>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {allIngredients.map((grp, gi) => (
            <View key={gi} style={{ marginBottom: spacing.sm }}>
              {grp.sectionName ? (
                <Text style={[styles.drawerSection, { color: colors.textMuted }]}>{grp.sectionName.toUpperCase()}</Text>
              ) : null}
              {grp.items.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted, textAlign: 'left', marginTop: 0 }]}>None listed.</Text>
              ) : grp.items.map((ing, ii) => (
                <View key={ii} style={[styles.ingRow, { borderBottomColor: colors.line }]}>
                  <Text style={[styles.ingAmt, { color: colors.textMuted }]}>
                    {scaled(ing.amount, scale)}{ing.unit ? ` ${ing.unit}` : ''}
                  </Text>
                  <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={() => setShowIngredients(false)} style={[styles.drawerClose, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
          <Text style={[styles.drawerCloseTxt, { color: colors.textPrimary }]}>CLOSE</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, lineHeight: 21 },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { fontFamily: type.mono, fontSize: 9, letterSpacing: 2 },
  topStep: { fontFamily: type.monoBold, fontSize: 13, letterSpacing: 2, marginTop: 3 },
  progressTrack: { height: 6, marginHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  trayWrap: { flexGrow: 0, marginTop: spacing.md },
  tray: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  timerChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', minWidth: 92 },
  timerChipClock: { fontFamily: type.monoBold, fontSize: 17, letterSpacing: 1 },
  timerChipLabel: { fontFamily: type.mono, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  stepArea: { flex: 1 },
  stepScroll: { padding: spacing.lg, paddingTop: spacing.lg, flexGrow: 1 },
  sectionName: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 3, marginBottom: spacing.md },
  stepNumStamp: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  stepNumTxt: { fontFamily: type.serifBlack, fontSize: 24 },
  stepText: { fontFamily: type.serif, fontSize: 25, lineHeight: 38 },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  durChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5 },
  durChipTxt: { fontFamily: type.monoBold, fontSize: 12, letterSpacing: 1 },
  bottomNav: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  navBtn: { flex: 1, paddingVertical: 16, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  navBtnPrimary: { flex: 1.6 },
  navBtnTxt: { fontFamily: type.monoBold, fontSize: 14, letterSpacing: 2 },
  empty: { fontFamily: type.serifItalic, fontSize: font.md, textAlign: 'center', marginTop: 40 },
  drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  drawerTitle: { fontFamily: type.monoBold, fontSize: 14, letterSpacing: 3 },
  drawerScale: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5 },
  drawerSection: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5, marginBottom: 6, marginTop: 4 },
  ingRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, gap: 12 },
  ingAmt: { fontFamily: type.mono, fontSize: 12, lineHeight: 19, minWidth: 96 },
  ingName: { fontFamily: type.serif, fontSize: font.md, lineHeight: 20, flex: 1 },
  drawerClose: { marginTop: spacing.md, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  drawerCloseTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 2 },
});
