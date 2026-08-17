/* eslint-disable no-console */
/**
 * scripts/parks/seed-park-content.mts
 *
 * Generic park content seeder for parks that don't have a bespoke seed
 * script (e.g. seed-morrison-faq.mts).
 *
 * Two ways to use it:
 *
 *   1. Inline flags (short content only):
 *
 *      node --experimental-strip-types scripts/parks/seed-park-content.mts \
 *        --slug lasselle-sports-park \
 *        --blurb "..." \
 *        --description "..." \
 *        --hours '{"mon":[{"open":"06:00","close":"22:00"}]}' \
 *        --faqs '[{"q":"...","a":"..."},...]'
 *        [--secondary-address "..."] \
 *        [--featured]
 *
 *   2. Brief files (longer content, easier to edit):
 *
 *      node --experimental-strip-types scripts/parks/seed-park-content.mts \
 *        --slug lasselle-sports-park \
 *        --briefs-dir scripts/parks/briefs \
 *        [--featured]
 *
 *      Reads from scripts/parks/briefs/{slug}-blurb.txt,
 *      {slug}-description.txt, {slug}-hours.json, {slug}-faqs.json,
 *      {slug}-secondary-address.txt. Inline --blurb / --description /
 *      etc. flags override the files when both are present.
 *
 * Idempotent — overwrites whatever's there. Use --reset to wipe editorial
 * fields only (description, blurb, hours, faqs, secondary address).
 */
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local", override: true });

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
  const has = (flag: string): boolean => argv.includes(flag);
  const slug = get("--slug");
  if (!slug) {
    console.error("--slug is required");
    process.exit(1);
  }

  // Either pass inline values OR a --briefs-dir pointing at a directory
  // with files named {slug}-description.txt, {slug}-blurb.txt, {slug}-hours.json,
  // {slug}-faqs.json, {slug}-secondary-address.txt. Inline wins when both
  // are present.
  const briefsDir = get("--briefs-dir");
  const readBrief = (suffix: string): string | undefined => {
    if (!briefsDir) return undefined;
    const p = join(briefsDir, `${slug}-${suffix}`);
    return existsSync(p) ? readFileSync(p, "utf8").trim() : undefined;
  };

  const inlineOrFile = (flag: string, suffix: string): string | undefined => {
    return get(flag) ?? readBrief(suffix);
  };

  const blurb = inlineOrFile("--blurb", "blurb.txt");
  const description = inlineOrFile("--description", "description.txt");
  const secondaryAddress = inlineOrFile("--secondary-address", "secondary-address.txt");

  const hoursRaw = get("--hours") ?? readBrief("hours.json");
  let hoursJson: unknown = undefined;
  if (hoursRaw) {
    try {
      hoursJson = JSON.parse(hoursRaw);
    } catch (e) {
      console.error(`invalid hours JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  const faqsRaw = get("--faqs") ?? readBrief("faqs.json");
  let faqsJson: { q: string; a: string }[] | undefined = undefined;
  if (faqsRaw) {
    try {
      const parsed = JSON.parse(faqsRaw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      faqsJson = parsed;
    } catch (e) {
      console.error(`invalid faqs JSON: ${(e as Error).message}`);
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
    featured: has("--featured") || undefined,
    reset: has("--reset"),
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