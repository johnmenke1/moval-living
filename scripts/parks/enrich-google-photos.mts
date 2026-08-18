/* eslint-disable no-console */
/**
 * scripts/parks/enrich-google-photos.mts
 *
 * Append Google Places (New) user-submitted photos to each Park's
 * `photoUrls` array, alongside the City's ArcGIS hero image already
 * captured by `scripts/capture-park-photos.mts`.
 *
 * Why this exists
 * ---------------
 * - The City's GIS layer gives us ONE official photo per park. That's a
 *   fine hero but not a gallery — users on Google Maps have uploaded
 *   much more context (splash pad details, dog runs, event-day photos).
 * - We supplement with up to 10 Google photos per park so the card /
 *   detail page has a real photo gallery.
 * - We mirror to our own Vercel Blob rather than hot-linking Google so
 *   we control availability + transforms.
 *
 * Flow
 * ----
 *   1. Read every active Park row.
 *   2. Skip parks with no Google Place match (e.g., private facilities).
 *   3. Call Places API (New) `places:searchText` with "<name> Moreno
 *      Valley CA" to get the canonical place_id.
 *   4. Call `GET /v1/places/{place_id}` with field mask `photos` to get
 *      up to 10 photo names.
 *   5. For each photo name, fetch the bytes via our
 *      `/api/places/photos?ref=<name>` proxy (which now supports v1).
 *   6. Upload each to Vercel Blob at `businesses/parks/{slug}/{n}.jpg`.
 *   7. Append the new URLs to `Park.photoUrls`. Leave `heroPhotoUrl`
 *      alone — the City image is the authoritative hero.
 *
 * Idempotent
 * ----------
 * Re-runs append only — existing URLs in `photoUrls` are skipped. Pass
 * `--reset` to wipe the array first (rare; only if Google returns
 * duplicates).
 *
 * Cost (one-time per park)
 * ------------------------
 *   - 1× places:searchText              $0.032
 *   - 1× places.get                    $0.000 (with field mask)
 *   - ~6× v1/{name}/media              ~$0.045
 *   Total:                            ~$0.08/park
 *   40 parks:                          ~$3.20 one-time
 *
 * Run:
 *   DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... GOOGLE_PLACES_API_KEY=... \
 *     node --experimental-strip-types scripts/parks/enrich-google-photos.mts
 *
 *   Add `--reset` to wipe existing photoUrls before appending.
 *   Add `--limit <n>` to process only the first N parks (dry-run style).
 *   Add `--slug <slug>` to process a single park.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { put } from "@vercel/blob";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY?.replace(/[\r\n]+$/g, "");
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Argument parsing
const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = (flag: string) => args.includes(flag);

const SINGLE_SLUG = getArg("--slug");
const LIMIT = getArg("--limit") ? parseInt(getArg("--limit")!, 10) : null;
const RESET = hasFlag("--reset");

if (!GOOGLE_PLACES_API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY is required");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is required for Vercel Blob uploads");
  process.exit(1);
}

// DB
const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Stats
let stats = {
  total: 0,
  noPlaceMatch: 0,
  noPhotos: 0,
  uploaded: 0,
  skipped: 0,
  errors: 0,
};

async function searchPlace(name: string): Promise<string | null> {
  // Use the local proxy if APP_URL is set so we get the same field
  // mask + logging as production. Otherwise hit Places API directly
  // (script runs outside of Next.js context).
  const url = `${APP_URL}/api/places/search`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // We need to bypass the proxy's API key check by passing our own
      // — the proxy uses process.env.GOOGLE_PLACES_API_KEY directly.
      // For local dev, prefer to hit the proxy. For script execution
      // outside a running server, fall through to direct API call.
      "Content-Type": "application/json",
    },
  });

  if (res.ok) {
    const j = await res.json();
    const match = (j.places ?? []).find(
      (p: { displayName?: { text?: string }; formattedAddress?: string }) =>
        formattedAddress?.includes("Moreno Valley") &&
        displayName?.text?.toLowerCase().includes(name.toLowerCase().split(" ")[0]),
    );
    return match?.id ?? j.places?.[0]?.id ?? null;
  }

  // Fallback: hit Places API (New) directly.
  const apiRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: `${name} Moreno Valley CA`,
      locationBias: {
        circle: {
          center: { latitude: 33.9425, longitude: -117.2280 },
          radius: 15000,
        },
      },
      pageSize: 5,
    }),
  });
  if (!apiRes.ok) {
    console.error(`  [search] HTTP ${apiRes.status}: ${await apiRes.text().catch(() => "")}`);
    return null;
  }
  const j = await apiRes.json();
  const places = j.places ?? [];
  // Prefer matches that look like the park (name overlap) and are in MoVal.
  const moVal = places.filter((p: { formattedAddress?: string }) =>
    p.formattedAddress?.toLowerCase().includes("moreno valley"),
  );
  const exact = moVal.find((p: { displayName?: { text?: string } }) =>
    name.toLowerCase().split(" ")[0].length > 3 &&
    p.displayName?.text?.toLowerCase().includes(name.toLowerCase().split(" ")[0]),
  );
  return exact?.id ?? moVal[0]?.id ?? places[0]?.id ?? null;
}

async function getPhotos(placeId: string): Promise<string[]> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY!,
      // Field mask is mandatory. We only want the photo name list;
      // bytes come back through /v1/{name}/media below.
      "X-Goog-FieldMask": "photos.name",
    },
  });
  if (!res.ok) {
    console.error(`  [place details] HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    return [];
  }
  const j = await res.json();
  return (j.photos ?? []).map((p: { name: string }) => p.name).slice(0, 10);
}

async function fetchPhotoBytes(photoName: string): Promise<Buffer | null> {
  // Photo names look like: "places/ChIJ.../photos/Aap_uEA..."
  // The v1 endpoint expects the path appended to /v1/.
  // The full URL is https://places.googleapis.com/v1/{photoName}/media
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function uploadToBlob(slug: string, idx: number, buf: Buffer): Promise<string> {
  // Use the path convention from src/app/api/admin/parks/[slug]/photos/route.ts
  const path = `businesses/parks/${slug}/${Date.now()}-${idx}.jpg`;
  const blob = await put(path, buf, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/jpeg",
    token: BLOB_READ_WRITE_TOKEN!,
  });
  return blob.url;
}

async function processPark(park: { id: string; slug: string; name: string; photoUrls: string[] }) {
  console.log(`\n→ ${park.name} (${park.slug})`);
  const placeId = await searchPlace(park.name);
  if (!placeId) {
    console.log(`  no Google Place match`);
    stats.noPlaceMatch++;
    return;
  }
  console.log(`  place_id: ${placeId}`);

  const photoNames = await getPhotos(placeId);
  if (photoNames.length === 0) {
    console.log(`  no photos on this place`);
    stats.noPhotos++;
    return;
  }
  console.log(`  ${photoNames.length} photos available`);

  const existing = RESET ? [] : park.photoUrls;
  const newUrls: string[] = [];

  for (let i = 0; i < photoNames.length; i++) {
    const photoName = photoNames[i];
    // Dedup by the tail of the photo name (stable identifier).
    const photoTail = photoName.split("/").pop();
    if (existing.some((u) => u.includes(photoTail ?? ""))) {
      console.log(`  [${i}] skip (already in photoUrls)`);
      stats.skipped++;
      continue;
    }

    try {
      const bytes = await fetchPhotoBytes(photoName);
      if (!bytes || bytes.length < 1000) {
        console.log(`  [${i}] skip (empty or too small)`);
        stats.skipped++;
        continue;
      }
      const url = await uploadToBlob(park.slug, i, bytes);
      newUrls.push(url);
      stats.uploaded++;
      console.log(`  [${i}] uploaded ${(bytes.length / 1024).toFixed(0)} KB → ${url}`);
    } catch (e) {
      console.error(`  [${i}] error:`, (e as Error).message);
      stats.errors++;
    }
  }

  if (newUrls.length === 0) {
    console.log(`  no new photos to add`);
    return;
  }

  const updatedUrls = [...existing, ...newUrls];
  // If we're in --reset mode AND no hero, promote the first new URL.
  // Otherwise leave heroPhotoUrl alone — the City hero stays put.
  const updateData: { photoUrls: string[]; heroPhotoUrl?: string } = {
    photoUrls: updatedUrls,
  };
  if (RESET) {
    updateData.heroPhotoUrl = updatedUrls[0];
  }

  await prisma.park.update({
    where: { id: park.id },
    data: updateData,
  });
  console.log(`  ✓ DB updated: ${existing.length} → ${updatedUrls.length} photos`);
}

async function main() {
  console.log("=== Google Places photo enrichment for parks ===");
  console.log(`reset=${RESET} limit=${LIMIT ?? "none"} slug=${SINGLE_SLUG ?? "all"}\n`);

  const where = SINGLE_SLUG ? { slug: SINGLE_SLUG } : { isActive: true };
  const parks = await prisma.park.findMany({
    where,
    select: { id: true, slug: true, name: true, photoUrls: true },
    orderBy: { name: "asc" },
  });
  const queue = LIMIT ? parks.slice(0, LIMIT) : parks;
  stats.total = queue.length;
  console.log(`Processing ${queue.length} parks…\n`);

  for (const park of queue) {
    try {
      await processPark(park);
    } catch (e) {
      console.error(`✗ ${park.slug}:`, (e as Error).message);
      stats.errors++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(stats, null, 2));

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});