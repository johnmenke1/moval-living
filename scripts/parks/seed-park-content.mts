/* eslint-disable no-console */
/**
 * scripts/parks/seed-park-content.mts
 *
 * Generic park content seeder for parks that don't have a bespoke seed
 * script (e.g. seed-morrison-faq.mts). Usage:
 *
 *   node --experimental-strip-types scripts/parks/seed-park-content.mts \
 *     --slug lasselle-sports-park \
 *     --blurb "..." \
 *     --description "..." \
 *     --hours '{"mon":[{"open":"06:00","close":"22:00"}]}' \
 *     --faqs '[{"q":"...","a":"..."},...]'
 *     [--secondary-address "..."] \
 *     [--featured]
 *
 * Idempotent — overwrites whatever's there. Use --reset to wipe editorial
 * fields only (description, blurb, hours, faqs, secondary address).
 */
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

interface Args {
  slug: string;
  blurb?: string;
  description?: string;
  hoursJson?: unknown;
  faqsJson?: { q: string; a: string }[];
  secondaryAddress?: string;
  featured?: boolean;
  reset?: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const slug = get("--slug");
  if (!slug) {
    console.error("--slug is required");
    process.exit(1);
  }
  const blurb = get("--blurb");
  const description = get("--description");
  const hoursRaw = get("--hours");
  const faqsRaw = get("--faqs");
  const secondaryAddress = get("--secondary-address");
  const featured = argv.includes("--featured");
  const reset = argv.includes("--reset");

  let hoursJson: unknown = undefined;
  if (hoursRaw) {
    try {
      hoursJson = JSON.parse(hoursRaw);
    } catch (e) {
      console.error(`invalid --hours JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  let faqsJson: { q: string; a: string }[] | undefined = undefined;
  if (faqsRaw) {
    try {
      const parsed = JSON.parse(faqsRaw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      faqsJson = parsed;
    } catch (e) {
      console.error(`invalid --faqs JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  return {
    slug,
    blurb,
    description,
    hoursJson,
    faqsJson,
    secondaryAddress,
    featured: featured || undefined,
    reset,
  };
}

async function main() {
  const args = parseArgs();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.park.findUnique({ where: { slug: args.slug } });
  if (!existing) {
    console.error(`Park "${args.slug}" not found`);
    process.exit(1);
  }

  const data: Record<string, unknown> = {};
  if (args.reset) {
    data.blurb = null;
    data.description = null;
    data.hoursJson = null;
    data.faqsJson = null;
    data.secondaryAddress = null;
  }
  if (args.blurb !== undefined) data.blurb = args.blurb || null;
  if (args.description !== undefined) data.description = args.description || null;
  if (args.hoursJson !== undefined) data.hoursJson = args.hoursJson;
  if (args.faqsJson !== undefined) data.faqsJson = args.faqsJson;
  if (args.secondaryAddress !== undefined) data.secondaryAddress = args.secondaryAddress || null;
  if (args.featured !== undefined) data.featured = args.featured;

  const updated = await prisma.park.update({
    where: { slug: args.slug },
    data,
    select: {
      slug: true,
      name: true,
      blurb: true,
      description: true,
      faqsJson: true,
      hoursJson: true,
      secondaryAddress: true,
      featured: true,
    },
  });

  console.log(`✓ ${updated.name} (${updated.slug})`);
  console.log(`  blurb: ${updated.blurb?.length ?? 0} chars`);
  console.log(`  description: ${updated.description?.length ?? 0} chars`);
  console.log(`  faqs: ${Array.isArray(updated.faqsJson) ? updated.faqsJson.length : 0}`);
  console.log(`  hours: ${updated.hoursJson ? "set" : "null"}`);
  console.log(`  secondaryAddress: ${updated.secondaryAddress ?? "(none)"}`);
  console.log(`  featured: ${updated.featured}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});