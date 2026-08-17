/* eslint-disable no-console */
/**
 * scripts/parks/seed-morrison-faq.mts
 *
 * One-shot content seed for Morrison Park's editorial + structured FAQ.
 * Sources from the City of MoVal Flight Deck page + rider community
 * references. Run with --reset to wipe the FAQ first.
 */
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const parkSlug = "morrison-park";

// Flight Deck Bike Park has its own street address per the City of
// Moreno Valley's December 2025 ribbon-cutting release (the sub-area
// sits on the southern side of the main park, near the Fire Station).
const secondaryAddress: string | null = null;
// Flight Deck Bike Park was promoted to its own entity in Aug 2026 (slug
// flight-deck-bike-park). It uses 13460 Morrison Street as its primary
// address and lists its own amenities, FAQs, and hours — so this slot is
// now reserved for a future distinct sub-area (or stays null).

const description = `Morrison Park is one of Moreno Valley's largest multi-use parks — a 35-acre campus that pairs traditional ballfields and picnic shelters with the Flight Deck Bike Park, a world-class pump track destination on the park's southern edge.

The Flight Deck is the marquee feature. Per the City of Moreno Valley's December 2025 ribbon-cutting release, the Flight Deck Bike Park is located on the southern side of Morrison Park near the Fire Station and is a major addition to Moreno Valley's outdoor facilities. Inspired by the city's aviation heritage, the park was designed to offer a cycling experience that provides a welcoming environment for riders of all ages, abilities, and skill levels.

That heritage shows up in the design itself — a 25,000-square-foot Velosolutions asphalt pump track (the largest in Southern California), plus the region's first adaptive track for riders of all abilities, the first asphalt jump lines in Southern California, an asphalt bicycle playground for young riders, and a 1,000-foot connecting path lit by Ambient Glow Technology — sunlight-charged glow rocks that illuminate after dark (the first use of this technology in Southern California, per the City).

Beyond the Flight Deck, the park has full-family amenities: soccer fields, baseball diamonds, restrooms, BBQ grills, picnic shelters, a snack bar, and drinking fountains. Open daily 7 AM – 10 PM. Free admission. Designed and built by American Ramp Company.`;

const hours = {
  mon: [{ open: "07:00", close: "22:00" }],
  tue: [{ open: "07:00", close: "22:00" }],
  wed: [{ open: "07:00", close: "22:00" }],
  thu: [{ open: "07:00", close: "22:00" }],
  fri: [{ open: "07:00", close: "22:00" }],
  sat: [{ open: "07:00", close: "22:00" }],
  sun: [{ open: "07:00", close: "22:00" }],
};

const faqs = [
  {
    q: "Where is the Flight Deck Bike Park inside Morrison Park?",
    a: "Per the City of Moreno Valley's December 2025 ribbon-cutting announcement, the Flight Deck Bike Park is located on the southern side of Morrison Park, near the Fire Station at 13460 Morrison Street. It's the dedicated bike/wheel-sports area, separate from the ballfields and picnic areas.",
  },
  {
    q: "How big is the Flight Deck pump track?",
    a: "The main pump track is 25,000 square feet of Velosolutions asphalt — the largest Velosolutions pump track in Southern California.",
  },
  {
    q: "What is the Ambient Glow Technology path?",
    a: "A 1,000-foot connecting path uses Ambient Glow Technology — sunlight-charged glow rocks that illuminate the trail after dark. Per the City, it's the first use of this technology in Southern California.",
  },
  {
    q: "What's the design story behind the Flight Deck name?",
    a: "The City says the park was inspired by Moreno Valley's aviation heritage, and was designed to offer a welcoming cycling experience for riders of all ages, abilities, and skill levels. It's designed and built by American Ramp Company.",
  },
  {
    q: "Is the Flight Deck suitable for beginners?",
    a: "Yes. There's a separate adaptive track (the region's first, designed for riders of all abilities), an asphalt bicycle playground for young riders, and the main 25,000 sq ft pump track works for every skill level — beginners can ride the gentler rollers while advanced riders use the larger features.",
  },
  {
    q: "What are Morrison Park's hours?",
    a: "Daily, 7:00 AM to 10:00 PM.",
  },
  {
    q: "Does Morrison Park cost anything to enter?",
    a: "No — admission is free.",
  },
  {
    q: "What can I ride at the Flight Deck?",
    a: "Bikes, standard non-motorized scooters, skateboards, and rollerblades are welcome. Motorized bikes and motorized scooters are strictly prohibited.",
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.park.findUnique({ where: { slug: parkSlug } });
  if (!existing) {
    console.error(`Park with slug "${parkSlug}" not found`);
    process.exit(1);
  }

  const updated = await prisma.park.update({
    where: { slug: parkSlug },
    data: {
      blurb: "Moreno Valley's flagship 35-acre park — ballfields, picnic shelters, and the broader campus home to the Flight Deck Bike Park (its own page at /parks/flight-deck-bike-park).",
      description,
      hoursJson: hours,
      faqsJson: faqs,
      featured: true,
      secondaryAddress,
    },
    select: { slug: true, name: true, blurb: true, description: true, faqsJson: true, hoursJson: true, featured: true, photoUrls: true, address: true, secondaryAddress: true },
  });

  console.log("Morrison Park updated:");
  console.log(`  blurb: ${updated.blurb?.slice(0, 80)}…`);
  console.log(`  description: ${updated.description?.length} chars`);
  console.log(`  faqs: ${Array.isArray(updated.faqsJson) ? updated.faqsJson.length : 0} entries`);
  console.log(`  hours: ${Object.keys((updated.hoursJson ?? {}) as object).length} days`);
  console.log(`  photos: ${updated.photoUrls.length}`);
  console.log(`  featured: ${updated.featured}`);
  console.log(`  address: ${updated.address}`);
  console.log(`  secondaryAddress: ${updated.secondaryAddress}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});