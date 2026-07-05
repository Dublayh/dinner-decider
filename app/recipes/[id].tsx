import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { shareContent } from '@/lib/share';
import { useLocalSearchParams, useRouter } from 'expo-router';
import KeyboardScrollView from '@/components/KeyboardScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomRecipeById, updateCustomRecipe, deleteCustomRecipe, getCustomRecipes } from '@/lib/customRecipes';
import { addRecipeToGroceryList, deleteGroceryItemsBySource, getGroceryItems } from '@/lib/groceryList';
import { supabase } from '@/lib/supabase';
import type { Recipe, Ingredient, EffortLevel } from '@/types';
import { CUISINE_OPTIONS, EFFORT_OPTIONS } from '@/types';
import { useAppAlert, AppToast, AppConfirmDialog } from '@/components/AppDialog';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, font, type, hardShadow } from '@/constants/theme';

const EFFORT_LABEL: Record<string, string> = {
  quick: 'Quick (< 30 min)', medium: 'Medium (30–60 min)', long: 'Long (1–3 hrs)', weekend: 'Weekend project',
};

// Parse amount string to a number (handles "1/2", "1 1/2", "2-3", decimals)
function parseAmount(amt: string): number | null {
  if (!amt?.trim()) return null;
  const s = amt.trim();
  // Range like "2-3" — use the lower
  const range = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (range) return parseFloat(range[1]);
  // Mixed number like "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  // Simple fraction like "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  // Plain number
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

// Format a number back to a nice fraction/decimal string
function formatAmount(n: number): string {
  if (n === Math.floor(n)) return String(n);
  const fractions: [number, string][] = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'],
    [0.667, '⅔'], [0.75, '¾'],
  ];
  const whole = Math.floor(n);
  const dec = n - whole;
  for (const [val, sym] of fractions) {
    if (Math.abs(dec - val) < 0.05) {
      return whole > 0 ? `${whole} ${sym}` : sym;
    }
  }
  return n.toFixed(1).replace(/\.0$/, '');
}

function scaleAmount(amount: string, _base: number, multiplier: number): string {
  if (multiplier === 1) return amount;
  const parsed = parseAmount(amount);
  if (parsed === null) return amount;
  return formatAmount(parsed * multiplier);
}

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
  const { showToast, showConfirm, toast, confirm, dismissConfirm } = useAppAlert();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [scale, setScale] = useState(1);
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
  const [onList, setOnList] = useState(false); // recipe's ingredients currently on the shopping list

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
        setScale(1);
        setEditImageUrl(r.imageUrl ?? '');
        const e = recipeToEdit(r);
        setEditName(e.name); setEditCuisine(e.cuisine); setEditEffort(e.effort);
        setEditServings(e.servings); setEditMinutes(e.readyInMinutes);
        setEditIngredients(e.ingredients); setEditSteps(e.steps);
        setEditSections(e.sections); setUseSections(e.useSections);
        getGroceryItems().then(items => setOnList(items.some(i => i.source === r.name))).catch(() => {});
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

  async function handlePickImage() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showToast('Please allow photo access.', 'error'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `recipe-${id}-${Date.now()}.${ext}`;

      // Fetch the image and upload to Supabase Storage
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from('recipe-images')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(fileName);
      setEditImageUrl(publicUrl);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!id || !recipe) return;
    setSaving(true);
    try {
      const cleaned = useSections
        ? { ...recipe, name: editName.trim(), cuisine: editCuisine, effort: editEffort, servings: parseInt(editServings) || 2, readyInMinutes: parseInt(editMinutes) || 0, imageUrl: editImageUrl || undefined, ingredients: [], steps: [], sections: editSections.map(s => ({ name: s.name, ingredients: s.ingredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })), steps: s.steps.filter(x => x.trim()).map((x, idx) => ({ number: idx + 1, step: x.trim() })) })) }
        : { ...recipe, name: editName.trim(), cuisine: editCuisine, effort: editEffort, servings: parseInt(editServings) || 2, readyInMinutes: parseInt(editMinutes) || 0, imageUrl: editImageUrl || undefined, ingredients: editIngredients.filter(i => i.name.trim()).map(i => ({ amount: i.amount.trim(), unit: i.unit.trim(), name: i.name.trim() })), steps: editSteps.filter(s => s.trim()).map((s, idx) => ({ number: idx + 1, step: s.trim() })), sections: [] };
      const updated = await updateCustomRecipe(id, cleaned);
      setRecipe(updated); setEditing(false);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!id) return;
    showConfirm('Delete recipe', 'Are you sure? This cannot be undone.', async () => {
      try { await deleteCustomRecipe(id); router.back(); }
      catch (e: any) { showToast(e.message, 'error'); }
    }, { label: 'Delete', destructive: true });
  }

  async function handleAddToList() {
    if (!recipe) return;
    try {
      const n = await addRecipeToGroceryList(recipe, scale);
      if (n === 0) { showToast('No ingredients to add.', 'info'); return; }
      setOnList(true);
      showToast(
        `Added ${n} item${n === 1 ? '' : 's'}${scale > 1 ? ` (${scale}x)` : ''} to shopping list`,
        'success',
        { label: 'Undo', onPress: () => undoAddToList(recipe.name) },
      );
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function undoAddToList(source: string) {
    try {
      await deleteGroceryItemsBySource(source);
      setOnList(false);
      showToast('Removed from shopping list', 'info');
    } catch (e: any) { showToast(e.message, 'error'); }
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
      const text = lines.join('\n');
      await shareContent(text, recipe.name);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  // Shared input style helper
  const inputStyle = [styles.input, { borderColor: colors.border, backgroundColor: colors.bgCard, color: colors.textPrimary }];

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} /></SafeAreaView>;

  if (!recipe) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} action={toast?.action} />
      {confirm && <AppConfirmDialog visible title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} confirmDestructive={confirm.destructive} onConfirm={confirm.onConfirm} onCancel={dismissConfirm} />}
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}><Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text></Pressable>
      <Text style={[styles.error, { color: colors.textMuted }]}>Recipe not found.</Text>
    </SafeAreaView>
  );

  if (!editing) {
    const hasSections = (recipe.sections ?? []).length > 0;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} action={toast?.action} />
      {confirm && <AppConfirmDialog visible title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} confirmDestructive={confirm.destructive} onConfirm={confirm.onConfirm} onCancel={dismissConfirm} />}
        <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}><Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text></Pressable>
            <View style={styles.topActions}>
              <Pressable onPress={handleAddToList} style={[styles.shareBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
                <Text style={{ fontSize: 16 }}>🛒</Text>
                {onList && <View style={[styles.listDot, { backgroundColor: colors.primary, borderColor: colors.bg }]} />}
              </Pressable>
              <Pressable onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
                <Text style={{ fontSize: 16 }}>↑</Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(true); ensureImportableLoaded(); }} style={[styles.editBtn, { backgroundColor: colors.ink, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}><Text style={[styles.editBtnTxt, { color: colors.stampText }]}>EDIT</Text></Pressable>
              <Pressable onPress={handleDelete} style={[styles.deleteActionBtn, { backgroundColor: colors.bgCard, borderColor: colors.danger }, hardShadow(colors.shadow, 2)]}><Text style={[styles.deleteBtnTxt, { color: colors.danger }]}>DELETE</Text></Pressable>
            </View>
          </View>

          {recipe.imageUrl && <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{recipe.name}</Text>
          <View style={styles.metaRow}>
            {[recipe.cuisine, EFFORT_LABEL[recipe.effort], recipe.readyInMinutes > 0 ? `⏱ ${recipe.readyInMinutes} min` : null].filter(Boolean).map((m, i) => (
              <View key={i} style={[styles.metaChip, { borderColor: colors.borderStrong }]}><Text style={[styles.metaChipTxt, { color: colors.textSecondary }]}>{String(m).toUpperCase()}</Text></View>
            ))}
            <View style={[styles.scaleGroup, { borderColor: colors.ink, backgroundColor: colors.bgCard }]}>
              {[1, 2, 3].map(s => (
                <Pressable
                  key={s}
                  onPress={() => setScale(s)}
                  style={[styles.scaleBtn, scale === s && { backgroundColor: colors.ink }]}
                >
                  <Text style={[styles.scaleBtnTxt, { color: scale === s ? colors.stampText : colors.textSecondary }]}>{s}×</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {(recipe.steps.length > 0 || (recipe.sections ?? []).some(s => s.steps.length > 0)) && (
            <Pressable
              onPress={() => router.push(`/cook/${id}?scale=${scale}`)}
              style={[styles.cookBtn, { backgroundColor: colors.primary, borderColor: colors.ink }, hardShadow(colors.shadow, 3)]}
            >
              <Text style={styles.cookBtnTxt}>▶  START COOKING</Text>
            </Pressable>
          )}

          {hasSections && (
            <Pressable style={[styles.allIngBtn, { borderColor: colors.ink }]} onPress={() => setShowAllIngredients(v => !v)}>
              <Text style={[styles.allIngBtnTxt, { color: colors.textPrimary }]}>{showAllIngredients ? '▲ HIDE SHOPPING LIST' : '▼ SHOW ALL INGREDIENTS'}</Text>
            </Pressable>
          )}
          {hasSections && showAllIngredients && (
            <View style={[styles.allIngCard, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}>
              <Text style={[styles.allIngTitle, { color: colors.primary }]}>ALL INGREDIENTS</Text>
              {recipe.sections!.map((sec, si) => sec.ingredients.length > 0 && (
                <View key={si} style={styles.allIngSection}>
                  {sec.name ? <Text style={[styles.allIngSectionName, { color: colors.textMuted }]}>{sec.name}</Text> : null}
                  {sec.ingredients.map((ing, i) => (
                    <View key={i} style={[styles.ingRow, { borderBottomColor: colors.line }]}>
                      <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{scaleAmount(ing.amount, 1, scale)}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                      <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {hasSections ? recipe.sections!.map((sec, si) => (
            <View key={si} style={styles.sectionBlock}>
              {sec.name ? <Text style={[styles.sectionHeader, { color: colors.textPrimary, borderBottomColor: colors.ink }]}>{sec.name}</Text> : null}
              {sec.ingredients.length > 0 && <>
                <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Ingredients</Text>
                {sec.ingredients.map((ing, i) => (
                  <View key={i} style={[styles.ingRow, { borderBottomColor: colors.line }]}>
                    <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{scaleAmount(ing.amount, 1, scale)}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                  </View>
                ))}
              </>}
              {sec.steps.length > 0 && <>
                <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Directions</Text>
                {sec.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={[styles.stepNum, { borderColor: colors.ink }]}><Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{step.number}</Text></View>
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
                  <View key={i} style={[styles.ingRow, { borderBottomColor: colors.line }]}>
                    <Text style={[styles.ingAmt, { color: colors.textMuted }]}>{scaleAmount(ing.amount, 1, scale)}{ing.unit ? ` ${ing.unit}` : ''}</Text>
                    <Text style={[styles.ingName, { color: colors.textPrimary }]}>{ing.name}</Text>
                  </View>
                ))
            }
            <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Directions</Text>
            {recipe.steps.length === 0
              ? <Text style={[styles.empty, { color: colors.textMuted }]}>No steps listed.</Text>
              : recipe.steps.map(step => (
                  <View key={step.number} style={styles.stepRow}>
                    <View style={[styles.stepNum, { borderColor: colors.ink }]}><Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{step.number}</Text></View>
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
      <AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} action={toast?.action} />
      {confirm && <AppConfirmDialog visible title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} confirmDestructive={confirm.destructive} onConfirm={confirm.onConfirm} onCancel={dismissConfirm} />}
      <KeyboardScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" enableOnAndroid enableAutomaticScroll extraScrollHeight={120} keyboardOpeningTime={0}>
        <View style={styles.topRow}>
          <Pressable onPress={() => setEditing(false)} style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.ink }, hardShadow(colors.shadow, 2)]}><Text style={[styles.backTxt, { color: colors.textPrimary }]}>←</Text></Pressable>
          <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary, borderColor: colors.ink, opacity: saving ? 0.6 : 1 }, hardShadow(colors.shadow, 3)]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF6E8" size="small" /> : <Text style={styles.saveBtnTxt}>SAVE</Text>}
          </Pressable>
        </View>
        <Text style={[styles.editHeading, { color: colors.textPrimary }]}>Edit Recipe</Text>

        {/* Photo */}
        <Text style={[styles.label, { color: colors.sectionLabel }]}>Photo</Text>
        <Pressable
          style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
          onPress={handlePickImage}
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <ActivityIndicator color={colors.primary} />
          ) : editImageUrl ? (
            <Image source={{ uri: editImageUrl }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <Text style={[styles.imagePickerTxt, { color: colors.textMuted }]}>📷 Tap to add a photo</Text>
          )}
        </Pressable>
        {editImageUrl ? (
          <Pressable onPress={() => setEditImageUrl('')} style={styles.removeImageBtn}>
            <Text style={[styles.removeImageTxt, { color: colors.danger }]}>✕ Remove photo</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Name</Text>
        <TextInput style={inputStyle} value={editName} onChangeText={setEditName} />

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Cuisine</Text>
        <View style={styles.tagRow}>
          {CUISINE_OPTIONS.map(c => {
            const on = editCuisine === c;
            return (
              <Pressable key={c} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => setEditCuisine(c)}>
                <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.sectionLabel }]}>Effort</Text>
        <View style={styles.tagRow}>
          {EFFORT_OPTIONS.map(({ label, value }) => {
            const on = editEffort === value;
            return (
              <Pressable key={value} style={[styles.tag, { backgroundColor: on ? colors.chipOnBg : colors.chipBg, borderColor: colors.chipBorder }]} onPress={() => setEditEffort(value)}>
                <Text style={[styles.tagTxt, { color: on ? colors.chipOnText : colors.chipText, fontFamily: on ? type.monoBold : type.mono }]}>{label}</Text>
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
              <View style={[styles.stepNum, { borderColor: colors.ink }]}><Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{i + 1}</Text></View>
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
                  <View style={[styles.stepNum, { borderColor: colors.ink }]}><Text style={[styles.stepNumTxt, { color: colors.textPrimary }]}>{ii + 1}</Text></View>
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
  backBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 18, lineHeight: 21 },
  topActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  shareBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  listDot: { position: 'absolute', top: -4, right: -4, width: 11, height: 11, borderRadius: radius.sm, borderWidth: 1.5 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1.5 },
  editBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5 },
  deleteActionBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1.5 },
  deleteBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5 },
  image: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: spacing.md },
  imagePicker: { width: '100%', height: 180, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerTxt: { fontFamily: type.serifItalic, fontSize: font.sm },
  removeImageBtn: { alignItems: 'center', marginBottom: spacing.md },
  removeImageTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: type.serifBlack, fontSize: 30, lineHeight: 36, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  metaChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1 },
  metaChipTxt: { fontFamily: type.mono, fontSize: 9, letterSpacing: 0.5 },
  scaleGroup: { flexDirection: 'row', borderRadius: radius.sm, borderWidth: 1.5, overflow: 'hidden' },
  scaleBtn: { paddingHorizontal: 16, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  scaleBtnTxt: { fontFamily: type.monoBold, fontSize: 11 },
  cookBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1.5, marginBottom: spacing.lg },
  cookBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
  allIngBtn: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1.5, borderStyle: 'dashed' },
  allIngBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1.5 },
  allIngCard: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.lg },
  allIngTitle: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2, marginBottom: spacing.sm },
  allIngSection: { marginBottom: spacing.sm },
  allIngSectionName: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5, marginBottom: 4, textTransform: 'uppercase' },
  sectionBlock: { marginBottom: spacing.lg },
  sectionHeader: { fontFamily: type.serifBold, fontSize: 21, marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 2 },
  sectionLabel: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: 4 },
  ingRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, gap: 12 },
  ingAmt: { fontFamily: type.mono, fontSize: 12, lineHeight: 19, minWidth: 100 },
  ingName: { fontFamily: type.serif, fontSize: font.md, lineHeight: 20, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  stepNum: { width: 26, height: 26, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumTxt: { fontFamily: type.monoBold, fontSize: 11 },
  stepTxt: { fontFamily: type.serif, fontSize: font.md, flex: 1, lineHeight: 24 },
  empty: { fontFamily: type.serifItalic, fontSize: font.sm, marginBottom: spacing.md },
  error: { fontFamily: type.serifItalic, fontSize: font.md, textAlign: 'center', marginTop: 40 },
  editHeading: { fontFamily: type.serifBlack, fontSize: 26, marginBottom: spacing.lg },
  label: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  subLabel: { fontFamily: type.monoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.sm, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  tag: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1.5 },
  tagTxt: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  toggle: { width: 36, height: 20, borderRadius: radius.sm },
  sectionToggleTxt: { fontFamily: type.serif, fontSize: font.sm },
  ingEditRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  ingAmount: { width: 60, flex: 0 },
  ingUnit: { width: 55, flex: 0 },
  ingNameF: { flex: 1 },
  stepEditRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepInput: { flex: 1 },
  remTxt: { fontSize: 16, paddingHorizontal: 4 },
  addRowBtn: { marginBottom: 4 },
  addRowBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  sectionEditBlock: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5 },
  sectionEditHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  importResults: { borderWidth: 1.5, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden' },
  importRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  importName: { fontFamily: type.serifSemi, fontSize: font.sm },
  importMeta: { fontFamily: type.mono, fontSize: 9, letterSpacing: 0.5 },
  importAction: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  addSectionBtn: { borderWidth: 1.5, borderRadius: radius.md, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginTop: 4 },
  addSectionBtnTxt: { fontFamily: type.monoBold, fontSize: 10, letterSpacing: 1 },
  saveBtn: { borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 10 },
  saveBtnTxt: { color: '#FFF6E8', fontFamily: type.monoBold, fontSize: 11, letterSpacing: 1.5 },
});
