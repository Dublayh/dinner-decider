import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCustomRecipe } from '@/lib/customRecipes';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type Ingredient, type RecipeStep } from '@/types';

export default function AddRecipe() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [effort, setEffort] = useState<EffortLevel>('medium');
  const [servings, setServings] = useState('2');
  const [readyInMinutes, setReadyInMinutes] = useState('30');
  const [ingredients, setIngredients] = useState<{ amount: string; unit: string; name: string }[]>([
    { amount: '', unit: '', name: '' },
  ]);
  const [steps, setSteps] = useState<string[]>(['']);

  function addIngredient() {
    setIngredients(prev => [...prev, { amount: '', unit: '', name: '' }]);
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  }

  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i));
  }

  function addStep() {
    setSteps(prev => [...prev, '']);
  }

  function updateStep(i: number, value: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? value : s));
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a recipe name.'); return; }
    if (!cuisine) { Alert.alert('Cuisine required', 'Please select a cuisine.'); return; }

    setSaving(true);
    try {
      const cleanIngredients: Ingredient[] = ingredients
        .filter(i => i.name.trim())
        .map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() }));

      const cleanSteps: RecipeStep[] = steps
        .filter(s => s.trim())
        .map((s, idx) => ({ number: idx + 1, step: s.trim() }));

      await addCustomRecipe({
        name: name.trim(),
        cuisine,
        effort,
        readyInMinutes: parseInt(readyInMinutes) || 0,
        servings: parseInt(servings) || 2,
        ingredients: cleanIngredients,
        steps: cleanSteps,
      });

      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Add Recipe</Text>

        {/* Name */}
        <Text style={styles.label}>Recipe name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Grandma's Lasagna" />

        {/* Cuisine */}
        <Text style={styles.label}>Cuisine *</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => (
            <Pressable key={c} style={[styles.tag, cuisine === c && styles.tagOn]} onPress={() => setCuisine(c)}>
              <Text style={[styles.tagTxt, cuisine === c && styles.tagTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {/* Effort */}
        <Text style={styles.label}>Effort level</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => (
            <Pressable key={value} style={[styles.tag, effort === value && styles.tagOn]} onPress={() => setEffort(value)}>
              <Text style={[styles.tagTxt, effort === value && styles.tagTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Time & Servings */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Ready in (min)</Text>
            <TextInput style={styles.input} value={readyInMinutes} onChangeText={setReadyInMinutes} keyboardType="number-pad" placeholder="30" />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="2" />
          </View>
        </View>

        {/* Ingredients */}
        <Text style={styles.label}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingRow}>
            <TextInput
              style={[styles.input, styles.ingAmount]}
              value={ing.amount}
              onChangeText={v => updateIngredient(i, 'amount', v)}
              placeholder="Amount"
            />
            <TextInput
              style={[styles.input, styles.ingUnit]}
              value={ing.unit}
              onChangeText={v => updateIngredient(i, 'unit', v)}
              placeholder="Unit"
            />
            <TextInput
              style={[styles.input, styles.ingName]}
              value={ing.name}
              onChangeText={v => updateIngredient(i, 'name', v)}
              placeholder="Ingredient"
            />
            {ingredients.length > 1 && (
              <Pressable onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                <Text style={styles.removeBtnTxt}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable style={styles.addRowBtn} onPress={addIngredient}>
          <Text style={styles.addRowBtnTxt}>+ Add ingredient</Text>
        </Pressable>

        {/* Steps */}
        <Text style={[styles.label, { marginTop: 16 }]}>Directions</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumTxt}>{i + 1}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.stepInput]}
              value={step}
              onChangeText={v => updateStep(i, v)}
              placeholder={`Step ${i + 1}...`}
              multiline
            />
            {steps.length > 1 && (
              <Pressable onPress={() => removeStep(i)} style={styles.removeBtn}>
                <Text style={styles.removeBtnTxt}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable style={styles.addRowBtn} onPress={addStep}>
          <Text style={styles.addRowBtnTxt}>+ Add step</Text>
        </Pressable>

        {/* Save */}
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Recipe</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 60 },
  backBtn: { marginBottom: 20 },
  backTxt: { fontSize: 15, color: '#666' },
  heading: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '500', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', marginBottom: 8, backgroundColor: '#fafafa' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e5e5e5', backgroundColor: '#fafafa' },
  tagOn: { backgroundColor: '#EEEDFE', borderColor: '#AFA9EC' },
  tagTxt: { fontSize: 14, color: '#666' },
  tagTxtOn: { color: '#3C3489' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 70, marginBottom: 0, flex: 0 },
  ingUnit: { width: 60, marginBottom: 0, flex: 0 },
  ingName: { flex: 1, marginBottom: 0 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumTxt: { fontSize: 12, fontWeight: '500', color: '#3C3489' },
  stepInput: { flex: 1, marginBottom: 0 },
  removeBtn: { padding: 8, marginTop: 4 },
  removeBtnTxt: { color: '#ccc', fontSize: 16 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { color: '#7F77DD', fontSize: 14 },
  saveBtn: { backgroundColor: '#7F77DD', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
