import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEatInStore } from '@/store/wheelStore';
import { getCustomRecipes } from '@/lib/customRecipes';
import { WHEEL_CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type WheelItem, type Recipe } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';

const EFFORT_META: Record<EffortLevel, { emoji: string; sub: string }> = {
  quick:   { emoji: '⚡', sub: 'Under 30 minutes' },
  medium:  { emoji: '👨‍🍳', sub: '30 to 60 minutes' },
  weekend: { emoji: '🌟', sub: 'Worth the effort' },
};

export default function EatInFilters() {
  const router = useRouter();
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
      // Always exclude spice mixes and sauces from the wheel
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>What's for{'\n'}dinner?</Text>

        <Text style={styles.label}>Cuisine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {WHEEL_CUISINE_OPTIONS.map(c => (
            <Pressable key={c} style={[styles.chip, filters.cuisines.includes(c) && styles.chipOn]} onPress={() => toggleCuisine(c)}>
              <Text style={[styles.chipTxt, filters.cuisines.includes(c) && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>How much effort?</Text>
        <View style={styles.effortList}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = filters.efforts.includes(value);
            const meta = EFFORT_META[value];
            return (
              <Pressable key={value} style={[styles.effortCard, on && styles.effortCardOn]} onPress={() => toggleEffort(value)}>
                <View style={[styles.effortIconWrap, on && styles.effortIconWrapOn]}>
                  <Text style={styles.effortEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.effortText}>
                  <Text style={[styles.effortName, on && styles.effortNameOn]}>{label}</Text>
                  <Text style={styles.effortSub}>{meta.sub}</Text>
                </View>
                {on && <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>}
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.btn, isLoading && styles.btnDisabled]} onPress={handleBuildWheel} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Build the Wheel 🎡</Text>}
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={() => router.push('/recipes')}>
          <Text style={styles.linkTxt}>📖 Manage Recipe Book</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  heading: { fontSize: 36, fontWeight: '800', color: colors.textPrimary, lineHeight: 42, marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  chipScroll: { marginLeft: -spacing.lg, marginBottom: spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgCard },
  chipOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipTxt: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '500' },
  chipTxtOn: { color: colors.primaryDark, fontWeight: '700' },
  effortList: { gap: spacing.sm, marginBottom: spacing.lg },
  effortCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md },
  effortCardOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  effortIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  effortIconWrapOn: { backgroundColor: colors.primary },
  effortEmoji: { fontSize: 22 },
  effortText: { flex: 1 },
  effortName: { fontSize: font.md, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  effortNameOn: { color: colors.primaryDark },
  effortSub: { fontSize: font.sm, color: colors.textSecondary },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, alignItems: 'center', marginBottom: spacing.md },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  linkBtn: { alignItems: 'center' },
  linkTxt: { color: colors.primary, fontSize: font.md, fontWeight: '500' },
});
