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

const description = `Morrison Park is one of Moreno Valley's largest multi-use parks — a 35-acre campus that pairs traditional ballfields and picnic shelters with the Flight Deck Bike Park, a world-class pump track destination on the park's southern edge.

The Flight Deck is the marquee feature: a 25,000-square-foot Velosolutions asphalt pump track — the largest in Southern California — plus an adaptive track, asphalt jump lines, a beginner bicycle playground, and a 1,000-foot glow-in-the-dark pathway. Riders from across the region come for the line variety.

Beyond the Flight Deck, the park has full-family amenities: soccer fields, baseball diamonds, restrooms, BBQ grills, picnic shelters, a snack bar, and drinking fountains. Open daily 7 AM – 10 PM. Free admission.`;

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
    q: "Where is the Flight Deck pump track inside Morrison Park?",
    a: "The Flight Deck sits on the southern side of Morrison Park, near the Fire Station at 13460 Morrison Street. It's the dedicated bike/wheel-sports area, separate from the ballfields and picnic areas.",
  },
  {
    q: "How big is the Flight Deck pump track?",
    a: "The main pump track is 25,000 square feet of Velosolutions asphalt — the largest asphalt pump track in Southern California. There's also a separate adaptive track (the region's first, designed for riders of all abilities), asphalt jump lines, a beginner bicycle playground, and a 1,000-foot glow-in-the-dark pathway.",
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
  {
    q: "Is the Flight Deck suitable for beginners?",
    a: "Yes. There's a dedicated beginner bicycle playground separate from the main line, plus the adaptive track which is designed for riders of all abilities. The main 25,000 sq ft pump track works for every skill level — beginners can ride the gentler rollers while advanced riders use the larger features.",
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
      blurb: "Moreno Valley's flagship park — 35 acres of ballfields, picnic areas, and the Flight Deck Bike Park, home to Southern California's largest asphalt pump track.",
      description,
      hoursJson: hours,
      faqsJson: faqs,
      featured: true,
    },
    select: { slug: true, name: true, blurb: true, description: true, faqsJson: true, hoursJson: true, featured: true, photoUrls: true },
  });

  console.log("Morrison Park updated:");
  console.log(`  blurb: ${updated.blurb?.slice(0, 80)}…`);
  console.log(`  description: ${updated.description?.length} chars`);
  console.log(`  faqs: ${Array.isArray(updated.faqsJson) ? updated.faqsJson.length : 0} entries`);
  console.log(`  hours: ${Object.keys((updated.hoursJson ?? {}) as object).length} days`);
  console.log(`  photos: ${updated.photoUrls.length}`);
  console.log(`  featured: ${updated.featured}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});