import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEatInStore } from '@/store/wheelStore';
import { getCustomRecipes } from '@/lib/customRecipes';
import { WHEEL_CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type WheelItem, type Recipe } from '@/types';
import { useAppAlert, AppToast } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';

const EFFORT_META: Record<EffortLevel, { emoji: string; sub: string }> = {
  quick:   { emoji: '⚡', sub: 'Under 30 minutes' },
  medium:  { emoji: '👨‍🍳', sub: '30 to 60 minutes' },
  long:    { emoji: '🍲', sub: 'A slow afternoon simmer' },
  weekend: { emoji: '🌟', sub: 'Worth the effort' },
};

export default function EatInFilters() {
  const { showToast, toast } = useAppAlert();
  const router = useRouter();
  const { colors } = useTheme();
  const { filters, setFilters, setWheelItems, setLoading, isLoading } = useEatInStore();

  const toggleCuisine = (c: string) => {
    const next = filters.cuisines.includes(c) ? filters.cuisines.filter(x => x !== c) : [...filters.cuisines, c];
    setFilters({ cuisines: next });
  };

  const toggleEffort = (e: EffortLevel) => {
    const next = filters.efforts.includes(e) ? filters.efforts.filter(x => x !== e) : [...filters.efforts, e];
    setFilters({ efforts: next });
  };

  async function handleBuildWheel() {
    setLoading(true);
    try {
      const all = await getCustomRecipes();
      let filtered = all.filter(r => r.cuisine !== 'Spice Mixes' && r.cuisine !== 'Sauces');
      if (filters.cuisines.length) filtered = filtered.filter(r => filters.cuisines.includes(r.cuisine));
      if (filters.efforts.length) filtered = filtered.filter(r => filters.efforts.includes(r.effort));
      if (!filtered.length) {
        showToast(all.length === 0 ? 'Your recipe book is empty! Go add some first.' : 'No recipes match your filters.', 'info');
        return;
      }
      setWheelItems(filtered.map((r): WheelItem<Recipe> => ({ id: r.id, label: r.name, data: r })));
      router.push('/eat-in/wheel');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.ink },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
          ]}
        >
          <Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text>
        </Pressable>

        <Text style={[styles.kicker, { color: colors.primary }]}>EAT IN — No. 02</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          What's for{'\n'}
          <Text style={[styles.headingAccent, { color: colors.primary }]}>dinner?</Text>
        </Text>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>CUISINE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {WHEEL_CUISINE_OPTIONS.map(c => {
            const on = filters.cuisines.includes(c);
            return (
              <Pressable
                key={c}
                style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]}
                onPress={() => toggleCuisine(c)}
              >
                <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>HOW MUCH EFFORT?</Text>
        <View style={styles.effortList}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = filters.efforts.includes(value);
            const meta = EFFORT_META[value];
            return (
              <Pressable
                key={value}
                style={[
                  styles.effortCard,
                  { backgroundColor: on ? colors.bgCardAlt : colors.bgCard, borderColor: colors.ink, borderWidth: on ? 2 : 1.5 },
                  hardShadow(colors.shadow, on ? 3 : 2),
                ]}
                onPress={() => toggleEffort(value)}
              >
                <View style={[styles.effortIconWrap, { borderColor: colors.ink, backgroundColor: on ? colors.primaryLight : colors.bgMuted }]}>
                  <Text style={styles.effortEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.effortText}>
                  <Text style={[styles.effortName, { color: colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.effortSub, { color: colors.textSecondary }]}>{meta.sub}</Text>
                </View>
                {on && (
                  <View style={[styles.checkStamp, { backgroundColor: colors.ink }]}>
                    <Text style={[styles.checkMark, { color: colors.stampText }]}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, borderColor: colors.ink, opacity: isLoading ? 0.6 : 1 },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
          ]}
          onPress={handleBuildWheel}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#FFF6E8" /> : <Text style={styles.btnTxt}>BUILD THE WHEEL 🎡</Text>}
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={() => router.push('/recipes')}>
          <Text style={[styles.linkTxt, { color: colors.primary }]}>📖 MANAGE RECIPE BOOK</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, lineHeight: 21 },
  kicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: spacing.sm },
  heading: { fontFamily: type.serifBlack, fontSize: 40, lineHeight: 46, marginBottom: spacing.lg },
  headingAccent: { fontFamily: type.serifBlackItalic },
  label: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5, marginBottom: spacing.sm + 2 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1.5 },
  chipTxt: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  effortList: { gap: spacing.md, marginBottom: spacing.lg + 4 },
  effortCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  effortIconWrap: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  effortEmoji: { fontSize: 22 },
  effortText: { flex: 1 },
  effortName: { fontFamily: type.serifBold, fontSize: font.lg, marginBottom: 2 },
  effortSub: { fontFamily: type.serifItalic, fontSize: font.sm },
  checkStamp: { width: 22, height: 22, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, fontFamily: type.monoBold },
  btn: { borderRadius: radius.md, borderWidth: 1.5, padding: 16, alignItems: 'center', marginBottom: spacing.lg },
  btnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 13, letterSpacing: 2 },
  linkBtn: { alignItems: 'center' },
  linkTxt: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
});
