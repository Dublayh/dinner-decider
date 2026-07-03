import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import KeyboardScrollView from '@/components/KeyboardScrollView';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCustomRecipe } from '@/lib/customRecipes';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type Ingredient, type RecipeStep } from '@/types';
import { useAppAlert, AppToast, AppConfirmDialog } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow, pressedShadow } from '@/constants/theme';

export default function AddRecipe() {
  const { showToast, toast } = useAppAlert();
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
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }: { pressed: boolean }) => [
            styles.backBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.ink },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 2),
          ]}
        >
          <Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text>
        </Pressable>
        <Text style={[styles.kicker, { color: colors.primary }]}>NEW ENTRY</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Add Recipe</Text>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Recipe name *</Text>
        <TextInput style={inp} value={name} onChangeText={setName} placeholder="e.g. Grandma's Lasagna" placeholderTextColor={colors.textMuted} />

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine *</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => {
            const on = cuisine === c;
            return <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => setCuisine(c)}><Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text></Pressable>;
          })}
        </View>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Effort level</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = effort === value;
            return <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => setEffort(value)}><Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{label}</Text></Pressable>;
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
            <View style={[styles.stepNum, { borderColor: colors.ink }]}><Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{i + 1}</Text></View>
            <TextInput style={[inp, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updStep(i, v)} placeholder={`Step ${i + 1}...`} multiline placeholderTextColor={colors.textMuted} />
            {steps.length > 1 && <Pressable onPress={() => remStep(i)} style={styles.removeBtn}><Text style={[styles.removeBtnTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
          </View>
        ))}
        <Pressable style={styles.addRowBtn} onPress={addStep}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add step</Text></Pressable>

        <Pressable
          style={({ pressed }: { pressed: boolean }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, borderColor: colors.ink, opacity: saving ? 0.6 : 1 },
            pressed ? pressedShadow(colors.shadow) : hardShadow(colors.shadow, 3),
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFF6E8" /> : <Text style={styles.saveBtnTxt}>SAVE RECIPE</Text>}
        </Pressable>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, lineHeight: 21 },
  kicker: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: 6 },
  heading: { fontFamily: type.serifBlack, fontSize: 30, marginBottom: spacing.lg },
  label: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  tag: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1.5 },
  tagTxt: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 70, flex: 0 },
  ingUnit: { width: 60, flex: 0 },
  ingName: { flex: 1 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumTxt: { fontFamily: type.monoBold, fontSize: 10 },
  stepInput: { flex: 1 },
  removeBtn: { padding: 8, marginTop: 4 },
  removeBtnTxt: { fontSize: 16 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  saveBtn: { borderRadius: radius.md, borderWidth: 1.5, padding: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 12, letterSpacing: 2 },
});
