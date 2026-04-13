import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, font } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Curved warm header */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.plateCircle}>
              <Text style={styles.plateEmoji}>🍽️</Text>
            </View>
            <Text style={styles.title}>Let's Eat</Text>
            <Text style={styles.subtitle}>"What do you want for dinner?"</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Cards */}
      <View style={styles.body}>
        <View style={styles.cardRow}>
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardOut, pressed && styles.pressed]}
            onPress={() => router.push('/eat-out/filters')}
          >
            <Text style={styles.cardEmoji}>🏙️</Text>
            <Text style={styles.cardTitle}>Eat Out</Text>
            <Text style={styles.cardSub}>Find restaurants nearby</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, styles.cardIn, pressed && styles.pressed]}
            onPress={() => router.push('/eat-in/filters')}
          >
            <Text style={styles.cardEmoji}>🏠</Text>
            <Text style={styles.cardTitle}>Eat In</Text>
            <Text style={styles.cardSub}>Spin for a recipe</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.recipeCard, pressed && styles.pressed]}
          onPress={() => router.push('/recipes')}
        >
          <View style={styles.recipeIconWrap}>
            <Text style={styles.recipeIconEmoji}>📖</Text>
          </View>
          <View style={styles.recipeTextWrap}>
            <Text style={styles.recipeTitle}>Recipe Book</Text>
            <Text style={styles.recipeSub}>Browse & manage your saved recipes</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const CURVE = 40;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: width * 0.5,
    borderBottomRightRadius: width * 0.5,
    paddingBottom: 40,
    marginBottom: -20,
  },
  headerContent: { alignItems: 'center', paddingTop: 16, paddingHorizontal: spacing.lg, gap: spacing.sm },
  plateCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  plateEmoji: { fontSize: 38 },
  title: { fontSize: 42, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 46 },
  subtitle: { fontSize: font.md, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 36, gap: spacing.md, justifyContent: 'center' },

  cardRow: { flexDirection: 'row', gap: spacing.md },
  card: {
    flex: 1, borderRadius: radius.xl, paddingVertical: 28, paddingHorizontal: spacing.md,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  cardOut: { backgroundColor: colors.primary },
  cardIn: { backgroundColor: colors.primaryDark },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  cardEmoji: { fontSize: 34 },
  cardTitle: { fontSize: font.lg, fontWeight: '700', color: '#fff' },
  cardSub: { fontSize: font.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },

  recipeCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  recipeIconWrap: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  recipeIconEmoji: { fontSize: 26 },
  recipeTextWrap: { flex: 1 },
  recipeTitle: { fontSize: font.md, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  recipeSub: { fontSize: font.sm, color: colors.textSecondary },
});
