import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import KeyboardScrollView from '@/components/KeyboardScrollView';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCustomRecipe } from '@/lib/customRecipes';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type Ingredient, type RecipeStep } from '@/types';
import { useAppAlert, AppToast, AppConfirmDialog } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

export default function AddRecipe() {
  const router = useRouter();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [effort, setEffort] = useState<EffortLevel>('medium');
  const [servings, setServings] = useState('2');
  const [readyInMinutes, setReadyInMinutes] = useState('30');
  const [ingredients, setIngredients] = useState<{ amount: string; unit: string; name: string }[]>([{ amount: '', unit: '', name: '' }]);
  const [steps, setSteps] = useState<string[]>(['']);

  const updIng = (i: number, f: keyof Ingredient, v: string) => setIngredients(prev => prev.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
  const addIng = () => setIngredients(prev => [...prev, { amount: '', unit: '', name: '' }]);
  const remIng = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updStep = (i: number, v: string) => setSteps(prev => prev.map((s, idx) => idx === i ? v : s));
  const addStep = () => setSteps(prev => [...prev, '']);
  const remStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  async function handleSave() {
    if (!name.trim()) { showToast('Please enter a recipe name.', 'error'); return; }
    if (!cuisine) { showToast('Please select a cuisine.', 'error'); return; }
    setSaving(true);
    try {
      await addCustomRecipe({
        name: name.trim(), cuisine, effort,
        readyInMinutes: parseInt(readyInMinutes) || 0,
        servings: parseInt(servings) || 2,
        ingredients: ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })),
        steps: steps.filter(s => s.trim()).map((s, idx) => ({ number: idx + 1, step: s.trim() })),
      });
      router.back();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  const inp = [styles.input, { borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />
      <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>←</Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Add Recipe</Text>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Recipe name *</Text>
        <TextInput style={inp} value={name} onChangeText={setName} placeholder="e.g. Grandma's Lasagna" placeholderTextColor={colors.textMuted} />

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine *</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => {
            const on = cuisine === c;
            return <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => setCuisine(c)}><Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '700' : '500' }]}>{c}</Text></Pressable>;
          })}
        </View>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Effort level</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = effort === value;
            return <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => setEffort(value)}><Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '700' : '500' }]}>{label}</Text></Pressable>;
          })}
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>Ready in (min)</Text>
            <TextInput style={inp} value={readyInMinutes} onChangeText={setReadyInMinutes} keyboardType="number-pad" placeholder="30" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>Servings</Text>
            <TextInput style={inp} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingRow}>
            <TextInput style={[inp, styles.ingAmount, { marginBottom: 0 }]} value={ing.amount} onChangeText={v => updIng(i, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
            <TextInput style={[inp, styles.ingUnit, { marginBottom: 0 }]} value={ing.unit} onChangeText={v => updIng(i, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
            <TextInput style={[inp, styles.ingName, { marginBottom: 0 }]} value={ing.name} onChangeText={v => updIng(i, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
            {ingredients.length > 1 && <Pressable onPress={() => remIng(i)} style={styles.removeBtn}><Text style={[styles.removeBtnTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
          </View>
        ))}
        <Pressable style={styles.addRowBtn} onPress={addIng}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add ingredient</Text></Pressable>

        <Text style={[styles.label, { color: colors.sectionLabel, marginTop: spacing.md }]}>Directions</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{i + 1}</Text></View>
            <TextInput style={[inp, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updStep(i, v)} placeholder={`Step ${i + 1}...`} multiline placeholderTextColor={colors.textMuted} />
            {steps.length > 1 && <Pressable onPress={() => remStep(i)} style={styles.removeBtn}><Text style={[styles.removeBtnTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
          </View>
        ))}
        <Pressable style={styles.addRowBtn} onPress={addStep}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add step</Text></Pressable>

        <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Recipe</Text>}
        </Pressable>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  heading: { fontSize: 24, fontWeight: '600', marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5 },
  tagTxt: { fontSize: font.sm },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 70, flex: 0 },
  ingUnit: { width: 60, flex: 0 },
  ingName: { flex: 1 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumTxt: { fontSize: font.xs, fontWeight: '700' },
  stepInput: { flex: 1 },
  removeBtn: { padding: 8, marginTop: 4 },
  removeBtnTxt: { fontSize: 16 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { fontSize: font.sm },
  saveBtn: { borderRadius: radius.lg, padding: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
