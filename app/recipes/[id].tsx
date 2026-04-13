import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { shareContent } from '@/lib/share';
import { useLocalSearchParams, useRouter } from 'expo-router';
import KeyboardScrollView from '@/components/KeyboardScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipeById, updateCustomRecipe, deleteCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import type { Recipe, Ingredient, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font } from '@/constants/theme';

const EFFORT_LABEL: Record<string, string> = {
  quick: 'Quick (< 30 min)', medium: 'Medium (30–60 min)', weekend: 'Weekend project',
};

type EditSection = { name: string; ingredients: Ingredient[]; steps: string[] };

function recipeToEdit(recipe: Recipe) {
  const hasSections = (recipe.sections ?? []).length > 0;
  return {
    name: recipe.name, cuisine: recipe.cuisine, effort: recipe.effort as EffortLevel,
    servings: String(recipe.servings), readyInMinutes: String(recipe.readyInMinutes),
    ingredients: recipe.ingredients.length ? recipe.ingredients : [{ amount: '', unit: '', name: '' }],
    steps: recipe.steps.length ? recipe.steps.map(s => s.step) : [''],
    sections: hasSections
      ? recipe.sections!.map(s => ({ name: s.name, ingredients: s.ingredients.length ? s.ingredients : [{ amount: '', unit: '', name: '' }], steps: s.steps.length ? s.steps.map(st => st.step) : [''] }))
      : [{ name: '', ingredients: [{ amount: '', unit: '', name: '' }], steps: [''] }],
    useSections: hasSections,
  };
}

export default function RecipeDetail() {
  const router = useRouter();
  const { colors } = useTheme();
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

  function importSectionRecipe(si: number, r: Recipe) {
    setEditSections(prev => prev.map((s, idx) => idx === si ? { name: r.name, ingredients: r.ingredients.length ? r.ingredients : [{ amount: '', unit: '', name: '' }], steps: r.steps.length ? r.steps.map(st => st.step) : [''] } : s));
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
  const updSecIng = (si: number, ii: number, f: keyof Ingredient, v: string) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.map((x, jdx) => jdx === ii ? { ...x, [f]: v } : x) } : s));
  const addSecIng = (si: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: [...s.ingredients, { amount: '', unit: '', name: '' }] } : s));
  const remSecIng = (si: number, ii: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, ingredients: s.ingredients.filter((_, jdx) => jdx !== ii) } : s));
  const updSecStep = (si: number, ii: number, v: string) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.map((x, jdx) => jdx === ii ? v : x) } : s));
  const addSecStep = (si: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: [...s.steps, ''] } : s));
  const remSecStep = (si: number, ii: number) => setEditSections(prev => prev.map((s, idx) => idx === si ? { ...s, steps: s.steps.filter((_, jdx) => jdx !== ii) } : s));

  async function handleSave() {
    if (!id || !recipe) return;
    setSaving(true);
    try {
      const cleaned = useSections
        ? { ...recipe, name: editName.trim(), cuisine: editCuisine, effort: editEffort, servings: parseInt(editServings) || 2, readyInMinutes: parseInt(editMinutes) || 0, ingredients: [], steps: [], sections: editSections.map(s => ({ name: s.name, ingredients: s.ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })), steps: s.steps.filter(x => x.trim()).map((x, idx) => ({ number: idx + 1, step: x.trim() })) })) }
        : { ...recipe, name: editName.trim(), cuisine: editCuisine, effort: editEffort, servings: parseInt(editServings) || 2, readyInMinutes: parseInt(editMinutes) || 0, ingredients: editIngredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })), steps: editSteps.filter(s => s.trim()).map((s, idx) => ({ number: idx + 1, step: s.trim() })), sections: [] };
      const updated = await updateCustomRecipe(id, cleaned);
      setRecipe(updated); setEditing(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!id) return;
    Alert.alert('Delete recipe', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCustomRecipe(id); router.back(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  async function handleShare() {
    if (!recipe) return;
    const EFFORT: Record<string, string> = { quick: '⚡ Quick', medium: '👨‍🍳 Medium', weekend: '🌟 Weekend' };
    const lines: string[] = [];

    lines.push(`🍽️ ${recipe.name}`);
    lines.push(`${recipe.cuisine} · ${EFFORT[recipe.effort] ?? recipe.effort}${recipe.readyInMinutes > 0 ? ` · ${recipe.readyInMinutes} min` : ''} · Serves ${recipe.servings}`);
    lines.push('');

    const hasSections = (recipe.sections ?? []).length > 0;

    if (hasSections) {
      for (const section of recipe.sections!) {
        lines.push(`── ${section.name} ──`);
        lines.push('Ingredients:');
        section.ingredients.forEach(ing => {
          lines.push(`  • ${[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}`);
        });
        lines.push('');
        lines.push('Steps:');
        section.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s.step}`));
        lines.push('');
      }
    } else {
      lines.push('Ingredients:');
      recipe.ingredients.forEach(ing => {
        lines.push(`  • ${[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}`);
      });
      lines.push('');
      lines.push('Steps:');
      recipe.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s.step ?? (s as any)}`));
    }

    try {
      await shareContent(lines.join('
'), recipe.name);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  // Shared input style helper
  const inputStyle = [styles.input, { borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }];

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>;

  if (!recipe) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}><Text style={[styles.backTxt, { color: colors.primary }]}>←</Text></Pressable>
      <Text style={[styles.error, { color: colors.textMuted }]}>Recipe not found.</Text>
    </SafeAreaView>
  );

  if (!editing) {
    const hasSections = (recipe.sections ?? []).length > 0;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}><Text style={[styles.backTxt, { color: colors.primary }]}>←</Text></Pressable>
            <View style={styles.topActions}>
              <Pressable onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.bgMuted, borderColor: colors.border }]}>
                <Text style={{ fontSize: 16 }}>↑</Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(true); ensureImportableLoaded(); }} style={[styles.editBtn, { backgroundColor: colors.primaryLight }]}><Text style={[styles.editBtnTxt, { color: colors.primaryDark }]}>Edit</Text></Pressable>
              <Pressable onPress={handleDelete} style={[styles.deleteActionBtn, { backgroundColor: colors.dangerLight }]}><Text style={[styles.deleteBtnTxt, { color: colors.danger }]}>Delete</Text></Pressable>
            </View>
          </View>

          {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{recipe.name}</Text>
          <View style={styles.metaRow}>
            {[recipe.cuisine, EFFORT_LABEL[recipe.effort], recipe.readyInMinutes > 0 ? `⏱ ${recipe.readyInMinutes} min` : null, `👤 ${recipe.servings}`].filter(Boolean).map((m, i) => (
              <View key={i} style={[styles.metaChip, { backgroundColor: colors.bgMuted }]}><Text style={[styles.metaChipTxt, { color: colors.textSecondary }]}>{m}</Text></View>
            ))}
          </View>

          {hasSections && (
            <Pressable style={[styles.allIngBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setShowAllIngredients(v => !v)}>
              <Text style={[styles.allIngBtnTxt, { color: colors.primaryDark }]}>{showAllIngredients ? '▲ Hide shopping list' : '▼ Show all ingredients'}</Text>
            </Pressable>
          )}
          {hasSections && showAllIngredients && (
            <View style={[styles.allIngCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.allIngTitle, { color: colors.primary }]}>All Ingredients</Text>
              {recipe.sections!.map((sec, si) => sec.ingredients.length > 0 && (
                <View key={si} style={styles.allIngSection}>
                  {sec.name ? <Text style={[styles.allIngSectionName, { color: colors.textMuted }]}>{sec.name}</Text> : null}
                  {sec.ingredients.map((ing, i) => (
                    <View key={i} style={[styles.ingRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                      <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {hasSections ? recipe.sections!.map((sec, si) => (
            <View key={si} style={styles.sectionBlock}>
              {sec.name ? <Text style={[styles.sectionHeader, { color: colors.textPrimary, borderBottomColor: colors.primaryLight }]}>{sec.name}</Text> : null}
              {sec.ingredients.length > 0 && <>
                <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Ingredients</Text>
                {sec.ingredients.map((ing, i) => (
                  <View key={i} style={[styles.ingRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                  </View>
                ))}
              </>}
              {sec.steps.length > 0 && <>
                <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Directions</Text>
                {sec.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{step.number}</Text></View>
                    <Text style={[styles.stepTxt, { color: colors.textPrimary }]}>{step.step}</Text>
                  </View>
                ))}
              </>}
            </View>
          )) : <>
            <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Ingredients</Text>
            {recipe.ingredients.length === 0
              ? <Text style={[styles.empty, { color: colors.textMuted }]}>No ingredients listed.</Text>
              : recipe.ingredients.map((ing, i) => (
                  <View key={i} style={[styles.ingRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                  </View>
                ))
            }
            <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Directions</Text>
            {recipe.steps.length === 0
              ? <Text style={[styles.empty, { color: colors.textMuted }]}>No steps listed.</Text>
              : recipe.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{step.number}</Text></View>
                    <Text style={[styles.stepTxt, { color: colors.textPrimary }]}>{step.step}</Text>
                  </View>
                ))
            }
          </>}
        </KeyboardScrollView>
      </SafeAreaView>
    );
  }

  // EDIT MODE
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
        <View style={styles.topRow}>
          <Pressable onPress={() => setEditing(false)} style={[styles.backBtn, { backgroundColor: colors.themeBtnBg, borderColor: colors.themeBtnBorder }]}><Text style={[styles.backTxt, { color: colors.primary }]}>←</Text></Pressable>
          <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnTxt}>Save</Text>}
          </Pressable>
        </View>
        <Text style={[styles.editHeading, { color: colors.textPrimary }]}>Edit Recipe</Text>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Name</Text>
        <TextInput style={inputStyle} value={editName} onChangeText={setEditName} />

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => {
            const on = editCuisine === c;
            return (
              <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => setEditCuisine(c)}>
                <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Effort</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = editEffort === value;
            return (
              <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.bg, borderColor: on ? colors.chipOnBorder : colors.border }]} onPress={() => setEditEffort(value)}>
                <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.textSecondary, fontWeight: on ? '600' : '500' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>Ready in (min)</Text>
            <TextInput style={inputStyle} value={editMinutes} onChangeText={setEditMinutes} keyboardType="number-pad" />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.sectionLabel }]}>Servings</Text>
            <TextInput style={inputStyle} value={editServings} onChangeText={setEditServings} keyboardType="number-pad" />
          </View>
        </View>

        <Pressable style={[styles.sectionToggle, { borderTopColor: colors.border, borderBottomColor: colors.border }]} onPress={() => { setUseSections(v => !v); ensureImportableLoaded(); }}>
          <View style={[styles.toggle, { backgroundColor: useSections ? colors.primary : colors.border }]} />
          <Text style={[styles.sectionToggleTxt, { color: colors.textSecondary }]}>Use sections</Text>
        </Pressable>

        {!useSections ? <>
          <Text style={[styles.label, { color: colors.sectionLabel }]}>Ingredients</Text>
          {editIngredients.map((ing, i) => (
            <View key={i} style={styles.ingEditRow}>
              <TextInput style={[inputStyle, styles.ingAmount, { marginBottom: 0 }]} value={ing.amount} onChangeText={v => updIng(i, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
              <TextInput style={[inputStyle, styles.ingUnit, { marginBottom: 0 }]} value={ing.unit} onChangeText={v => updIng(i, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
              <TextInput style={[inputStyle, styles.ingNameF, { marginBottom: 0 }]} value={ing.name} onChangeText={v => updIng(i, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
              {editIngredients.length > 1 && <Pressable onPress={() => remIng(i)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addIng} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add ingredient</Text></Pressable>

          <Text style={[styles.label, { color: colors.sectionLabel, marginTop: spacing.md }]}>Directions</Text>
          {editSteps.map((step, i) => (
            <View key={i} style={styles.stepEditRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{i + 1}</Text></View>
              <TextInput style={[inputStyle, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updStep(i, v)} multiline placeholder={`Step ${i + 1}...`} placeholderTextColor={colors.textMuted} />
              {editSteps.length > 1 && <Pressable onPress={() => remStep(i)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
            </View>
          ))}
          <Pressable onPress={addStep} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add step</Text></Pressable>
        </> : <>
          {editSections.map((sec, si) => (
            <View key={si} style={[styles.sectionEditBlock, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.sectionEditHeader}>
                <TextInput style={[inputStyle, { flex: 1, marginBottom: 0 }]} value={sec.name} onChangeText={v => updSectionName(si, v)} placeholder={`Section ${si + 1} name`} placeholderTextColor={colors.textMuted} />
                {editSections.length > 1 && <Pressable onPress={() => remSection(si)} style={{ padding: 8 }}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
              </View>
              <TextInput style={[inputStyle, { backgroundColor: colors.bgMuted, borderColor: colors.borderStrong }]} placeholder="Import from a spice mix or sauce..." placeholderTextColor={colors.textMuted} value={sectionSearchQuery[si] ?? ''} onChangeText={v => handleSectionSearch(si, v)} onFocus={ensureImportableLoaded} />
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
                <View key={ii} style={styles.ingEditRow}>
                  <TextInput style={[inputStyle, styles.ingAmount, { marginBottom: 0 }]} value={ing.amount} onChangeText={v => updSecIng(si, ii, 'amount', v)} placeholder="Amt" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[inputStyle, styles.ingUnit, { marginBottom: 0 }]} value={ing.unit} onChangeText={v => updSecIng(si, ii, 'unit', v)} placeholder="Unit" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[inputStyle, styles.ingNameF, { marginBottom: 0 }]} value={ing.name} onChangeText={v => updSecIng(si, ii, 'name', v)} placeholder="Ingredient" placeholderTextColor={colors.textMuted} />
                  {sec.ingredients.length > 1 && <Pressable onPress={() => remSecIng(si, ii)}><Text style={[styles.remTxt, { color: colors.textMuted }]}>✕</Text></Pressable>}
                </View>
              ))}
              <Pressable onPress={() => addSecIng(si)} style={styles.addRowBtn}><Text style={[styles.addRowBtnTxt, { color: colors.primary }]}>+ Add ingredient</Text></Pressable>
              <Text style={[styles.subLabel, { color: colors.sectionLabel }]}>Directions</Text>
              {sec.steps.map((step, ii) => (
                <View key={ii} style={styles.stepEditRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primaryLight }]}><Text style={[styles.stepNumTxt, { color: colors.primaryDark }]}>{ii + 1}</Text></View>
                  <TextInput style={[inputStyle, styles.stepInput, { marginBottom: 0 }]} value={step} onChangeText={v => updSecStep(si, ii, v)} multiline placeholder={`Step ${ii + 1}...`} placeholderTextColor={colors.textMuted} />
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
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  topActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  shareBtn: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  editBtnTxt: { fontWeight: '600', fontSize: font.sm },
  deleteActionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  deleteBtnTxt: { fontWeight: '600', fontSize: font.sm },
  image: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '700', marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg },
  metaChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  metaChipTxt: { fontSize: font.xs, fontWeight: '500' },
  allIngBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1 },
  allIngBtnTxt: { fontSize: font.sm, fontWeight: '600' },
  allIngCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  allIngTitle: { fontSize: font.sm, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  allIngSection: { marginBottom: spacing.sm },
  allIngSectionName: { fontSize: font.xs, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  sectionBlock: { marginBottom: spacing.lg },
  sectionHeader: { fontSize: font.lg, fontWeight: '700', marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 2 },
  sectionLabel: { fontSize: font.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginTop: 4 },
  ingRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, gap: 12 },
  ingAmt: { fontSize: font.sm, minWidth: 100 },
  ingName: { fontSize: font.sm, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumTxt: { fontSize: font.xs, fontWeight: '700' },
  stepTxt: { fontSize: font.sm, flex: 1, lineHeight: 22 },
  empty: { fontSize: font.sm, fontStyle: 'italic', marginBottom: spacing.md },
  error: { fontSize: font.md, textAlign: 'center', marginTop: 40 },
  editHeading: { fontSize: font.xl, fontWeight: '700', marginBottom: spacing.lg },
  label: { fontSize: font.xs, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
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
  ingEditRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 60, flex: 0 },
  ingUnit: { width: 55, flex: 0 },
  ingNameF: { flex: 1 },
  stepEditRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepInput: { flex: 1 },
  remTxt: { fontSize: 16, paddingHorizontal: 4 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { fontSize: font.sm },
  sectionEditBlock: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  sectionEditHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  importResults: { borderWidth: 1.5, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden' },
  importRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  importName: { fontSize: font.sm, fontWeight: '600' },
  importMeta: { fontSize: font.xs },
  importAction: { fontSize: font.sm, fontWeight: '700' },
  addSectionBtn: { borderWidth: 1.5, borderRadius: radius.md, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginTop: 4 },
  addSectionBtnTxt: { fontWeight: '600' },
  saveBtn: { borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 9 },
  saveBtnTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
});
