# Let's Eat! — Full Project Context

**A dinner decision app for couples.** Spins a wheel to decide what to eat (out or in), plans meals for the week, manages recipes, shared shopping list, and finds nearby restaurants.

---

## 1. What This App Is

- **Users**: Two people (owner + partner) sharing the same backend
- **Purpose**: Solve "what's for dinner?" for a couple through spinnable wheels, meal planning, and a shared shopping list
- **Platforms**:
  - **Android**: Native app built with Expo (dev client)
  - **PWA**: Web version deployed to `https://dublayh.github.io/`, installable to home screen on iPhone (owner uses Android app, partner uses PWA on iPhone)

Both platforms share the same Supabase backend so all data syncs in real time.

---

## 2. Tech Stack

- **Framework**: Expo SDK 54 (React Native 0.81.5)
- **Routing**: expo-router 6 (file-based routing in `app/`)
- **State**: Zustand ^5 (used sparingly for wheel/spin coordination)
- **Backend**: Supabase (Postgres, edge functions, storage, real-time subscriptions)
- **Native modules**:
  - `@shopify/react-native-skia` 2.2.12 — spinning wheel + hero glow (NATIVE ONLY, has web fallbacks)
  - `@gorhom/bottom-sheet` ^5 — bottom sheet on native (custom impl on web)
  - `react-native-gesture-handler` — swipe-to-delete on recipe cards
  - `react-native-reanimated` ~4.1.1 — animations
  - `react-native-webview` — hosts Leaflet map on native
  - `expo-image-picker` — photo upload for recipes
  - `expo-location` — for restaurant search
- **Pure JS libs**:
  - `react-native-keyboard-aware-scroll-view` — cross-platform keyboard handling
- **Web-specific**:
  - Leaflet (CDN) + OpenStreetMap tiles — for the restaurant map on web

---

## 3. Repository Setup

**Main repo**: `dinner-decider` (all app code, GitHub Actions workflows)
**PWA target repo**: `dublayh.github.io` (root user page — auto-deployed to from the main repo)

**Deploy flow**:
1. Push to `master` branch on `dinner-decider`
2. GitHub Action runs `expo export --platform web`
3. Post-processes the `dist/` folder (see workflow section below)
4. Force-pushes the built files to `main` branch on `dublayh.github.io` using a Personal Access Token stored in the secret `PAGES_TOKEN`
5. GitHub Pages serves `https://dublayh.github.io/`

**Why a separate repo**: The user tried deploying to `dublayh.github.io/dinner-decider/` (subdirectory) first — Expo's `baseUrl` config didn't apply consistently to script tags AND `uri:` paths in the bundle. Fighting subdirectory routing was miserable. Moving to root domain (`dublayh.github.io/`) via a separate repo removed all path prefixing issues.

---

## 4. Environment Variables

**Client (Expo)**:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Edge functions (server-side, set in Supabase dashboard)**:
- `GOOGLE_PLACES_API_KEY` — for restaurant search (Places API New must be enabled)
- `SPOONACULAR_API_KEY` — for recipe search

**GitHub secrets (used by Actions workflows)**:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `PAGES_TOKEN` — classic PAT with `repo` scope, used to push to the `dublayh.github.io` repo

---

## 5. Supabase Schema

All tables use `alter table ... enable row level security` + `create policy "allow all" ... for all using (true) with check (true)` since the app has no user auth (shared anon key for both users).

**Tables**:
- `custom_restaurants` — user-added restaurants that aren't in Google Places
- `custom_recipes` — user-added recipes (schema supports both flat `ingredients`/`steps` arrays and `sections` for multi-part recipes like curry paste + curry)
- `meal_plan` — one row per date, columns: `plan_date`, `type` (recipe/leftovers/eat_out/empty), `recipe_id`
- `favorite_restaurants` — starred restaurants from search results
- `grocery_list` — unified shopping list (all sources), columns: `id, text, amount, unit, checked, source ('manual' or recipe name), created_at`. Has real-time enabled: `alter publication supabase_realtime add table grocery_list;`
- `shopping_checks` — **DEPRECATED** — was old meal-plan-specific shopping check tracking, now unused since we unified into `grocery_list`

**Storage**:
- `recipe-images` bucket — public, has an "allow all" policy on `storage.objects`

---

## 6. Edge Functions

Located in `supabase/functions/`, deployed via `npx supabase functions deploy <name>`.

- **`nearby-restaurants`** — Wraps Google Places API v1 `searchNearby`. Client sends `{ lat, lng, radiusMiles, cuisines, vibes }`. Function converts miles→meters, maps cuisines to Google place types (`italian_restaurant`, `chinese_restaurant`, etc.), fetches, and returns normalized `{ id, name, address, rating, priceLevel, cuisineTypes, isCustom, websiteUri, location }`. **Important quirks**:
  - `textQuery` is NOT valid on `searchNearby` (only on `searchText`) — using it makes the whole request fail. We handle cuisines via `includedTypes` array instead.
  - Returns 500 with error message on failure. The client's `supabase.functions.invoke` throws for non-2xx, so `import-recipe-url` returns 200 even on errors (see below).
- **`search-recipes`** — Wraps Spoonacular recipe search
- **`import-recipe-url`** — Fetches a URL, extracts JSON-LD recipe schema, parses ingredients/steps, returns a normalized recipe object. Returns 200 with `{ error: "..." }` on failures so the toast can show the actual error message (not the generic "non 2xx status code" Supabase wraps failures in).

---

## 7. File Structure (Important Files)

```
app/
├── _layout.tsx              # Root layout - injects global CSS on web (removes focus outlines)
├── index.tsx                # Home screen - 3 cards (Eat Out / Eat In / Recipe Book) + top bar
├── meal-plan.tsx            # Meal plan week/month view + grocery list button
├── eat-in/
│   ├── filters.tsx          # Choose cuisine/effort/favorites → wheel
│   ├── wheel.tsx            # Spin wheel for recipes
│   └── recipe/add.tsx       # Quick-add recipe from eat-in flow
├── eat-out/
│   ├── filters.tsx          # Choose cuisine/vibes/radius → wheel OR map (two buttons)
│   ├── wheel.tsx            # Spin wheel for restaurants
│   └── map.tsx              # Map view of restaurants (uses RestaurantMap platform-switch)
└── recipes/
    ├── index.tsx            # Recipe book (list, search, filter, import JSON, import URL, export)
    ├── [id].tsx             # Recipe detail view (with edit mode, photo upload, scaling)
    └── add.tsx              # Add new recipe form

components/
├── AppDialog.tsx            # Shared: useAppAlert hook + AppToast + AppConfirmDialog components
├── GroceryListModal.tsx     # Shared grocery list (used from home 🛒 + meal plan)
├── SpinWheel.tsx            # Skia wheel (native)
├── SpinWheelWeb.tsx         # Canvas2D wheel (web) — has DPR scaling for retina
├── SpinWheelUniversal.tsx   # Platform switch
├── RestaurantMap.native.tsx # WebView + Leaflet HTML
├── RestaurantMap.web.tsx    # Leaflet loaded via CDN, uses <div> directly
├── KeyboardScrollView.tsx   # Platform switch: KeyboardAwareScrollView (native) / ScrollView (web)

lib/
├── supabase.ts              # Supabase client init
├── customRecipes.ts         # CRUD for custom_recipes table
├── customRestaurants.ts     # CRUD for custom_restaurants
├── favoriteRestaurants.ts   # CRUD for favorite_restaurants
├── mealPlan.ts              # CRUD for meal_plan (getShoppingChecks/saveShoppingChecks are legacy - unused)
├── groceryList.ts           # CRUD for grocery_list (getGroceryItems, addGroceryItem, addGroceryItems, toggleGroceryItem, deleteCheckedItems, clearAllItems)
├── places.ts                # fetchNearbyRestaurants + searchRestaurants + distanceBetween
├── amountUtils.ts           # parseAmount + formatAmount (fractions, mixed numbers, unicode ½ ⅓ ¼ etc.)
├── share.ts                 # shareContent — cross-platform share (Web Share API on web, native Share otherwise)
└── spoonacular.ts           # fetchRecipes wrapping the edge function

store/
└── wheelStore.ts            # Zustand stores: useEatOutStore, useEatInStore, useMealPlanSpinStore

context/
└── ThemeContext.tsx         # Light/dark theme with useTheme hook

constants/
└── theme.ts                 # Colors, spacing, radius, font sizes. Primary: #C17A3C, dark primary: #D4822F

supabase/
├── schema.sql               # custom_restaurants, custom_recipes tables
├── schema-meal-plan.sql     # meal_plan + shopping_checks
├── schema-grocery.sql       # grocery_list table + realtime enable
└── functions/
    ├── nearby-restaurants/index.ts
    ├── search-recipes/index.ts
    └── import-recipe-url/index.ts

.github/workflows/
├── deploy.yml               # Build PWA + push to dublayh.github.io on master push
└── keepalive.yml            # Pings Supabase every 3 days to prevent free-tier pause

app.json                     # Expo config
```

---

## 8. Platform Compatibility Patterns

### Skia is native-only

```typescript
const SkiaModule = Platform.OS !== 'web' ? require('@shopify/react-native-skia') : null;
const Canvas = SkiaModule?.Canvas ?? (() => null);
// ... etc
```

Home screen `HeroGlow` and `GradCard` render Skia canvases on native, CSS `radial-gradient`/`linear-gradient` via `style={{ background: '...' }}` on web. React Native Web passes through unknown CSS properties as-is.

### Spin wheel

Uses `SpinWheelUniversal` which selects `SpinWheel.tsx` (Skia) or `SpinWheelWeb.tsx` (Canvas2D). Web version uses `window.devicePixelRatio` to scale the canvas for retina displays or it looks blurry.

### Restaurant map

- Native: `react-native-webview` with Leaflet HTML injected. Chose this over `react-native-maps` because it doesn't need a Google Maps API key.
- Web: Leaflet CDN scripts loaded dynamically, mounted into a `<div>`.

Both use OpenStreetMap tiles (free, no API key).

### Alert.alert doesn't have confirm on web

React Native Web's `Alert.alert` shows browser's native `alert()` with no confirm/cancel buttons. Solution: `useAppAlert` hook + `AppConfirmDialog` component in `components/AppDialog.tsx`.

Usage in a screen:
```typescript
const { showToast, showConfirm, toast, confirm, dismissConfirm } = useAppAlert();

// In render (must be inside SafeAreaView, and must be in EVERY return path):
<AppToast message={toast?.msg ?? ''} type={toast?.type ?? 'info'} visible={!!toast} />
{confirm && <AppConfirmDialog visible title={confirm.title} message={confirm.message}
  confirmLabel={confirm.confirmLabel} confirmDestructive={confirm.destructive}
  onConfirm={confirm.onConfirm} onCancel={dismissConfirm} />}
```

**Gotcha**: `AppToast` uses `position: absolute` with `pointerEvents: 'none'` — does NOT wrap in Modal — because Modal blocks all touches even when transparent. `AppConfirmDialog` uses Modal because it should block touches.

### BottomSheetTextInput doesn't work on web

`@gorhom/bottom-sheet`'s `BottomSheetTextInput` calls native-only APIs and throws on blur on web. In `eat-in/wheel.tsx` and `eat-out/wheel.tsx`:
```typescript
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput as BSTextInput } from '@gorhom/bottom-sheet';
import { TextInput } from 'react-native';
const BottomSheetTextInput = Platform.OS === 'web' ? TextInput : BSTextInput;
```

### expo-image-picker permissions on web

Skip the permission request on web (browser handles it via file picker prompt):
```typescript
if (Platform.OS !== 'web') {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') { showToast('Please allow photo access.', 'error'); return; }
}
```

### Focus outlines on web

Injected globally in `app/_layout.tsx`:
```typescript
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }';
  document.head.appendChild(style);
}
```

---

## 9. PWA Deploy Workflow (`.github/workflows/deploy.yml`)

The workflow is one of the more delicate parts of the project. Here's what it does:

1. Checkout, install Node 20, `npm ci`
2. Run `npx expo export --platform web` (uses `output: "single"` in app.json for SPA)
3. **Python post-processing** on `dist/`:
   - Copies `assets/icon.png` and `assets/favicon.png` into `dist/assets/` (Expo doesn't include these in web export by default)
   - Injects `<link rel="apple-touch-icon" ...>` and `<link rel="icon" ...>` tags into `index.html` for PWA home screen icon
   - Copies `index.html` to `404.html` (SPA fallback for direct route access)
   - Creates empty `.nojekyll` file (GitHub Pages runs Jekyll by default which ignores folders starting with `_`, breaking `_expo/`)
4. Git-init the `dist/` folder, commit, force-push to `main` branch of `dublayh.github.io` repo using `PAGES_TOKEN`

**Why Python not sed**: We hit issues with sed's special-char escaping when injecting `<script>` tags. Python's `str.replace` is way easier.

---

## 10. Design System

- **Primary (light mode)**: `#C17A3C` (amber/terracotta)
- **Primary (dark mode)**: `#D4822F`
- **Font**: System default (no custom fonts loaded)
- Everything in `constants/theme.ts` uses `spacing`, `radius`, `font` scales

**App icon**: 1024×1024 PNG at `assets/icon.png` — a stylized plate with fork/spoon on the primary amber background. Same file used as `favicon.png`.

---

## 11. Known Behaviors & Quirks

- **Home screen top bar**: 🛒 (grocery), 📅 (meal plan), 🌙/☀️ (theme toggle)
- **Grocery list combining**: Items with matching normalized names (lowercase, basic depluralization via `/(?<=[a-z])s\b/`) and matching units are combined at display time. Different units keep separate (e.g. "2 cups" vs "500g").
- **Recipe scaling**: 1x/2x/3x pill toggle. Not tied to servings count — just multiplies amounts. `parseAmount` handles fractions, mixed numbers, unicode symbols. Reset to 1x when recipe loads.
- **Recipe URL import edge function** — Returns 200 with `{ error: ... }` on failures (not 500) so the client can display the actual error message. Supabase's `.functions.invoke()` throws a generic "non 2xx" error otherwise.
- **Recipe → grocery list** — Adding a recipe's ingredients to the shared list is explicit (no auto-add). `addRecipeToGroceryList(recipe, scale=1)` in `lib/groceryList.ts` is a **sync/replace**: it first `deleteGroceryItemsBySource(recipe.name)`, then inserts all ingredients (flat + section) with `source = recipe name`, so re-adding (e.g. at a different scale) refreshes instead of duplicating. Returns the count added. Triggered from two places: the 🛒 button in the recipe detail top bar (adds at the currently-selected 1x/2x/3x scale), and a 🛒 button on each meal-plan week row that has a recipe (adds at 1x, no re-opening the day picker needed). Recipes are preloaded on the meal-plan screen so that button is instant.
- **Undo toast** — `AppToast` / `useAppAlert().showToast(msg, type, action?)` support an optional `{ label, onPress }` action button (see `components/AppDialog.tsx`). After adding a recipe, the success toast shows an **Undo** that calls `deleteGroceryItemsBySource(recipe.name)`. The toast uses `pointerEvents="box-none"` (not `"none"`) when an action is present so the button is tappable while the body still passes touches through; timeout extends to 6s with an action. Tapping the action dismisses the toast immediately (the hook wraps `onPress`).
- **"Already on list" dot** — Both 🛒 buttons show a small amber corner dot (`styles.listDot`) when that recipe's ingredients are currently on the list. Membership is checked by matching the grocery list's `source` values against the recipe name. Meal plan keeps a `listSources: Set<string>` refreshed on focus, after toggle/undo (optimistic), and when the grocery modal closes; recipe detail keeps a boolean `onList` set on load and after add/undo. Matching is by name, so renaming a recipe after adding can leave the dot stale until the list is re-synced.
- **Two button behaviours (intentional):** The **meal-plan card 🛒 is a toggle** (`toggleEntryOnList`) — tap adds when off (dot lights + amber-tinted button), tap removes when on; each direction shows an Undo toast. The **recipe-detail 🛒 is add/re-sync** (not a toggle) because that screen has the 1x/2x/3x scale — re-tapping refreshes amounts at the current scale rather than removing. Undo there removes. The 🛒 in the meal-plan top bar now just opens the shopping list modal.
- **Real-time grocery list**: Subscribes to `postgres_changes` on `grocery_list` when modal is open. INSERT/UPDATE/DELETE events update local state.
- **Dropdown menu positioning**: The ⋯ menu in recipe book uses `getBoundingClientRect()` on web / `measure()` on native to position the popup relative to the button's actual on-screen location.
- **Modal z-index on web**: Some parts of React Native Web don't create proper stacking contexts. Solved by rendering the dropdown menu inside its own `<Modal>` (not just an absolutely-positioned View).

---

## 12. Development Commands

**Local dev**:
```bash
npx expo start --web       # Web dev server
npx expo start --android   # Native, requires dev client APK installed
```

**Deploy**:
```bash
# PWA — auto-deploys on push to master
git push origin master

# Edge functions
npx supabase functions deploy nearby-restaurants
npx supabase functions deploy import-recipe-url
npx supabase functions deploy search-recipes
```

**Android native build**:
```bash
eas build --platform android --profile development
```

Uses EAS since local Android SDK setup on Windows is painful. Development profile so it's a dev client, not a release build.

---

## 13. Third-Party APIs

- **Google Places API (New)** — `places.googleapis.com/v1/places:searchNearby`. Uses `X-Goog-Api-Key` header. Fields we request: `id, displayName, formattedAddress, rating, priceLevel, types, location, websiteUri`.
- **Spoonacular** — Recipe search
- **OpenStreetMap Tiles** — Map tiles, no key needed
- **Google Maps directions URL scheme** — `https://www.google.com/maps/dir/?api=1&destination=...` for the "Get Directions" button on map pins

---

## 14. Fixes / Anti-patterns to Avoid

- **Don't** try to use Skia on web
- **Don't** use `BottomSheetTextInput` on web
- **Don't** use `Alert.alert` with buttons and expect confirm behavior on web
- **Don't** wrap toast in a Modal without `pointerEvents="none"` — it will block all touches
- **Don't** define components inside hooks and return them — they'll get unmounted/remounted every render, killing internal state (this is what broke early versions of `useAppAlert.AlertPortal`)
- **Don't** use `textQuery` on the `searchNearby` Places endpoint
- **Don't** add sed rewrites for build paths — just use `output: "single"` and let baseUrl handle it (or in our case, deploy to root domain to avoid the whole issue)
- **Don't** forget the `.nojekyll` file — GitHub Pages will ignore `_expo/` folder without it
- **Don't** trigger `Alert.alert` from a place that renders in one of multiple return branches without ensuring `<AppToast />` and `<AppConfirmDialog />` are in that branch too

---

## 15. Future Ideas (not implemented)

- Add-to-wheel button on map pins
- Voice input for grocery list (Web Speech API)
- Recipe source URL stored on imports + "View original" link
- Opening hours on map pin popups
- Dietary filters on recipe search (vegetarian, gluten-free, etc.)
- Home screen "I'm feeling..." quick filter chips
- Loading skeletons instead of spinners
- Pull-to-refresh gesture

---

## 16. Maintenance

- **Supabase keep-alive**: Runs every 3 days, prevents the free-tier pause
- **Places API quota**: Google gives $200 credit/month free, `searchNearby` is $17/1000 calls. Very unlikely to hit the limit with a two-user app.
- **GitHub Pages**: No usage limits worth worrying about
- **Spoonacular free tier**: 150 requests/day, could hit this if the recipe search is used a lot
