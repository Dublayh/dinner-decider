import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEatInStore } from '@/store/wheelStore';
import { getCustomRecipes } from '@/lib/customRecipes';
import { WHEEL_CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type WheelItem, type Recipe } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

const EFFORT_META: Record<EffortLevel, { emoji: string; sub: string }> = {
  quick:   { emoji: '⚡', sub: 'Under 30 minutes' },
  medium:  { emoji: '👨‍🍳', sub: '30 to 60 minutes' },
  weekend: { emoji: '🌟', sub: 'Worth the effort' },
};

export default function EatInFilters() {
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
        Alert.alert('No recipes found', all.length === 0 ? 'Your recipe book is empty! Go add some first.' : 'No recipes match your filters.');
        return;
      }
      setWheelItems(filtered.map((r): WheelItem<Recipe> => ({ id: r.id, label: r.name, data: r })));
      router.push('/eat-in/wheel');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>← Back</Text>
        </Pressable>

        <Text style={[styles.heading, { color: colors.textPrimary }]}>
          What's for{'\n'}dinner?
        </Text>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {WHEEL_CUISINE_OPTIONS.map(c => {
            const on = filters.cuisines.includes(c);
            return (
              <Pressable
                key={c}
                style={[styles.chip, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: on ? colors.chipOnBorder : colors.chipBorder }]}
                onPress={() => toggleCuisine(c)}
              >
                <Text style={[styles.chipTxt, { color: on ? colors.chipOnText : colors.chipText, fontWeight: on ? '700' : '500' }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>How much effort?</Text>
        <View style={styles.effortList}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = filters.efforts.includes(value);
            const meta = EFFORT_META[value];
            return (
              <Pressable
                key={value}
                style={[styles.effortCard, { backgroundColor: on ? colors.chipOnBg : colors.bgCard, borderColor: on ? colors.chipOnBorder : colors.border }]}
                onPress={() => toggleEffort(value)}
              >
                <View style={[styles.effortIconWrap, { backgroundColor: on ? colors.primary : colors.bgMuted }]}>
                  <Text style={styles.effortEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.effortText}>
                  <Text style={[styles.effortName, { color: on ? colors.chipOnText : colors.textPrimary }]}>{label}</Text>
                  <Text style={[styles.effortSub, { color: colors.textSecondary }]}>{meta.sub}</Text>
                </View>
                {on && (
                  <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary, opacity: isLoading ? 0.6 : 1 }]}
          onPress={handleBuildWheel}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Build the Wheel 🎡</Text>}
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={() => router.push('/recipes')}>
          <Text style={[styles.linkTxt, { color: colors.primary }]}>📖 Manage Recipe Book</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md },
  heading: { fontSize: 36, fontWeight: '800', lineHeight: 42, marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1.5 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5 },
  chipTxt: { fontSize: font.sm },
  effortList: { gap: spacing.sm, marginBottom: spacing.lg },
  effortCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md },
  effortIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  effortEmoji: { fontSize: 22 },
  effortText: { flex: 1 },
  effortName: { fontSize: font.md, fontWeight: '600', marginBottom: 2 },
  effortSub: { fontSize: font.sm },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btn: { borderRadius: radius.lg, padding: 16, alignItems: 'center', marginBottom: spacing.md },
  btnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  linkBtn: { alignItems: 'center' },
  linkTxt: { fontSize: font.md, fontWeight: '500' },
});
