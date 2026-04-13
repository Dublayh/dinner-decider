import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import { CUISINE_OPTIONS, EFFORT_OPTIONS, type EffortLevel, type Ingredient, type Recipe } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';

type EditSection = { name: string; ingredients: Ingredient[]; steps: string[] };

export default function AddRecipe() {
  const router = useRouter();
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

  // Section import search state
  const [sectionSearchQuery, setSectionSearchQuery] = useState<Record<number, string>>({});
  const [sectionSearchResults, setSectionSearchResults] = useState<Record<number, Recipe[]>>({});
  const [allImportable, setAllImportable] = useState<Recipe[]>([]);
  const [importableLoaded, setImportableLoaded] = useState(false);

  async function ensureImportableLoaded() {
    if (importableLoaded) return;
    try {
      const all = await getCustomRecipes();
      setAllImportable(all.filter(r => r.cuisine === 'Spice Mixes' || r.cuisine === 'Sauces'));
      setImportableLoaded(true);
    } catch {}
  }

  function handleSectionSearch(si: number, q: string) {
    setSectionSearchQuery(prev => ({ ...prev, [si]: q }));
    if (!q.trim()) { setSectionSearchResults(prev => ({ ...prev, [si]: [] })); return; }
    const results = allImportable.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
    setSectionSearchResults(prev => ({ ...prev, [si]: results }));
  }

  function importSectionRecipe(si: number, recipe: Recipe) {
    setSections(prev => prev.map((s, idx) => idx === si ? {
      name: recipe.name,
      ingredients: recipe.ingredients.length ? recipe.ingredients : [{ amount: '', unit: '', name: '' }],
      steps: recipe.steps.length ? recipe.steps.map(st => st.step) : [''],
    } : s));
    setSectionSearchQuery(prev => ({ ...prev, [si]: '' }));
    setSectionSearchResults(prev => ({ ...prev, [si]: [] }));
  }

  // Flat helpers
  const updIng = (i: number, f: keyof Ingredient, v: string) => setIngredients(prev => prev.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
  const addIng = () => setIngredients(prev => [...prev, { amount: '', unit: '', name: '' }]);
  const remIng = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updStep = (i: number, v: string) => setSteps(prev => prev.map((s, idx) => idx === i ? v : s));
  const addStep = () => setSteps(prev => [...prev, '']);
  const remStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  // Section helpers
  const addSection = () => setSections(prev => [...prev, { name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }]);
  const remSection = (si: number) => setSections(prev => prev.filter((_, idx) => idx !== si));
  const updSectionName = (si: number, v: string) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, name: v } : s));
  const updSecIng = (si: number, ii: number, f: keyof Ingredient, v: string) =>
    setSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.map((x, jdx) => jdx === ii ? { ...x, [f]: v } : x) } : s));
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
        sections: useSections ? sections.filter(s => s.name.trim() || s.ingredients.some(i => i.name.trim())).map(s => ({
          name: s.name.trim(),
          ingredients: s.ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })),
          steps: s.steps.filter(st => st.trim()).map((st, idx) => ({ number: idx + 1, step: st.trim() })),
        })) : undefined,
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

        <Text style={styles.label}>Recipe name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Grandma's Lasagna" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Cuisine *</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => (
            <Pressable key={c} style={[styles.tag, cuisine === c && styles.tagOn]} onPress={() => setCuisine(c)}>
              <Text style={[styles.tagTxt, cuisine === c && styles.tagTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Effort level</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => (
            <Pressable key={value} style={[styles.tag, effort === value && styles.tagOn]} onPress={() => setEffort(value)}>
              <Text style={[styles.tagTxt, effort === value && styles.tagTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Ready in (min)</Text>
            <TextInput style={styles.input} value={readyInMinutes} onChangeText={setReadyInMinutes} keyboardType="number-pad" placeholder="30" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        <Pressable style={styles.sectionToggle} onPress={() => { setUseSections(v => !v); if (!useSections) ensureImportableLoaded(); }}>
          <View style={[styles.toggle, useSections && styles.toggleOn]} />
          <Text style={styles.sectionToggleTxt}>Use sections (spice mix, sauce, etc.)</Text>
        </Pressable>

        {!useSections ? (
          <>
            <Text style={styles.label}>Ingredients</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <TextInput style={[styles.input, styles.ingAmount]} value={ing.amount} onChangeText={v => updIng(i, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
                <TextInput style={[styles.input, styles.ingUnit]} value={ing.unit} onChangeText={v => updIng(i, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
                <TextInput style={[styles.input, styles.ingName]} value={ing.name} onChangeText={v => updIng(i, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
                {ingredients.length > 1 && <Pressable onPress={() => remIng(i)}><Text style={styles.remTxt}>✕</Text></Pressable>}
              </View>
            ))}
            <Pressable onPress={addIng} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add ingredient</Text></Pressable>

            <Text style={[styles.label, { marginTop: 16 }]}>Directions</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{i + 1}</Text></View>
                <TextInput style={[styles.input, styles.stepInput]} value={step} onChangeText={v => updStep(i, v)} multiline placeholder={`Step ${i + 1}...`} placeholderTextColor={colors.textMuted} />
                {steps.length > 1 && <Pressable onPress={() => remStep(i)}><Text style={styles.remTxt}>✕</Text></Pressable>}
              </View>
            ))}
            <Pressable onPress={addStep} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add step</Text></Pressable>
          </>
        ) : (
          <>
            {sections.map((sec, si) => (
              <View key={si} style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={sec.name}
                    onChangeText={v => updSectionName(si, v)}
                    placeholder={`Section ${si + 1} name`}
                    placeholderTextColor={colors.textMuted}
                  />
                  {sections.length > 1 && <Pressable onPress={() => remSection(si)} style={{ padding: 8 }}><Text style={styles.remTxt}>✕</Text></Pressable>}
                </View>

                {/* Import from spice mix / sauce */}
                <TextInput
                  style={[styles.input, styles.importSearch]}
                  placeholder="Import from a spice mix or sauce..."
                  placeholderTextColor={colors.textMuted}
                  value={sectionSearchQuery[si] ?? ''}
                  onChangeText={v => handleSectionSearch(si, v)}
                  onFocus={ensureImportableLoaded}
                />
                {(sectionSearchResults[si] ?? []).length > 0 && (
                  <View style={styles.importResults}>
                    {(sectionSearchResults[si] ?? []).map(r => (
                      <Pressable key={r.id} style={styles.importRow} onPress={() => importSectionRecipe(si, r)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.importName}>{r.name}</Text>
                          <Text style={styles.importMeta}>{r.cuisine} · {r.ingredients.length} ingredients</Text>
                        </View>
                        <Text style={styles.importAction}>Import</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {(sectionSearchQuery[si] ?? '').trim().length > 0 && (sectionSearchResults[si] ?? []).length === 0 && (
                  <Text style={styles.importEmpty}>No spice mixes or sauces found.</Text>
                )}

                <Text style={styles.subLabel}>Ingredients</Text>
                {sec.ingredients.map((ing, ii) => (
                  <View key={ii} style={styles.ingRow}>
                    <TextInput style={[styles.input, styles.ingAmount]} value={ing.amount} onChangeText={v => updSecIng(si, ii, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
                    <TextInput style={[styles.input, styles.ingUnit]} value={ing.unit} onChangeText={v => updSecIng(si, ii, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
                    <TextInput style={[styles.input, styles.ingName]} value={ing.name} onChangeText={v => updSecIng(si, ii, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
                    {sec.ingredients.length > 1 && <Pressable onPress={() => remSecIng(si, ii)}><Text style={styles.remTxt}>✕</Text></Pressable>}
                  </View>
                ))}
                <Pressable onPress={() => addSecIng(si)} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add ingredient</Text></Pressable>

                <Text style={styles.subLabel}>Directions</Text>
                {sec.steps.map((step, ii) => (
                  <View key={ii} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{ii + 1}</Text></View>
                    <TextInput style={[styles.input, styles.stepInput]} value={step} onChangeText={v => updSecStep(si, ii, v)} multiline placeholder={`Step ${ii + 1}...`} placeholderTextColor={colors.textMuted} />
                    {sec.steps.length > 1 && <Pressable onPress={() => remSecStep(si, ii)}><Text style={styles.remTxt}>✕</Text></Pressable>}
                  </View>
                ))}
                <Pressable onPress={() => addSecStep(si)} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add step</Text></Pressable>
              </View>
            ))}
            <Pressable style={styles.addSectionBtn} onPress={addSection}>
              <Text style={styles.addSectionBtnTxt}>+ Add section</Text>
            </Pressable>
          </>
        )}

        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Recipe</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 60 },
  backBtn: { marginBottom: spacing.lg },
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  heading: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  subLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, color: colors.textPrimary, marginBottom: 8, backgroundColor: colors.bgCard },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  tagOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tagTxt: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '500' },
  tagTxtOn: { color: colors.primaryDark, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  toggle: { width: 36, height: 20, borderRadius: 10, backgroundColor: colors.border },
  toggleOn: { backgroundColor: colors.primary },
  sectionToggleTxt: { fontSize: font.sm, color: colors.textSecondary },
  ingRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 60, marginBottom: 0, flex: 0 },
  ingUnit: { width: 55, marginBottom: 0, flex: 0 },
  ingName: { flex: 1, marginBottom: 0 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumTxt: { fontSize: font.xs, fontWeight: '700', color: colors.primaryDark },
  stepInput: { flex: 1, marginBottom: 0 },
  remTxt: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 4 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { color: colors.primary, fontSize: font.sm },
  sectionBlock: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.border },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  importSearch: { backgroundColor: colors.bgMuted, borderColor: colors.borderStrong, marginBottom: 4 },
  importResults: { backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden' },
  importRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  importName: { fontSize: font.sm, fontWeight: '600', color: colors.textPrimary },
  importMeta: { fontSize: font.xs, color: colors.textMuted },
  importAction: { fontSize: font.sm, color: colors.primary, fontWeight: '700' },
  importEmpty: { fontSize: font.xs, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },
  addSectionBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginTop: 4 },
  addSectionBtnTxt: { color: colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
