import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipeById } from '@/lib/customRecipes';
import type { Recipe } from '@/types';

const EFFORT_LABEL: Record<string, string> = {
  quick: 'Quick (< 30 min)',
  medium: 'Medium (30-60 min)',
  weekend: 'Weekend project',
};

export default function RecipeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCustomRecipeById(id)
      .then(setRecipe)
      .catch(() => setRecipe(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#7F77DD" />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>← Back</Text></Pressable>
        <Text style={styles.error}>Recipe not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>← Back</Text></Pressable>

        {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />}
        <Text style={styles.title}>{recipe.name}</Text>
        <Text style={styles.meta}>
          {recipe.cuisine} · {EFFORT_LABEL[recipe.effort] ?? recipe.effort}{recipe.readyInMinutes > 0 ? ` · ${recipe.readyInMinutes} min` : ''} · Serves {recipe.servings}
        </Text>

        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.length === 0
          ? <Text style={styles.empty}>No ingredients listed.</Text>
          : recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <Text style={styles.ingAmt}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                <Text style={styles.ingName}>{ing.name}</Text>
              </View>
            ))
        }

        <Text style={styles.sectionTitle}>Directions</Text>
        {recipe.steps.length === 0
          ? <Text style={styles.empty}>No steps listed.</Text>
          : recipe.steps.map((step) => (
              <View key={step.number} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{step.number}</Text></View>
                <Text style={styles.stepTxt}>{step.step}</Text>
              </View>
            ))
        }
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 16 },
  backTxt: { fontSize: 15, color: '#666' },
  image: { width: '100%', height: 200, borderRadius: 16, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  meta: { fontSize: 14, color: '#888', marginBottom: 28 },
  sectionTitle: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14, marginTop: 8 },
  ingRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12 },
  ingAmt: { fontSize: 14, color: '#888', minWidth: 100 },
  ingName: { fontSize: 14, color: '#1a1a1a', flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumTxt: { fontSize: 12, fontWeight: '500', color: '#3C3489' },
  stepTxt: { fontSize: 14, color: '#1a1a1a', flex: 1, lineHeight: 22 },
  empty: { fontSize: 14, color: '#aaa', fontStyle: 'italic', marginBottom: 16 },
  error: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 40 },
});
