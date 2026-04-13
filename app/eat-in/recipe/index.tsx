import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Dinner Decider</Text>
        <Text style={styles.subtitle}>No more "I don't know, what do you want?"</Text>

        <View style={styles.cardRow}>
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/eat-out/filters')}
          >
            <Text style={styles.cardIcon}>🏙</Text>
            <Text style={styles.cardTitle}>Let's eat out</Text>
            <Text style={styles.cardSub}>Find restaurants nearby</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/eat-in/filters')}
          >
            <Text style={styles.cardIcon}>🏠</Text>
            <Text style={styles.cardTitle}>Eat at home</Text>
            <Text style={styles.cardSub}>Spin for a recipe</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.recipeCard, pressed && styles.cardPressed]}
          onPress={() => router.push('/recipes')}
        >
          <Text style={styles.cardIcon}>📖</Text>
          <Text style={styles.cardTitle}>Recipe Book</Text>
          <Text style={styles.cardSub}>Manage your saved recipes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 48, textAlign: 'center' },
  cardRow: { flexDirection: 'row', gap: 16, width: '100%', marginBottom: 16 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  recipeCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  cardPressed: { backgroundColor: '#f9f9f9', transform: [{ scale: 0.97 }] },
  cardIcon: { fontSize: 32, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', textAlign: 'center' },
  cardSub: { fontSize: 12, color: '#888', textAlign: 'center' },
});
