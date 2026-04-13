import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { latitude, longitude, radiusMeters, cuisines, vibes } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")!;

    // Build keyword from filters
    const keywords = [...(cuisines ?? []), ...(vibes ?? [])].join(" ");

    // Use includedTypes to cover both sit-down restaurants AND fast food
    const body = {
      includedTypes: ["restaurant", "fast_food_restaurant", "meal_takeaway", "meal_delivery"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
      ...(keywords ? { textQuery: keywords } : {}),
    };

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.location",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
