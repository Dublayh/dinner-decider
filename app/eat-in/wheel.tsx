import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import DraggableSheet from '@/components/DraggableSheet';
import { useEatInStore, useMealPlanSpinStore } from '@/store/wheelStore';
import SpinWheel from '@/components/SpinWheelUniversal';
import { addCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import { setMealPlanEntry } from '@/lib/mealPlan';
import { EFFORT_SHORT, type Recipe, type WheelItem } from '@/types';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';

const CONFETTI = [
  { angle: 0,   color: '#B4551F', dist: 80 },
  { angle: 45,  color: '#6F7D46', dist: 90 },
  { angle: 90,  color: '#C9962E', dist: 74 },
  { angle: 135, color: '#9C3D2E', dist: 86 },
  { angle: 180, color: '#4E6379', dist: 80 },
  { angle: 225, color: '#C07248', dist: 92 },
  { angle: 270, color: '#B4551F', dist: 74 },
  { angle: 315, color: '#587D63', dist: 86 },
];

function ConfettiDot({ angle, color, dist, trigger }: {
  angle: number; color: string; dist: number; trigger: number;
}) {
  const progress = useSharedValue(0);
  const rad = (angle * Math.PI) / 180;
  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [trigger]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: Math.cos(rad) * dist * p },
        { translateY: Math.sin(rad) * dist * p },
        { scale: p < 0.25 ? p / 0.25 : 1 },
      ],
      opacity: p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1,
    };
  });
  return <Animated.View style={[styles.confettiDot, { backgroundColor: color }, style]} />;
}

export default function EatInWheel() {
  const { showToast, toast } = useAppAlert();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { pendingDate, setPendingDate } = useMealPlanSpinStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { wheelItems, addWheelItem, removeWheelItem, winner, setWinner } = useEatInStore();

  const [query, setQuery] = useState('');
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);

  const sheetPeek = Math.max(56, height * 0.08);

  const winnerOpacity = useSharedValue(0);
  const winnerY = useSharedValue(30);
  const winnerScale = useSharedValue(0.92);

  useEffect(() => {
    if (winner) {
      winnerOpacity.value = withDelay(80, withTiming(1, { duration: 250 }));
      winnerY.value = withDelay(80, withSpring(0, { damping: 14, stiffness: 140 }));
      winnerScale.value = withDelay(80, withSequence(
        withSpring(1.05, { damping: 7, stiffness: 280 }),
        withSpring(1,    { damping: 14, stiffness: 200 }),
      ));
      setCelebrateTrigger(t => t + 1);

      // If we came from meal plan, auto-assign after showing the winner
      if (pendingDate) {
        const dateToSave = pendingDate;
        // Save immediately so calendar is up to date
        setMealPlanEntry(dateToSave, {
          type: 'recipe',
          recipe_id: winner.id,
          recipe_name: winner.name,
        }).catch(() => {});
        // Short delay so user can see the winner, then pop back
        setTimeout(() => {
          setPendingDate(null);
          setWinner(null);
          router.dismiss(2);
        }, 1200);
      }
    } else {
      winnerOpacity.value = withTiming(0, { duration: 120 });
      winnerY.value = withTiming(30, { duration: 120 });
      winnerScale.value = withTiming(0.92, { duration: 120 });
    }
  }, [winner]);

  const winnerAnimStyle = useAnimatedStyle(() => ({
    opacity: winnerOpacity.value,
    transform: [{ translateY: winnerY.value }, { scale: winnerScale.value }],
  }));

  async function ensureRecipesLoaded() {
    if (recipesLoaded) return;
    try { const data = await getCustomRecipes(); setAllRecipes(data); setRecipesLoaded(true); } catch {}
  }

  const onWheelIds = useMemo(() => new Set(wheelItems.map(w => w.id)), [wheelItems]);
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allRecipes.filter(r => !onWheelIds.has(r.id) && r.name.toLowerCase().includes(q));
  }, [query, allRecipes, onWheelIds]);
  const noMatches = query.trim().length > 0 && suggestions.length === 0;

  function handleAddFromSuggestion(recipe: Recipe) {
    addWheelItem({ id: recipe.id, label: recipe.name, data: recipe });
    setQuery('');
  }

  async function handleAddCustom() {
    const name = query.trim();
    if (!name) return;
    try {
      const saved = await addCustomRecipe({ name, cuisine: 'Custom', effort: 'medium', readyInMinutes: 0, servings: 2, ingredients: [], steps: [] });
      addWheelItem({ id: saved.id, label: saved.name, data: saved });
      setQuery('');
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function handleRemove(item: WheelItem<Recipe>) {
    removeWheelItem(item.id);
  }

  function handleBack() {
    setWinner(null);
    router.back();
  }

  const wheelSize = Math.min(300, width - 48);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.ink },
              pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
            ]}
          >
            <Text style={[styles.iconBtnTxt, { color: colors.textPrimary }]}>←</Text>
          </Pressable>
          <Text style={[styles.heading, { color: colors.textMuted }]}>
            {wheelItems.length} {wheelItems.length === 1 ? 'RECIPE' : 'RECIPES'} ON THE WHEEL
          </Text>
          <View style={styles.iconBtnSpacer} />
        </View>

        <View style={[styles.mainContent, { paddingBottom: sheetPeek + 30 }]}>
          <View>
            <SpinWheel items={wheelItems} onSpinEnd={(item) => setWinner(item.data)} size={wheelSize} />
          </View>

          <Animated.View style={[styles.winnerOuter, winnerAnimStyle]}>
            {winner && (
              <Pressable
                style={[styles.resultCard, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 4)]}
                onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: winner.id } })}
              >
                <View style={styles.confettiOrigin} pointerEvents="none">
                  {CONFETTI.map((c, i) => <ConfettiDot key={i} {...c} trigger={celebrateTrigger} />)}
                </View>
                <Text style={[styles.resultKicker, { color: colors.primary }]}>★ TONIGHT'S PICK ★</Text>
                <Text style={[styles.resultName, { color: colors.textPrimary }]}>{winner.name}</Text>
                <Text style={[styles.resultSub, { color: colors.textMuted }]}>
                  {winner.cuisine.toUpperCase()}{winner.readyInMinutes > 0 ? ` · ${winner.readyInMinutes} MIN` : ''}
                </Text>
                <Text style={[styles.resultHint, { color: colors.textSecondary }]}>📖 Tap to view the full recipe</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>

      <DraggableSheet
        peek={sheetPeek}
        expandedFraction={0.75}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
      >
          <TextInput
            style={[styles.input, {
              borderColor: colors.borderStrong,
              backgroundColor: isDark ? colors.bgMuted : colors.bg,
              color: colors.textPrimary,
            }]}
            placeholder="Add a recipe to the wheel…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={ensureRecipesLoaded}
            returnKeyType="done"
          />

          {suggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.bg, borderColor: colors.ink }]}>
              {suggestions.map(r => (
                <Pressable key={r.id} style={[styles.suggestionRow, { borderBottomColor: colors.line }]} onPress={() => handleAddFromSuggestion(r)}>
                  <View style={styles.suggestionInfo}>
                    <Text style={[styles.suggestionName, { color: colors.textPrimary }]}>{r.name}</Text>
                    <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>
                      {`${r.cuisine} · ${EFFORT_SHORT[r.effort]}`.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.suggestionAdd, { color: colors.primary }]}>+ ADD</Text>
                </Pressable>
              ))}
            </View>
          )}

          {noMatches && (
            <Pressable style={[styles.addCustomRow, { borderColor: colors.borderStrong }]} onPress={handleAddCustom}>
              <Text style={[styles.addCustomTxt, { color: colors.textSecondary }]}>
                Add "<Text style={[styles.addCustomBold, { color: colors.textPrimary }]}>{query.trim()}</Text>" as a custom entry
              </Text>
            </Pressable>
          )}

          <Text style={[styles.sheetLabel, { color: colors.sectionLabel }]}>ON THE WHEEL</Text>
          {wheelItems.length === 0 && (
            <Text style={[styles.emptyTxt, { color: colors.textMuted }]}>No recipes yet — add some above.</Text>
          )}
          {wheelItems.map(item => (
            <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.line }]}>
              <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.label}</Text>
              <Pressable onPress={() => handleRemove(item)} hitSlop={12}>
                <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>
          ))}
      </DraggableSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { fontSize: 18, lineHeight: 21 },
  iconBtnSpacer: { width: 38 },
  heading: { flex: 1, fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  winnerOuter: { width: '100%', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  resultCard: { borderRadius: radius.lg, borderWidth: 2, padding: spacing.lg, alignItems: 'center', gap: 4, overflow: 'visible' },
  resultKicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: 4 },
  resultName: { fontFamily: type.serifBold, fontSize: 26, textAlign: 'center' },
  resultSub: { fontFamily: type.mono, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  resultHint: { fontFamily: type.serifItalic, fontSize: font.sm, marginTop: 8 },
  confettiOrigin: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  confettiDot: { position: 'absolute', width: 8, height: 8, borderRadius: 1 },
  sheetContent: { paddingHorizontal: spacing.lg },
  sheetLabel: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyTxt: { fontFamily: type.serifItalic, fontSize: font.sm },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontFamily: type.mono, fontSize: 13, marginBottom: spacing.sm },
  suggestions: { borderWidth: 1.5, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontFamily: type.serifSemi, fontSize: font.md },
  suggestionMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  suggestionAdd: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1 },
  addCustomRow: { borderRadius: radius.md, padding: 12, marginBottom: spacing.sm, borderWidth: 1.5, borderStyle: 'dashed' },
  addCustomTxt: { fontFamily: type.serifItalic, fontSize: font.sm },
  addCustomBold: { fontFamily: type.serifSemiItalic },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  itemName: { fontFamily: type.serif, fontSize: font.md, flex: 1 },
  removeX: { fontSize: 16, paddingLeft: 12 },
});
