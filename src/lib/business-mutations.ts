import { Prisma } from '@prisma/client'
import { z } from 'zod'

export type BusinessActor = {
  userId: string
  role?: string | null
}

export function canManageBusiness(actor: BusinessActor | null, ownerId: string | null): boolean {
  if (!actor) return false
  return actor.role === 'ADMIN' || (!!ownerId && actor.userId === ownerId)
}

const nullableText = (max: number) => z.union([
  z.string().trim().max(max).transform(value => value || null),
  z.null(),
]).optional()

const hoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().max(30),
    close: z.string().max(30),
    closed: z.boolean(),
  }),
).nullable().optional()

const couponSchema = z.object({
  headline: z.union([
    z.string().trim().min(1).max(80),
    z.literal(''),
    z.null(),
  ]).optional(),
  description: z.string().trim().max(300).default(''),
  code: z.union([z.string().trim().max(20).transform(value => value || null), z.null()]).optional(),
  expiresAt: z.union([z.string().trim().max(40).transform(value => value || null), z.null()]).optional(),
}).nullable().optional()

const businessUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  tagline: nullableText(240),
  description: z.string().trim().min(10).max(2000),
  categoryId: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().length(2).transform(value => value.toUpperCase()),
  zip: z.union([
    z.string().trim().regex(/^\d{5}(?:-\d{4})?$/),
    z.literal(''),
    z.null(),
  ]).optional(),
  phone: nullableText(50),
  email: z.union([
    z.string().trim().email().max(320).transform(value => value || null),
    z.literal('').transform(() => null),
    z.null(),
  ]).optional(),
  website: nullableText(500),
  facebook: nullableText(500),
  instagram: nullableText(500),
  yelp: nullableText(500),
  hours: hoursSchema,
  hasCoupon: z.boolean().default(false),
  coupon: couponSchema,
  googleRating: z.union([
    z.number().min(0).max(5),
    z.string().transform(v => v === '' ? null : Number(v)).pipe(z.number().min(0).max(5).nullable()),
    z.null(),
  ]).optional(),
  googleReviewCount: z.union([
    z.number().int().min(0),
    z.string().transform(v => v === '' ? null : Number(v)).pipe(z.number().int().min(0).nullable()),
    z.null(),
  ]).optional(),
  googleBusiness: nullableText(500),
}).strict()

export function buildBusinessUpdateData(input: unknown): Prisma.BusinessUpdateInput {
  const parsed = businessUpdateSchema.parse(input)
  return {
    name: parsed.name,
    tagline: parsed.tagline ?? null,
    description: parsed.description,
    category: { connect: { id: parsed.categoryId } },
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip === '' || parsed.zip === null || parsed.zip === undefined ? '' : parsed.zip,
    phone: parsed.phone ?? null,
    email: parsed.email ?? null,
    website: parsed.website ?? null,
    facebook: parsed.facebook ?? null,
    instagram: parsed.instagram ?? null,
    yelp: parsed.yelp ?? null,
    hours: parsed.hours === null
      ? Prisma.JsonNull
      : parsed.hours as Prisma.InputJsonValue | undefined,
    hasCoupon: parsed.hasCoupon,
    coupon: !parsed.hasCoupon || parsed.coupon === null
      ? Prisma.JsonNull
      : parsed.coupon as Prisma.InputJsonValue | undefined,
    googleRating: parsed.googleRating ?? null,
    googleReviewCount: parsed.googleReviewCount ?? null,
    googleBusiness: parsed.googleBusiness ?? null,
  }
}
