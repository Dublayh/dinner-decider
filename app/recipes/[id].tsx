import { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Image, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipeById, updateCustomRecipe, deleteCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import type { Recipe, Ingredient, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS } from '@/types';
import { colors, radius, spacing, font } from '@/constants/theme';

const EFFORT_LABEL: Record<string, string> = {
  quick: 'Quick (< 30 min)',
  medium: 'Medium (30–60 min)',
  weekend: 'Weekend project',
};

type EditSection = { name: string; ingredients: Ingredient[]; steps: string[] };

function recipeToEdit(recipe: Recipe) {
  const hasSections = (recipe.sections ?? []).length > 0;
  return {
    name: recipe.name, cuisine: recipe.cuisine,
    effort: recipe.effort as EffortLevel,
    servings: String(recipe.servings),
    readyInMinutes: String(recipe.readyInMinutes),
    ingredients: recipe.ingredients.length ? recipe.ingredients : [{ amount: '', unit: '', name: '' }],
    steps: recipe.steps.length ? recipe.steps.map(s => s.step) : [''],
    sections: hasSections
      ? recipe.sections!.map(s => ({
          name: s.name,
          ingredients: s.ingredients.length ? s.ingredients : [{ amount: '', unit: '', name: '' }],
          steps: s.steps.length ? s.steps.map(st => st.step) : [''],
        }))
      : [{ name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }],
    useSections: hasSections,
  };
}

export default function RecipeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  const [editName, setEditName] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editEffort, setEditEffort] = useState<EffortLevel>('medium');
  const [editServings, setEditServings] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);
  const [editSteps, setEditSteps] = useState<string[]>([]);
  const [editSections, setEditSections] = useState<EditSection[]>([]);
  const [useSections, setUseSections] = useState(false);

  // Import search state
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

  function importSectionRecipe(si: number, r: Recipe) {
    setEditSections(prev => prev.map((s, idx) => idx === si ? {
      name: r.name,
      ingredients: r.ingredients.length ? r.ingredients : [{ amount: '', unit: '', name: '' }],
      steps: r.steps.length ? r.steps.map(st => st.step) : [''],
    } : s));
    setSectionSearchQuery(prev => ({ ...prev, [si]: '' }));
    setSectionSearchResults(prev => ({ ...prev, [si]: [] }));
  }

  useEffect(() => {
    if (!id) return;
    getCustomRecipeById(id).then(r => {
      setRecipe(r);
      if (r) {
        const e = recipeToEdit(r);
        setEditName(e.name); setEditCuisine(e.cuisine); setEditEffort(e.effort);
        setEditServings(e.servings); setEditMinutes(e.readyInMinutes);
        setEditIngredients(e.ingredients); setEditSteps(e.steps);
        setEditSections(e.sections); setUseSections(e.useSections);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const updIng = (i: number, f: keyof Ingredient, v: string) => setEditIngredients(prev => prev.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
  const addIng = () => setEditIngredients(prev => [...prev, { amount: '', unit: '', name: '' }]);
  const remIng = (i: number) => setEditIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updStep = (i: number, v: string) => setEditSteps(prev => prev.map((s, idx) => idx === i ? v : s));
  const addStep = () => setEditSteps(prev => [...prev, '']);
  const remStep = (i: number) => setEditSteps(prev => prev.filter((_, idx) => idx !== i));

  const addSection = () => setEditSections(prev => [...prev, { name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }]);
  const remSection = (si: number) => setEditSections(prev => prev.filter((_, idx) => idx !== si));
  const updSectionName = (si: number, v: string) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, name: v } : s));
  const updSecIng = (si: number, ii: number, f: keyof Ingredient, v: string) =>
    setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.map((x, jdx) => jdx === ii ? { ...x, [f]: v } : x) } : s));
  const addSecIng = (si: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: [...s.ingredients, { amount: '', unit: '', name: '' }] } : s));
  const remSecIng = (si: number, ii: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.filter((_, jdx) => jdx !== ii) } : s));
  const updSecStep = (si: number, ii: number, v: string) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.map((x, jdx) => jdx === ii ? v : x) } : s));
  const addSecStep = (si: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: [...s.steps, ''] } : s));
  const remSecStep = (si: number, ii: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.filter((_, jdx) => jdx !== ii) } : s));

  async function handleSave() {
    if (!editName.trim()) { Alert.alert('Name required'); return; }
    if (!editCuisine) { Alert.alert('Cuisine required'); return; }
    setSaving(true);
    try {
      const updated = await updateCustomRecipe(id!, {
        name: editName.trim(), cuisine: editCuisine, effort: editEffort,
        readyInMinutes: parseInt(editMinutes) || 0,
        servings: parseInt(editServings) || 2,
        ingredients: useSections ? [] : editIngredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })),
        steps: useSections ? [] : editSteps.filter(s => s.trim()).map((s, idx) => ({ number: idx + 1, step: s.trim() })),
        sections: useSections ? editSections.filter(s => s.name.trim() || s.ingredients.some(i => i.name.trim())).map(s => ({
          name: s.name.trim(),
          ingredients: s.ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })),
          steps: s.steps.filter(st => st.trim()).map((st, idx) => ({ number: idx + 1, step: st.trim() })),
        })) : undefined,
      });
      setRecipe(updated);
      setEditing(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  function handleDelete() {
    Alert.alert('Remove recipe', `Remove "${recipe?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteCustomRecipe(id!); router.back(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>;
  if (!recipe) return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>← Back</Text></Pressable>
      <Text style={styles.error}>Recipe not found.</Text>
    </SafeAreaView>
  );

  if (!editing) {
    const hasSections = (recipe.sections ?? []).length > 0;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>← Back</Text></Pressable>
            <View style={styles.topActions}>
              <Pressable onPress={() => { setEditing(true); ensureImportableLoaded(); }} style={styles.editBtn}><Text style={styles.editBtnTxt}>Edit</Text></Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn}><Text style={styles.deleteBtnTxt}>Delete</Text></Pressable>
            </View>
          </View>

          {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />}
          <Text style={styles.title}>{recipe.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}><Text style={styles.metaChipTxt}>{recipe.cuisine}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaChipTxt}>{EFFORT_LABEL[recipe.effort]}</Text></View>
            {recipe.readyInMinutes > 0 && <View style={styles.metaChip}><Text style={styles.metaChipTxt}>⏱ {recipe.readyInMinutes} min</Text></View>}
            <View style={styles.metaChip}><Text style={styles.metaChipTxt}>👤 {recipe.servings}</Text></View>
          </View>

          {hasSections && (
            <Pressable style={styles.allIngBtn} onPress={() => setShowAllIngredients(v => !v)}>
              <Text style={styles.allIngBtnTxt}>{showAllIngredients ? '▲ Hide shopping list' : '▼ Show all ingredients'}</Text>
            </Pressable>
          )}
          {hasSections && showAllIngredients && (
            <View style={styles.allIngCard}>
              <Text style={styles.allIngTitle}>All Ingredients</Text>
              {recipe.sections!.map((sec, si) => sec.ingredients.length > 0 && (
                <View key={si} style={styles.allIngSection}>
                  {sec.name ? <Text style={styles.allIngSectionName}>{sec.name}</Text> : null}
                  {sec.ingredients.map((ing, i) => (
                    <View key={i} style={styles.ingRow}>
                      <Text style={styles.ingAmt}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                      <Text style={styles.ingName}>{ing.name}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {hasSections ? recipe.sections!.map((sec, si) => (
            <View key={si} style={styles.sectionBlock}>
              {sec.name ? <Text style={styles.sectionHeader}>{sec.name}</Text> : null}
              {sec.ingredients.length > 0 && <>
                <Text style={styles.sectionLabel}>Ingredients</Text>
                {sec.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingRow}>
                    <Text style={styles.ingAmt}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={styles.ingName}>{ing.name}</Text>
                  </View>
                ))}
              </>}
              {sec.steps.length > 0 && <>
                <Text style={styles.sectionLabel}>Directions</Text>
                {sec.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{step.number}</Text></View>
                    <Text style={styles.stepTxt}>{step.step}</Text>
                  </View>
                ))}
              </>}
            </View>
          )) : <>
            <Text style={styles.sectionLabel}>Ingredients</Text>
            {recipe.ingredients.length === 0
              ? <Text style={styles.empty}>No ingredients listed.</Text>
              : recipe.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingRow}>
                    <Text style={styles.ingAmt}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={styles.ingName}>{ing.name}</Text>
                  </View>
                ))
            }
            <Text style={styles.sectionLabel}>Directions</Text>
            {recipe.steps.length === 0
              ? <Text style={styles.empty}>No steps listed.</Text>
              : recipe.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{step.number}</Text></View>
                    <Text style={styles.stepTxt}>{step.step}</Text>
                  </View>
                ))
            }
          </>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // EDIT MODE
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => setEditing(false)} style={styles.backBtn}><Text style={styles.backTxt}>← Cancel</Text></Pressable>
          <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnTxt}>Save</Text>}
          </Pressable>
        </View>
        <Text style={styles.editHeading}>Edit Recipe</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
        <Text style={styles.label}>Cuisine</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => (
            <Pressable key={c} style={[styles.tag, editCuisine === c && styles.tagOn]} onPress={() => setEditCuisine(c)}>
              <Text style={[styles.tagTxt, editCuisine === c && styles.tagTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Effort</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => (
            <Pressable key={value} style={[styles.tag, editEffort === value && styles.tagOn]} onPress={() => setEditEffort(value)}>
              <Text style={[styles.tagTxt, editEffort === value && styles.tagTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Ready in (min)</Text>
            <TextInput style={styles.input} value={editMinutes} onChangeText={setEditMinutes} keyboardType="number-pad" />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Servings</Text>
            <TextInput style={styles.input} value={editServings} onChangeText={setEditServings} keyboardType="number-pad" />
          </View>
        </View>
        <Pressable style={styles.sectionToggle} onPress={() => { setUseSections(v => !v); ensureImportableLoaded(); }}>
          <View style={[styles.toggle, useSections && styles.toggleOn]} />
          <Text style={styles.sectionToggleTxt}>Use sections</Text>
        </Pressable>

        {!useSections ? <>
          <Text style={styles.label}>Ingredients</Text>
          {editIngredients.map((ing, i) => (
            <View key={i} style={styles.ingEditRow}>
              <TextInput style={[styles.input, styles.ingAmount]} value={ing.amount} onChangeText={v => updIng(i, 'amount', v)} placeholder="Amt" />
              <TextInput style={[styles.input, styles.ingUnit]} value={ing.unit} onChangeText={v => updIng(i, 'unit', v)} placeholder="Unit" />
              <TextInput style={[styles.input, styles.ingNameF]} value={ing.name} onChangeText={v => updIng(i, 'name', v)} placeholder="Ingredient" />
              {editIngredients.length > 1 && <Pressable onPress={() => remIng(i)}><Text style={styles.remTxt}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addIng} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add ingredient</Text></Pressable>
          <Text style={[styles.label, { marginTop: 16 }]}>Directions</Text>
          {editSteps.map((step, i) => (
            <View key={i} style={styles.stepEditRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{i + 1}</Text></View>
              <TextInput style={[styles.input, styles.stepInput]} value={step} onChangeText={v => updStep(i, v)} multiline placeholder={`Step ${i + 1}...`} />
              {editSteps.length > 1 && <Pressable onPress={() => remStep(i)}><Text style={styles.remTxt}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addStep} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add step</Text></Pressable>
        </> : <>
          {editSections.map((sec, si) => (
            <View key={si} style={styles.sectionEditBlock}>
              <View style={styles.sectionEditHeader}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={sec.name} onChangeText={v => updSectionName(si, v)} placeholder={`Section ${si + 1} name`} />
                {editSections.length > 1 && <Pressable onPress={() => remSection(si)} style={{ padding: 8 }}><Text style={styles.remTxt}>✕</Text></Pressable>}
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
                <View key={ii} style={styles.ingEditRow}>
                  <TextInput style={[styles.input, styles.ingAmount]} value={ing.amount} onChangeText={v => updSecIng(si, ii, 'amount', v)} placeholder="Amt" />
                  <TextInput style={[styles.input, styles.ingUnit]} value={ing.unit} onChangeText={v => updSecIng(si, ii, 'unit', v)} placeholder="Unit" />
                  <TextInput style={[styles.input, styles.ingNameF]} value={ing.name} onChangeText={v => updSecIng(si, ii, 'name', v)} placeholder="Ingredient" />
                  {sec.ingredients.length > 1 && <Pressable onPress={() => remSecIng(si, ii)}><Text style={styles.remTxt}>✕</Text></Pressable>}
                </View>
              ))}
              <Pressable onPress={() => addSecIng(si)} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add ingredient</Text></Pressable>
              <Text style={styles.subLabel}>Directions</Text>
              {sec.steps.map((step, ii) => (
                <View key={ii} style={styles.stepEditRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumTxt}>{ii + 1}</Text></View>
                  <TextInput style={[styles.input, styles.stepInput]} value={step} onChangeText={v => updSecStep(si, ii, v)} multiline placeholder={`Step ${ii + 1}...`} />
                  {sec.steps.length > 1 && <Pressable onPress={() => remSecStep(si, ii)}><Text style={styles.remTxt}>✕</Text></Pressable>}
                </View>
              ))}
              <Pressable onPress={() => addSecStep(si)} style={styles.addRowBtn}><Text style={styles.addRowBtnTxt}>+ Add step</Text></Pressable>
            </View>
          ))}
          <Pressable style={styles.addSectionBtn} onPress={addSection}>
            <Text style={styles.addSectionBtnTxt}>+ Add section</Text>
          </Pressable>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 60 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  backBtn: {},
  backTxt: { fontSize: font.md, color: colors.textSecondary },
  topActions: { flexDirection: 'row', gap: 10 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  editBtnTxt: { color: colors.primaryDark, fontWeight: '600', fontSize: font.sm },
  deleteBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FEF0EC', borderRadius: radius.sm },
  deleteBtnTxt: { color: colors.danger, fontWeight: '600', fontSize: font.sm },
  image: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg },
  metaChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bgMuted, borderRadius: radius.full },
  metaChipTxt: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '500' },
  allIngBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primaryLight, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary },
  allIngBtnTxt: { fontSize: font.sm, color: colors.primaryDark, fontWeight: '600' },
  allIngCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  allIngTitle: { fontSize: font.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  allIngSection: { marginBottom: spacing.sm },
  allIngSectionName: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  sectionBlock: { marginBottom: spacing.lg },
  sectionHeader: { fontSize: font.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.primaryLight },
  sectionLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: 4 },
  ingRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  ingAmt: { fontSize: font.sm, color: colors.textMuted, minWidth: 100 },
  ingName: { fontSize: font.sm, color: colors.textPrimary, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumTxt: { fontSize: font.xs, fontWeight: '700', color: colors.primaryDark },
  stepTxt: { fontSize: font.sm, color: colors.textPrimary, flex: 1, lineHeight: 22 },
  empty: { fontSize: font.sm, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
  error: { fontSize: font.md, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  editHeading: { fontSize: font.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  subLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, color: colors.textPrimary, marginBottom: 8, backgroundColor: colors.bgCard },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  tagOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tagTxt: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '500' },
  tagTxtOn: { color: colors.primaryDark, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  toggle: { width: 36, height: 20, borderRadius: 10, backgroundColor: colors.border },
  toggleOn: { backgroundColor: colors.primary },
  sectionToggleTxt: { fontSize: font.sm, color: colors.textSecondary },
  ingEditRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 60, marginBottom: 0, flex: 0 },
  ingUnit: { width: 55, marginBottom: 0, flex: 0 },
  ingNameF: { flex: 1, marginBottom: 0 },
  stepEditRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepInput: { flex: 1, marginBottom: 0 },
  remTxt: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 4 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { color: colors.primary, fontSize: font.sm },
  sectionEditBlock: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sectionEditHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  importSearch: { backgroundColor: colors.bgMuted, borderColor: colors.borderStrong, marginBottom: 4 },
  importResults: { backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden' },
  importRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  importName: { fontSize: font.sm, fontWeight: '600', color: colors.textPrimary },
  importMeta: { fontSize: font.xs, color: colors.textMuted },
  importAction: { fontSize: font.sm, color: colors.primary, fontWeight: '700' },
  importEmpty: { fontSize: font.xs, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },
  addSectionBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginTop: 4 },
  addSectionBtnTxt: { color: colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 9 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
});
