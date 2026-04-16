import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Parse ISO 8601 duration like PT1H30M → 90 minutes
function parseDuration(d: string): number {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0");
}

function toEffort(minutes: number): string {
  if (!minutes || minutes <= 30) return "quick";
  if (minutes <= 90) return "medium";
  return "weekend";
}

// Best-effort ingredient parser: "1 cup flour, sifted" → {amount, unit, name}
function parseIngredient(raw: string): { amount: string; unit: string; name: string } {
  const UNITS = ["cup","cups","tablespoon","tablespoons","tbsp","teaspoon","teaspoons","tsp",
    "pound","pounds","lb","lbs","ounce","ounces","oz","gram","grams","g","ml","liter","liters",
    "clove","cloves","can","cans","package","pkg","slice","slices","pinch","dash","inch","inches",
    "quart","pint","stick","sticks","sprig","sprigs","handful","sheet","sheets"];

  const s = raw.trim();

  // Match leading number (integer, decimal, fraction, unicode fractions)
  const numRe = /^([\d\u00BC\u00BD\u00BE\u2150-\u215E\/\-]+(?:\s+[\d\/]+)?)\s+(.+)$/;
  const numMatch = s.match(numRe);
  if (numMatch) {
    const rest = numMatch[2];
    const words = rest.split(/\s+/);
    const unit = words[0].toLowerCase().replace(/\.$/, "");
    if (UNITS.includes(unit)) {
      return { amount: numMatch[1], unit: words[0], name: words.slice(1).join(" ") };
    }
    return { amount: numMatch[1], unit: "", name: rest };
  }
  return { amount: "", unit: "", name: s };
}

// Find Recipe JSON-LD in page HTML
function extractSchema(html: string): any | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const candidates = Array.isArray(data) ? data : [data, ...(data["@graph"] ?? [])];
      const recipe = candidates.find((x: any) => x["@type"] === "Recipe" ||
        (Array.isArray(x["@type"]) && x["@type"].includes("Recipe")));
      if (recipe) return recipe;
    } catch { /* skip malformed */ }
  }
  return null;
}

const VALID_CUISINES = ["Italian","Mexican","Japanese","Indian","American","Thai",
  "Mediterranean","Chinese","Korean","Greek","French","Breakfast","Dessert","Spice Mixes","Sauces"];

function guessCuisine(schema: any): string {
  const raw = [
    ...(Array.isArray(schema.recipeCuisine) ? schema.recipeCuisine : [schema.recipeCuisine ?? ""]),
    ...(Array.isArray(schema.recipeCategory) ? schema.recipeCategory : [schema.recipeCategory ?? ""]),
  ].join(" ").toLowerCase();

  if (/breakfast|brunch|pancake|waffle|french toast|egg/.test(raw)) return "Breakfast";
  if (/dessert|cake|pie|cookie|brownie|candy|sweet/.test(raw)) return "Dessert";
  if (/italian|pasta|pizza/.test(raw)) return "Italian";
  if (/mexican|taco|burrito/.test(raw)) return "Mexican";
  if (/japanese|sushi|ramen/.test(raw)) return "Japanese";
  if (/indian|curry/.test(raw)) return "Indian";
  if (/thai/.test(raw)) return "Thai";
  if (/mediterranean/.test(raw)) return "Mediterranean";
  if (/chinese/.test(raw)) return "Chinese";
  if (/korean/.test(raw)) return "Korean";
  if (/greek/.test(raw)) return "Greek";
  if (/french/.test(raw)) return "French";
  return "American";
}

function parseInstructions(instructions: any[]): { number: number; step: string }[] {
  const steps: { number: number; step: string }[] = [];
  let n = 1;
  for (const inst of instructions) {
    if (typeof inst === "string") {
      steps.push({ number: n++, step: inst });
    } else if (inst["@type"] === "HowToStep") {
      steps.push({ number: n++, step: inst.text });
    } else if (inst["@type"] === "HowToSection") {
      for (const sub of inst.itemListElement ?? []) {
        steps.push({ number: n++, step: sub.text ?? sub });
      }
    }
  }
  return steps;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url?.startsWith("http")) throw new Error("Please provide a valid URL.");

    console.log('Fetching URL:', url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    if (!res.ok) throw new Error(`Could not load page (${res.status}).`);

    const html = await res.text();
    const schema = extractSchema(html);
    if (!schema) {
      console.error('No recipe schema found. Page title:', html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? 'unknown');
      throw new Error("No recipe found on this page. The site may not support recipe schema markup.");
    }

    const totalTime =
      parseDuration(schema.totalTime ?? "") ||
      parseDuration(schema.prepTime ?? "") + parseDuration(schema.cookTime ?? "");

    const yieldRaw = Array.isArray(schema.recipeYield) ? schema.recipeYield[0] : schema.recipeYield;
    const servings = parseInt(String(yieldRaw ?? "4")) || 4;

    const recipe = {
      name: schema.name ?? "Untitled Recipe",
      cuisine: guessCuisine(schema),
      effort: toEffort(totalTime),
      readyInMinutes: totalTime,
      servings,
      ingredients: (schema.recipeIngredient ?? []).map(parseIngredient),
      steps: parseInstructions(schema.recipeInstructions ?? []),
    };

    return Response.json({ recipe }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Import error:', err.message);
    return Response.json({ error: err.message }, { headers: corsHeaders });
  }
});
