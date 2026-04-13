import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SPOONACULAR_KEY = Deno.env.get("SPOONACULAR_API_KEY")!;

const EFFORT_MAX_TIME: Record<string, number> = {
  quick: 30,
  medium: 60,
  weekend: 9999,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cuisines = [], efforts = [], number = 20 } = await req.json();
    const maxReadyTime = efforts.length
      ? Math.max(...efforts.map((e: string) => EFFORT_MAX_TIME[e] ?? 9999))
      : 9999;

    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("apiKey", SPOONACULAR_KEY);
    url.searchParams.set("number", String(number));
    url.searchParams.set("addRecipeInformation", "true");
    url.searchParams.set("fillIngredients", "true");
    url.searchParams.set("instructionsRequired", "true");
    if (cuisines.length) url.searchParams.set("cuisine", cuisines.join(","));
    if (maxReadyTime < 9999) url.searchParams.set("maxReadyTime", String(maxReadyTime));

    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Spoonacular error");

    const recipes = (json.results ?? []).map((r: any) => ({
      id: String(r.id),
      name: r.title,
      cuisine: r.cuisines?.[0] ?? cuisines[0] ?? "International",
      effort: toEffort(r.readyInMinutes),
      imageUrl: r.image,
      readyInMinutes: r.readyInMinutes ?? 0,
      servings: r.servings ?? 2,
      ingredients: (r.extendedIngredients ?? []).map((ing: any) => ({
        amount: ing.measures?.us?.amount ? `${+ing.measures.us.amount.toFixed(2)}` : String(ing.amount),
        unit: ing.measures?.us?.unitShort ?? ing.unit,
        name: ing.nameClean ?? ing.name,
      })),
      steps: (r.analyzedInstructions?.[0]?.steps ?? []).map((s: any) => ({
        number: s.number,
        step: s.step,
      })),
      isCustom: false,
    }));

    return Response.json(recipes, { headers: corsHeaders });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});

function toEffort(minutes: number): string {
  if (!minutes || minutes <= 30) return "quick";
  if (minutes <= 60) return "medium";
  return "weekend";
}
