import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { query, latitude, longitude, radiusMiles } = await req.json();
    const radiusMeters = Math.round((radiusMiles ?? 5) * 1609.34);
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")!;

    const params = new URLSearchParams({
      query,
      location: `${latitude},${longitude}`,
      radius: String(radiusMeters),
      key: apiKey,
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
    );

    const data = await res.json();
    console.log("Google response status:", data.status);
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
