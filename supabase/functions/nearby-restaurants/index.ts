import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CUISINE_TYPE_MAP: Record<string, string> = {
  "Italian":       "italian_restaurant",
  "Mexican":       "mexican_restaurant",
  "Japanese":      "japanese_restaurant",
  "Indian":        "indian_restaurant",
  "Chinese":       "chinese_restaurant",
  "Thai":          "thai_restaurant",
  "Greek":         "greek_restaurant",
  "French":        "french_restaurant",
  "Korean":        "korean_restaurant",
  "Mediterranean": "mediterranean_restaurant",
  "American":      "american_restaurant",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    const { lat, lng, radiusMiles, cuisines, vibes } = body;
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")!;

    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");
    if (!lat || !lng) throw new Error(`Invalid coordinates: lat=${lat} lng=${lng}`);

    const radiusMeters = Math.round((radiusMiles ?? 5) * 1609.34);

    const selectedTypes = (cuisines ?? [])
      .map((c: string) => CUISINE_TYPE_MAP[c])
      .filter(Boolean);

    const includedTypes = selectedTypes.length > 0
      ? selectedTypes
      : ["restaurant", "fast_food_restaurant", "meal_takeaway"];

    const requestBody = {
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    };

    console.log("Google Places request:", JSON.stringify(requestBody));

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.location,places.websiteUri",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await res.json();
    console.log("Google Places status:", res.status, "response:", JSON.stringify(data).slice(0, 500));

    if (!res.ok) {
      throw new Error(`Google Places error ${res.status}: ${JSON.stringify(data?.error ?? data)}`);
    }

    const places = data.places ?? [];
    console.log(`Found ${places.length} places`);

    const results = places.map((p: any) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? null,
      priceLevel: p.priceLevel ?? null,
      cuisineTypes: p.types ?? [],
      isCustom: false,
      websiteUri: p.websiteUri ?? null,
      location: {
        lat: p.location?.latitude ?? lat,
        lng: p.location?.longitude ?? lng,
      },
    }));

    return new Response(JSON.stringify(results), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
