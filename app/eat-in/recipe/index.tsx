import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

export default function EatInRecipeHome() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Dinner Decider</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No more "I don't know, what do you want?"</Text>
        <View style={styles.cardRow}>
          <Pressable style={({ pressed }) => [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }, pressed && { opacity: 0.85 }]} onPress={() => router.push('/eat-out/filters')}>
            <Text style={styles.cardIcon}>🏙</Text>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Let's eat out</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Find restaurants nearby</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }, pressed && { opacity: 0.85 }]} onPress={() => router.push('/eat-in/filters')}>
            <Text style={styles.cardIcon}>🏠</Text>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Eat at home</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Spin for a recipe</Text>
          </Pressable>
        </View>
        <Pressable style={({ pressed }) => [styles.recipeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }, pressed && { opacity: 0.85 }]} onPress={() => router.push('/recipes')}>
          <Text style={styles.cardIcon}>📖</Text>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recipe Book</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Manage your saved recipes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: font.xxl, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: font.md, marginBottom: 48, textAlign: 'center' },
  cardRow: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 16 },
  card: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  recipeCard: { width: '100%', borderRadius: radius.lg, borderWidth: 1, padding: 20, alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'center' },
  cardIcon: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontSize: font.md, fontWeight: '500', textAlign: 'center' },
  cardSub: { fontSize: font.sm, textAlign: 'center' },
});
