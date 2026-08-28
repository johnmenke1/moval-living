/**
 * src/lib/park-amenities.ts
 *
 * Controlled vocabulary for amenity tags on the Park model. Both the admin
 * editor checkbox UI, the public filter chips, and the seed scraper pull
 * from this single source so they can never drift.
 *
 * Keep the slug format snake_case — that's what we store in the `amenities`
 * text[] column and what filter URLs use.
 *
 * Adding a tag: append to AMENITIES, give it a label + icon. No other changes
 * needed anywhere in the codebase.
 */

export type AmenitySlug = (typeof AMENITIES)[number]["slug"];

export const AMENITIES = [
  { slug: "pump_track",        label: "Pump Track",         icon: "Bike" },
  { slug: "skate_park",        label: "Skate Park",         icon: "Skate" },
  { slug: "water_play",        label: "Water Play",         icon: "Droplets" },
  { slug: "splash_pad",        label: "Splash Pad",         icon: "Droplets" },
  { slug: "tennis",            label: "Tennis Courts",      icon: "Trophy" },
  { slug: "basketball",        label: "Basketball",         icon: "CircleDot" },
  { slug: "baseball",          label: "Baseball / Softball",icon: "Baseball" },
  { slug: "soccer",            label: "Soccer Fields",      icon: "Goal" },
  { slug: "dog_park",          label: "Dog Park",           icon: "Dog" },
  { slug: "disc_golf",         label: "Disc Golf",          icon: "Disc3" },
  { slug: "playground",        label: "Playground",         icon: "Smile" },
  { slug: "picnic",            label: "Picnic Shelters",    icon: "Utensils" },
  { slug: "bbq",               label: "BBQ Grills",         icon: "Flame" },
  { slug: "restrooms",         label: "Restrooms",          icon: "Toilet" },
  { slug: "walking_trails",    label: "Walking Trails",     icon: "Footprints" },
  { slug: "equestrian",        label: "Equestrian",         icon: "Horse" },
  { slug: "wheelchair_access", label: "Accessible",         icon: "Accessibility" },
  { slug: "parking",           label: "Parking Lot",        icon: "Car" },
  { slug: "lights",            label: "Lit Fields",         icon: "Lightbulb" },
  { slug: "bike_path",         label: "Bike Path",          icon: "Bike" },
  { slug: "historic_site",     label: "Historic Site",      icon: "Landmark" },
] as const;

/** Quick lookup: slug → metadata. */
export const AMENITY_BY_SLUG: Record<string, (typeof AMENITIES)[number]> =
  Object.fromEntries(AMENITIES.map((a) => [a.slug, a]));

/** All slugs as a flat array (for Zod schemas, scrapers, etc). */
export const AMENITY_SLUGS: AmenitySlug[] = AMENITIES.map((a) => a.slug);

/** True if `slug` is one of our known amenities. */
export function isKnownAmenity(slug: string): slug is AmenitySlug {
  return slug in AMENITY_BY_SLUG;
}

/** Human-readable label for a slug, with a graceful fallback. */
export function amenityLabel(slug: string): string {
  return AMENITY_BY_SLUG[slug]?.label ?? slug.replace(/_/g, " ");
}

/**
 * Curated amenity slugs surfaced in the /parks hero subtitle. Kept as a
 * hand-picked ordered subset (NOT derived from AMENITIES) so AI engines
 * and Google lift a concrete list when answering 'what can I do at parks
 * in Moreno Valley'. Order matters — the first ones in the list appear
 * first in the generated phrase. Edit this list when the curation changes;
 * do not add to AMENITIES without also considering whether the hero
 * should mention it.
 */
export const HERO_AMENITY_SLUGS = [
  "dog_park",
  "splash_pad",
  "pump_track",
  "walking_trails",
] as const satisfies readonly AmenitySlug[];
