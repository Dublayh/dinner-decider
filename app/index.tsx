import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import GroceryListModal from '@/components/GroceryListModal';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getDateline() {
  const d = new Date();
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ── Square top-bar button, letterpress style ──────────────────────────────────
function InkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.inkBtn,
        { backgroundColor: colors.bgCard, borderColor: colors.ink },
        pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
      ]}
    >
      <Text style={{ fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// ── A "course" on the menu ────────────────────────────────────────────────────
function CourseCard({ number, emoji, title, sub, onPress }: {
  number: string; emoji: string; title: string; sub: string; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.course,
        { backgroundColor: colors.bgCard, borderColor: colors.ink },
        pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 4),
      ]}
    >
      <View style={styles.courseTopRow}>
        <Text style={[styles.courseNo, { color: colors.primary }]}>No. {number}</Text>
        <Text style={[styles.courseLeader, { color: colors.borderStrong }]} numberOfLines={1} ellipsizeMode="clip">
          {'· '.repeat(60)}
        </Text>
        <Text style={styles.courseEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.courseTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.courseSub, { color: colors.textSecondary }]}>{sub}</Text>
    </Pressable>
  );
}

// ── Home screen — the menu cover ──────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const [showGrocery, setShowGrocery] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={[styles.dateline, { color: colors.textMuted }]}>{getDateline()}</Text>
          <View style={styles.topBtns}>
            <InkButton label="🛒" onPress={() => setShowGrocery(true)} />
            <InkButton label="📅" onPress={() => router.push('/meal-plan')} />
            <InkButton label={isDark ? '☀️' : '🕯️'} onPress={toggle} />
          </View>
        </View>

        {/* Double rule — like the head of a printed menu */}
        <View style={[styles.ruleThick, { backgroundColor: colors.ink }]} />
        <View style={[styles.ruleThin, { backgroundColor: colors.ink }]} />

        {/* Masthead */}
        <View style={styles.hero}>
          <Text style={[styles.heroKicker, { color: colors.primary }]}>THE HOUSE MENU</Text>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            Let's{' '}
            <Text style={[styles.heroTitleAccent, { color: colors.primary }]}>Eat.</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            The eternal question, finally solved — together.
          </Text>
        </View>

        {/* The courses — label travels with the cards so they read as one block */}
        <View style={styles.cards}>
          <View style={styles.sectionRow}>
            <View style={[styles.sectionRule, { backgroundColor: colors.line }]} />
            <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>TONIGHT'S OPTIONS</Text>
            <View style={[styles.sectionRule, { backgroundColor: colors.line }]} />
          </View>
          <CourseCard
            number="01" emoji="" title="Eat Out"
            sub="Find a table somewhere near you"
            onPress={() => router.push('/eat-out/filters')}
          />
          <CourseCard
            number="02" emoji="" title="Eat In"
            sub="Spin the wheel, cook the winner"
            onPress={() => router.push('/eat-in/filters')}
          />
          <CourseCard
            number="03" emoji="" title="Recipe Book"
            sub="The dishes worth repeating"
            onPress={() => router.push('/recipes')}
          />
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>· BON APPÉTIT ·</Text>
      </SafeAreaView>
      <GroceryListModal visible={showGrocery} onClose={() => setShowGrocery(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.md },
  dateline: { fontFamily: type.mono, fontSize: 10, letterSpacing: 1.5 },
  topBtns: { flexDirection: 'row', gap: 10 },
  inkBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  ruleThick: { height: 2 },
  ruleThin: { height: 1, marginTop: 3 },

  hero: { paddingTop: spacing.xl, paddingBottom: spacing.md },
  heroKicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 4, marginBottom: spacing.sm },
  heroTitle: { fontFamily: type.serifBlack, fontSize: 54, lineHeight: 60 },
  heroTitleAccent: { fontFamily: type.serifBlackItalic },
  heroSubtitle: { marginTop: spacing.sm, fontFamily: type.serifItalic, fontSize: font.md, lineHeight: 22, maxWidth: 260 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.md , paddingBottom: spacing.md},
  sectionRule: { flex: 1, height: 1 },
  sectionLabel: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5 },

  cards: { flex: 1, gap: 18, justifyContent: 'center' },
  course: { borderRadius: radius.lg, borderWidth: 1.5, paddingVertical: spacing.md, paddingHorizontal: spacing.md + 2 },
  courseTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  courseNo: { fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  courseLeader: { flex: 1, fontFamily: type.mono, fontSize: 10, lineHeight: 14, overflow: 'hidden' },
  courseEmoji: { fontSize: 20 },
  courseTitle: { fontFamily: type.serifBold, fontSize: 26, marginBottom: 3 },
  courseSub: { fontFamily: type.serifItalic, fontSize: font.sm, lineHeight: 18 },

  footer: { fontFamily: type.mono, fontSize: 9, letterSpacing: 3, textAlign: 'center', marginTop: spacing.md },
});
