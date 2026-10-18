import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { distanceKm } from "./geo";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const Input = z.object({
  loc: z.string().trim().min(4).max(40).regex(/^(\d{4}\s?[A-Z]{2}|-?\d{1,2}\.\d+,\s?-?\d{1,3}\.\d+)$/i),
  stores: z.array(z.string().min(2).max(30)).min(1).max(6),
});
export type NearbyStore = { name: string; km: number | null; address: string | null; lat: number | null; lng: number | null };

export const findNearbyStores = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ origin: { lat: number; lng: number }; stores: NearbyStore[] }> => {
    const lovable = process.env["LOVABLE_API_KEY"], maps = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovable || !maps) throw new Error("Store lookup is not configured.");
    const headers = { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps };
    let origin: { lat: number; lng: number };
    const ll = data.loc.match(/^(-?[\d.]+),\s?(-?[\d.]+)$/);
    if (ll) origin = { lat: Number(ll[1]), lng: Number(ll[2]) };
    else {
      const r = await fetch(`${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.loc)}&components=country:NL`, { headers });
      if (!r.ok) throw new Error(`Couldn't look up that postcode (${r.status}).`);
      const j = (await r.json()) as { results?: { geometry: { location: { lat: number; lng: number } } }[] };
      const g = j.results?.[0]?.geometry.location;
      if (!g) throw new Error("We couldn't find that postcode.");
      origin = g;
    }
    const stores = await Promise.all(data.stores.map(async (name): Promise<NearbyStore> => {
      const r = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
        body: JSON.stringify({ textQuery: `${name} supermarkt`, pageSize: 5, rankPreference: "DISTANCE", locationBias: { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: 5000 } } }),
      });
      if (!r.ok) { console.error("places", r.status, await r.text()); return { name, km: null, address: null, lat: null, lng: null }; }
      const j = (await r.json()) as { places?: { displayName?: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }[] };
      const best = (j.places ?? [])
        .filter((p) => p.displayName?.text.toLowerCase().includes(name.toLowerCase().split(" ")[0]!))
        .map((p) => ({ p, km: distanceKm(origin, { lat: p.location.latitude, lng: p.location.longitude }) }))
        .sort((a, b) => a.km - b.km)[0];
      if (!best) return { name, km: null, address: null, lat: null, lng: null };
      return { name, km: Math.round(best.km * 10) / 10, address: best.p.formattedAddress ?? null, lat: best.p.location.latitude, lng: best.p.location.longitude };
    }));
    return { origin, stores };
  });
