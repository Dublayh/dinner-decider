import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type Ingredient, type Recipe } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

type EditSection = { name: string; ingredients: Ingredient[]; steps: string[] };

export default function AddRecipe() {
  const router = useRouter();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [effort, setEffort] = useState<EffortLevel>('medium');
  const [servings, setServings] = useState('2');
  const [readyInMinutes, setReadyInMinutes] = useState('30');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ amount: '', unit: '', name: '' }]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [sections, setSections] = useState<EditSection[]>([{ name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }]);
  const [useSections, setUseSections] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState<Record<number, string>>({});
  const [sectionSearchResults, setSectionSearchResults] = useState<Record<number, Recipe[]>>({});
  const [allImportable, setAllImportable] = useState<Recipe[]>([]);
  const [importableLoaded, setImportableLoaded] = useState(false);

  async function ensureImportableLoaded() {
    if (importableLoaded) return;
    try { const all = await getCustomRecipes(); setAllImportable(all.filter(r => r.cuisine === 'Spice Mixes' || r.cuisine === 'Sauces')); setImportableLoaded(true); } catch {}
  }

  function handleSectionSearch(si: number, q: string) {
    setSectionSearchQuery(prev => ({ ...prev, [si]: q }));
    if (!q.trim()) { setSectionSearchResults(prev => ({ ...prev, [si]: [] })); return; }
    setSectionSearchResults(prev => ({ ...prev, [si]: allImportable.filter(r => r.name.toLowerCase().includes(q.toLowerCase())) }));
  }

  function importSectionRecipe(si: number, recipe: Recipe) {
    setSections(prev => prev.map((s, idx) => idx === si ? { name: recipe.name, ingredients: recipe.ingredients.length ? recipe.ingredients : [{ amount: '', unit: '', name: '' }], steps: recipe.steps.length ? recipe.steps.map(st => st.step) : [''] } : s));
    setSectionSearchQuery(prev => ({ ...prev, [si]: '' }));
    setSectionSearchResults(prev => ({ ...prev, [si]: [] }));
  }

  const updIng = (i: number, f: keyof Ingredient, v: string) => setIngredients(prev => prev.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
  const addIng = () => setIngredients(prev => [...prev, { amount: '', unit: '', name: '' }]);
  const remIng = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updStep = (i: number, v: string) => setSteps(prev => prev.map((s, idx) => idx === i ? v : s));
  const addStep = () => setSteps(prev => [...prev, '']);
  const remStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));
  const addSection = () => setSections(prev => [...prev, { name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }]);
  const remSection = (si: number) => setSections(prev => prev.filter((_, idx) => idx !== si));
  const updSectionName = (si: number, v: string) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, name: v } : s));
  const updSecIng = (si: number, ii: number, f: keyof Ingredient, v: string) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.map((x, jdx) => jdx === ii ? { ...x, [f]: v } : x) } : s));
  const addSecIng = (si: number) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: [...s.ingredients, { amount: '', unit: '', name: '' }] } : s));
  const remSecIng = (si: number, ii: number) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.filter((_, jdx) => jdx !== ii) } : s));
  const updSecStep = (si: number, ii: number, v: string) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.map((x, jdx) => jdx === ii ? v : x) } : s));
  const addSecStep = (si: number) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: [...s.steps, ''] } : s));
  const remSecStep = (si: number, ii: number) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.filter((_, jdx) => jdx !== ii) } : s));

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a recipe name.'); return; }
    if (!cuisine) { Alert.alert('Cuisine required', 'Please select a cuisine.'); return; }
    setSaving(true);
    try {
      await addCustomRecipe({
        name: name.trim(), cuisine, effort,
        readyInMinutes: parseInt(readyInMinutes) || 0,
        servings: parseInt(servings) || 2,
        ingredients: useSections ? [] : ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })),
        steps: useSections ? [] : steps.filter(s => s.trim()).map((s, idx) => ({ number: idx + 1, step: s.trim() })),
        sections: useSections ? sections.filter(s => s.name.trim() || s.ingredients.some(i => i.name.trim())).map(s => ({ name: s.name.trim(), ingredients: s.ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })), steps: s.steps.filter(st => st.trim()).map((st, idx) => ({ number: idx + 1, step: st.trim() })) })) : undefined,
      });
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  // Shared input style
  const inp = [styles.input, { borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        <Pressable style={[styles.sectionToggle, { borderTopColor: colors.border, borderBottomColor: colors.border }]} onPress={() => { setUseSections(v => !v); if (!useSections) ensureImportableLoaded(); }}>
          <View style={[styles.toggle, { backgroundColor: useSections ? colors.primary : colors.border }]} />
          <Text style={[styles.sectionToggleTxt, { color: colors.textSecondary }]}>Use sections (spice mix, sauce, etc.)</Text>
        </Pressable>

        {!useSections ? <>
          <Text style={[styles.label, { color: colors.sectionLabel }]}>Ingredients</Text>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingRow}>
              <TextInput style={[inp, styles.ingAmount, { marginBottom: 0 }]} value={ing.amount} onChangeText={v => updIng(i, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
              <TextInput style={[inp, styles.ingUnit, { marginBottom: 0 }]} value={ing.unit} onChangeText={v => updIng(i, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
              <TextInput style={[inp, styles.ingName, { marginBottom: 0 }]} value={ing.name} onChangeText={v => updIng(i, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
              {ingredients.length > 1 && <Pressable onPress={() => remIng(i)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addIng} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add ingredient</Text></Pressable>
          <Text style={[styles.label, { color: colors.sectionLabel, marginTop: spacing.md }]}>Directions</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{i + 1}</Text></View>
              <TextInput style={[inp, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updStep(i, v)} multiline placeholder={`Step ${i + 1}...`} placeholderTextColor={colors.textMuted} />
              {steps.length > 1 && <Pressable onPress={() => remStep(i)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addStep} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add step</Text></Pressable>
        </> : <>
          {sections.map((sec, si) => (
            <View key={si} style={[styles.sectionBlock, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <TextInput style={[inp, { flex: 1, marginBottom: 0 }]} value={sec.name} onChangeText={v => updSectionName(si, v)} placeholder={`Section ${si + 1} name`} placeholderTextColor={colors.textMuted} />
                {sections.length > 1 && <Pressable onPress={() => remSection(si)} style={{ padding: 8 }}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
              </View>
              <TextInput style={[inp, { backgroundColor: colors.bgMuted, borderColor: colors.borderStrong, marginBottom: 4 }]} placeholder="Import from a spice mix or sauce..." placeholderTextColor={colors.textMuted} value={sectionSearchQuery[si] ?? ''} onChangeText={v => handleSectionSearch(si, v)} onFocus={ensureImportableLoaded} />
              {(sectionSearchResults[si] ?? []).length > 0 && (
                <View style={[styles.importResults, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  {(sectionSearchResults[si] ?? []).map(r => (
                    <Pressable key={r.id} style={[styles.importRow, { borderBottomColor: colors.border }]} onPress={() => importSectionRecipe(si, r)}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.importName, { color: colors.textPrimary }]}>{r.name}</Text>
                        <Text style={[styles.importMeta, { color: colors.textMuted }]}>{r.cuisine} · {r.ingredients.length} ingredients</Text>
                      </View>
                      <Text style={[styles.importAction, { color: colors.primary }]}>Import</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={[styles.subLabel, { color: colors.sectionLabel }]}>Ingredients</Text>
              {sec.ingredients.map((ing, ii) => (
                <View key={ii} style={styles.ingRow}>
                  <TextInput style={[inp, styles.ingAmount, { marginBottom: 0 }]} value={ing.amount} onChangeText={v => updSecIng(si, ii, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[inp, styles.ingUnit, { marginBottom: 0 }]} value={ing.unit} onChangeText={v => updSecIng(si, ii, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[inp, styles.ingName, { marginBottom: 0 }]} value={ing.name} onChangeText={v => updSecIng(si, ii, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
                  {sec.ingredients.length > 1 && <Pressable onPress={() => remSecIng(si, ii)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
                </View>
              ))}
              <Pressable onPress={() => addSecIng(si)} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add ingredient</Text></Pressable>
              <Text style={[styles.subLabel, { color: colors.sectionLabel }]}>Directions</Text>
              {sec.steps.map((step, ii) => (
                <View key={ii} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{ii + 1}</Text></View>
                  <TextInput style={[inp, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updSecStep(si, ii, v)} multiline placeholder={`Step ${ii + 1}...`} placeholderTextColor={colors.textMuted} />
                  {sec.steps.length > 1 && <Pressable onPress={() => remSecStep(si, ii)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
                </View>
              ))}
              <Pressable onPress={() => addSecStep(si)} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add step</Text></Pressable>
            </View>
          ))}
          <Pressable style={[styles.addSectionBtn, { borderColor: colors.primary }]} onPress={addSection}>
            <Text style={[styles.addSectionBtnTxt, { color: colors.primary }]}>+ Add section</Text>
          </Pressable>
        </>}

        <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Recipe</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  subLabel: { fontSize: font.xs, fontWeight: '600', marginBottom: 6, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5 },
  tagTxt: { fontSize: font.sm },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  toggle: { width: 36, height: 20, borderRadius: 10 },
  sectionToggleTxt: { fontSize: font.sm },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 60, flex: 0 },
  ingUnit: { width: 55, flex: 0 },
  ingName: { flex: 1 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumTxt: { fontSize: font.xs, fontWeight: '700' },
  stepInput: { flex: 1 },
  remTxt: { fontSize: 16, paddingHorizontal: 4 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { fontSize: font.sm },
  sectionBlock: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  importResults: { borderWidth: 1.5, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden' },
  importRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  importName: { fontSize: font.sm, fontWeight: '600' },
  importMeta: { fontSize: font.xs },
  importAction: { fontSize: font.sm, fontWeight: '700' },
  addSectionBtn: { borderWidth: 1.5, borderRadius: radius.md, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginTop: 4 },
  addSectionBtnTxt: { fontWeight: '600' },
  saveBtn: { borderRadius: radius.lg, padding: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
