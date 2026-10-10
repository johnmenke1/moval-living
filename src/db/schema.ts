import { pgTable, index, uniqueIndex, text, doublePrecision, jsonb, boolean, integer, timestamp, foreignKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"

export const bestOfNominationStatus = pgEnum("BestOfNominationStatus", ['PENDING', 'APPROVED', 'REJECTED'])
export const eventAttendeeStatus = pgEnum("EventAttendeeStatus", ['GOING', 'INTERESTED'])
export const eventCategory = pgEnum("EventCategory", ['HS_SPORTS', 'COLLEGE_SPORTS', 'LEAGUE_SPORTS', 'POLITICAL', 'MUSIC', 'ARTS', 'EDUCATIONAL', 'FUNDRAISERS', 'COMMUNITY', 'FAMILY', 'FOOD_DRINK', 'HOLIDAY_CELEBRATIONS'])
export const eventTier = pgEnum("EventTier", ['STANDARD', 'HONORABLE_MENTION', 'HERO'])
export const parkType = pgEnum("ParkType", ['PARK', 'GOLF', 'REC_CENTER'])
export const platform = pgEnum("Platform", ['INSTAGRAM', 'FACEBOOK'])
export const postStatus = pgEnum("PostStatus", ['PENDING', 'APPROVED', 'REJECTED'])
export const status = pgEnum("Status", ['PENDING', 'APPROVED', 'REJECTED'])
export const submissionSource = pgEnum("SubmissionSource", ['INSTAGRAM', 'FACEBOOK', 'OTHER'])
export const submissionStatus = pgEnum("SubmissionStatus", ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE'])
export const tier = pgEnum("Tier", ['FREE', 'FEATURED', 'EXPERT_PARTNER'])
export const userRole = pgEnum("UserRole", ['USER', 'ADMIN'])
export const venueTag = pgEnum("VenueTag", ['FOX_RIVERSIDE', 'RIVERSIDE_MUNICIPAL_AUDITORIUM', 'RIVERSIDE_CONVENTION_CENTER', 'UCR', 'CBU', 'RIVERSIDE_ART_MUSEUM', 'RIVERSIDE_METROPOLITAN_MUSEUM', 'REDLANDS_BOWL', 'REDLANDS_THEATER_FESTIVAL', 'MOVAL_HIGH_SCHOOL', 'OTHER'])


export const park = pgTable("Park", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	type: parkType().notNull(),
	googlePlaceId: text(),
	address: text(),
	secondaryAddress: text(),
	city: text().default('Moreno Valley').notNull(),
	state: text().default('CA').notNull(),
	zip: text(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	phone: text(),
	website: text(),
	hoursJson: jsonb(),
	amenities: text().array().default(sql`ARRAY[]::text[]`).notNull(),
	heroPhotoUrl: text(),
	photoUrls: text().array().default(sql`ARRAY[]::text[]`).notNull(),
	blurb: text(),
	description: text(),
	faqsJson: jsonb(),
	featured: boolean().default(false).notNull(),
	isActive: boolean().default(true).notNull(),
	googleRating: doublePrecision(),
	googleReviewCount: integer(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Park_featured_idx").using("btree", table.featured.asc().nullsLast()),
	index("Park_slug_idx").using("btree", table.slug.asc().nullsLast()),
	uniqueIndex("Park_slug_key").using("btree", table.slug.asc().nullsLast()),
	index("Park_type_idx").using("btree", table.type.asc().nullsLast()),
]);

export const category = pgTable("Category", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	icon: text().notNull(),
	image: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Category_slug_idx").using("btree", table.slug.asc().nullsLast()),
	uniqueIndex("Category_slug_key").using("btree", table.slug.asc().nullsLast()),
]);

export const business = pgTable("Business", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	tagline: text(),
	description: text().notNull(),
	categoryId: text().notNull(),
	tier: tier().default('FREE').notNull(),
	status: status().default('PENDING').notNull(),
	isBestOfWinner: boolean().default(false).notNull(),
	bestOfTags: text().array().default(sql`ARRAY[]::text[]`).notNull(),
	isExpertPartner: boolean().default(false).notNull(),
	expertPartnerSlug: text(),
	foundingPartnerSince: timestamp({ precision: 3, mode: 'date' }),
	foundingPartnerRate: boolean().default(false).notNull(),
	liveQaZoomUrl: text(),
	liveQaNextDate: timestamp({ precision: 3, mode: 'date' }),
	email: text(),
	phone: text(),
	website: text(),
	address: text().notNull(),
	city: text().default('Moreno Valley').notNull(),
	state: text().default('CA').notNull(),
	zip: text().notNull(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	logo: text(),
	coverImage: text(),
	photos: text().array().$defaultFn(() => []).notNull(),
	facebook: text(),
	instagram: text(),
	yelp: text(),
	googleBusiness: text(),
	googleRating: doublePrecision(),
	googleReviewCount: integer(),
	hours: jsonb(),
	metaTitle: text(),
	metaDescription: text(),
	submitterEmailOptIn: boolean().default(false).notNull(),
	submitterSmsOptIn: boolean().default(false).notNull(),
	submitterConsentAt: timestamp({ precision: 3, mode: 'date' }),
	seHablaEspanol: boolean().default(false).notNull(),
	chamberMember: boolean().default(false).notNull(),
	hispanicChamberMember: boolean().default(false).notNull(),
	stripeCustomerId: text(),
	stripeSubscriptionId: text(),
	subscriptionStatus: text(),
	subscriptionCurrentPeriodEnd: timestamp({ precision: 3, mode: 'date' }),
	ownerId: text(),
	claimToken: text(),
	claimExpiresAt: timestamp({ precision: 3, mode: 'date' }),
	claimedAt: timestamp({ precision: 3, mode: 'date' }),
	featuredAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Business_categoryId_idx").using("btree", table.categoryId.asc().nullsLast()),
	index("Business_city_idx").using("btree", table.city.asc().nullsLast()),
	uniqueIndex("Business_claimToken_key").using("btree", table.claimToken.asc().nullsLast()),
	index("Business_claimedAt_idx").using("btree", table.claimedAt.asc().nullsLast()),
	uniqueIndex("Business_expertPartnerSlug_key").using("btree", table.expertPartnerSlug.asc().nullsLast()),
	index("Business_featuredAt_idx").using("btree", table.featuredAt.asc().nullsLast()),
	index("Business_isBestOfWinner_idx").using("btree", table.isBestOfWinner.asc().nullsLast()),
	index("Business_isExpertPartner_idx").using("btree", table.isExpertPartner.asc().nullsLast()),
	uniqueIndex("Business_ownerId_key").using("btree", table.ownerId.asc().nullsLast()),
	uniqueIndex("Business_slug_key").using("btree", table.slug.asc().nullsLast()),
	index("Business_status_idx").using("btree", table.status.asc().nullsLast()),
	uniqueIndex("Business_stripeCustomerId_key").using("btree", table.stripeCustomerId.asc().nullsLast()),
	index("Business_tier_idx").using("btree", table.tier.asc().nullsLast()),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [category.id],
			name: "Business_categoryId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "Business_ownerId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const owner = pgTable("Owner", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	role: userRole().default('USER').notNull(),
	name: text(),
	email: text().notNull(),
	emailVerified: timestamp({ precision: 3, mode: 'date' }),
	image: text(),
	passwordHash: text(),
	resetToken: text(),
	resetExpires: timestamp({ precision: 3, mode: 'date' }),
	phone: text(),
	emailOptIn: boolean().default(false).notNull(),
	smsOptIn: boolean().default(false).notNull(),
	emailConsentAt: timestamp({ precision: 3, mode: 'date' }),
	smsConsentAt: timestamp({ precision: 3, mode: 'date' }),
	smsConsentSource: text(),
	lastBestOfVoteAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	uniqueIndex("Owner_email_key").using("btree", table.email.asc().nullsLast()),
	uniqueIndex("Owner_resetToken_key").using("btree", table.resetToken.asc().nullsLast()),
]);

export const account = pgTable("Account", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	userId: text().notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	uniqueIndex("Account_provider_providerAccountId_key").using("btree", table.provider.asc().nullsLast(), table.providerAccountId.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [owner.id],
			name: "Account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const session = pgTable("Session", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	sessionToken: text().notNull(),
	userId: text().notNull(),
	expires: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("Session_sessionToken_key").using("btree", table.sessionToken.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [owner.id],
			name: "Session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const review = pgTable("Review", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessId: text().notNull(),
	ownerId: text(),
	authorName: text().notNull(),
	authorEmail: text(),
	rating: integer().notNull(),
	content: text().notNull(),
	response: text(),
	flagged: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Review_businessId_idx").using("btree", table.businessId.asc().nullsLast()),
	index("Review_flagged_idx").using("btree", table.flagged.asc().nullsLast()),
	index("Review_ownerId_idx").using("btree", table.ownerId.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "Review_businessId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "Review_ownerId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const emailChangeRequest = pgTable("EmailChangeRequest", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	ownerId: text().notNull(),
	newEmail: text().notNull(),
	token: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	usedAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EmailChangeRequest_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast()),
	index("EmailChangeRequest_ownerId_idx").using("btree", table.ownerId.asc().nullsLast()),
	uniqueIndex("EmailChangeRequest_token_key").using("btree", table.token.asc().nullsLast()),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "EmailChangeRequest_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const socialPost = pgTable("SocialPost", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	platform: platform().notNull(),
	postUrl: text().notNull(),
	caption: text(),
	mediaUrl: text(),
	thumbnailUrl: text(),
	authorName: text(),
	authorAvatar: text(),
	status: postStatus().default('PENDING').notNull(),
	eventDate: timestamp({ precision: 3, mode: 'date' }),
	eventEndDate: timestamp({ precision: 3, mode: 'date' }),
	businessId: text(),
	submittedBy: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("SocialPost_businessId_idx").using("btree", table.businessId.asc().nullsLast()),
	index("SocialPost_eventDate_idx").using("btree", table.eventDate.asc().nullsLast()),
	index("SocialPost_status_idx").using("btree", table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "SocialPost_businessId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const venue = pgTable("Venue", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	org: text(),
	address: text().notNull(),
	city: text().notNull(),
	state: text().default('CA').notNull(),
	zip: text().notNull(),
	notes: text(),
	isTicketed: boolean().default(false).notNull(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Venue_city_idx").using("btree", table.city.asc().nullsLast()),
	index("Venue_name_idx").using("btree", table.name.asc().nullsLast()),
	uniqueIndex("Venue_slug_key").using("btree", table.slug.asc().nullsLast()),
]);

export const submission = pgTable("Submission", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	sourceUrl: text().notNull(),
	sourcePlatform: submissionSource().notNull(),
	sourceAuthorHandle: text(),
	sourceAuthorUrl: text(),
	sourceThumbnailUrl: text(),
	sourcePostCaption: text(),
	sourceCapturedAt: timestamp({ precision: 3, mode: 'date' }),
	thumbnailUrl: text(),
	title: text().notNull(),
	startsAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	endsAt: timestamp({ precision: 3, mode: 'date' }),
	venueName: text(),
	venueId: text(),
	address: text(),
	city: text(),
	state: text(),
	zip: text(),
	submittedById: text(),
	submitterNote: text(),
	status: submissionStatus().default('PENDING').notNull(),
	reviewedById: text(),
	reviewedAt: timestamp({ precision: 3, mode: 'date' }),
	rejectionReason: text(),
	promotedToEventId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Submission_createdAt_idx").using("btree", table.createdAt.asc().nullsLast()),
	uniqueIndex("Submission_slug_key").using("btree", table.slug.asc().nullsLast()),
	index("Submission_startsAt_idx").using("btree", table.startsAt.asc().nullsLast()),
	index("Submission_status_idx").using("btree", table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.venueId],
			foreignColumns: [venue.id],
			name: "Submission_venueId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.promotedToEventId],
			foreignColumns: [event.id],
			name: "Submission_promotedToEventId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const event = pgTable("Event", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	shareUrl: text(),
	title: text().notNull(),
	description: text(),
	startsAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	endsAt: timestamp({ precision: 3, mode: 'date' }),
	venueName: text(),
	venueTag: venueTag().default('OTHER').notNull(),
	category: eventCategory(),
	address: text(),
	city: text(),
	state: text(),
	zip: text(),
	heroImageUrl: text(),
	ticketUrl: text(),
	isFree: boolean().default(false).notNull(),
	esEnEspanol: boolean().default(false).notNull(),
	tier: eventTier().default('STANDARD').notNull(),
	source: text().notNull(),
	sourceUrl: text(),
	sourceAuthorHandle: text(),
	sourceAuthorUrl: text(),
	sourcePostExcerpt: text(),
	businessId: text(),
	venueId: text(),
	originatingSubmissionId: text(),
	submittedById: text(),
	reviewedById: text(),
	reviewedAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
	archivedAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("Event_archivedAt_idx").using("btree", table.archivedAt.asc().nullsLast()),
	index("Event_businessId_idx").using("btree", table.businessId.asc().nullsLast()),
	index("Event_category_idx").using("btree", table.category.asc().nullsLast()),
	index("Event_city_idx").using("btree", table.city.asc().nullsLast()),
	index("Event_esEnEspanol_idx").using("btree", table.esEnEspanol.asc().nullsLast()),
	uniqueIndex("Event_slug_key").using("btree", table.slug.asc().nullsLast()),
	index("Event_startsAt_idx").using("btree", table.startsAt.asc().nullsLast()),
	index("Event_tier_idx").using("btree", table.tier.asc().nullsLast()),
	index("Event_venueId_idx").using("btree", table.venueId.asc().nullsLast()),
	index("Event_venueTag_idx").using("btree", table.venueTag.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "Event_businessId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.venueId],
			foreignColumns: [venue.id],
			name: "Event_venueId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const eventAttendee = pgTable("EventAttendee", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	eventId: text().notNull(),
	ownerId: text().notNull(),
	status: eventAttendeeStatus().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("EventAttendee_eventId_idx").using("btree", table.eventId.asc().nullsLast()),
	uniqueIndex("EventAttendee_eventId_ownerId_key").using("btree", table.eventId.asc().nullsLast(), table.ownerId.asc().nullsLast()),
	index("EventAttendee_ownerId_idx").using("btree", table.ownerId.asc().nullsLast()),
	index("EventAttendee_status_idx").using("btree", table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "EventAttendee_eventId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "EventAttendee_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const bestOfCategory = pgTable("BestOfCategory", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	icon: text(),
	tagHints: text().array().$defaultFn(() => []).notNull(),
	published: boolean().default(false).notNull(),
	isSection: boolean().default(false).notNull(),
	imageUrl: text(),
	parentCategoryId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("BestOfCategory_isSection_idx").using("btree", table.isSection.asc().nullsLast()),
	index("BestOfCategory_parentCategoryId_idx").using("btree", table.parentCategoryId.asc().nullsLast()),
	index("BestOfCategory_published_idx").using("btree", table.published.asc().nullsLast()),
	index("BestOfCategory_slug_idx").using("btree", table.slug.asc().nullsLast()),
	uniqueIndex("BestOfCategory_slug_key").using("btree", table.slug.asc().nullsLast()),
	foreignKey({
			columns: [table.parentCategoryId],
			foreignColumns: [table.id],
			name: "BestOfCategory_parentCategoryId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const bestOfNominee = pgTable("BestOfNominee", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	categoryId: text().notNull(),
	businessId: text().notNull(),
	winner: boolean().default(false).notNull(),
	notes: text(),
	displayOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	uniqueIndex("BestOfNominee_categoryId_businessId_key").using("btree", table.categoryId.asc().nullsLast(), table.businessId.asc().nullsLast()),
	index("BestOfNominee_categoryId_idx").using("btree", table.categoryId.asc().nullsLast()),
	index("BestOfNominee_winner_idx").using("btree", table.winner.asc().nullsLast()),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [bestOfCategory.id],
			name: "BestOfNominee_categoryId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "BestOfNominee_businessId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const bestOfNomination = pgTable("BestOfNomination", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessName: text().notNull(),
	businessId: text(),
	categoryName: text().notNull(),
	nominatorName: text().notNull(),
	nominatorEmail: text().notNull(),
	reason: text().notNull(),
	accountCreated: boolean().default(false).notNull(),
	ownerId: text(),
	status: bestOfNominationStatus().default('PENDING').notNull(),
	emailOptIn: boolean().default(false).notNull(),
	smsOptIn: boolean().default(false).notNull(),
	emailConsentAt: timestamp({ precision: 3, mode: 'date' }),
	consentSource: text(),
	sourceIp: text(),
	userAgent: text(),
	reviewedBy: text(),
	reviewedAt: timestamp({ precision: 3, mode: 'date' }),
	rejectionReason: text(),
	adminNotes: text(),
	promotedNomineeId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("BestOfNomination_businessId_idx").using("btree", table.businessId.asc().nullsLast()),
	index("BestOfNomination_nominatorEmail_idx").using("btree", table.nominatorEmail.asc().nullsLast()),
	index("BestOfNomination_ownerId_idx").using("btree", table.ownerId.asc().nullsLast()),
	uniqueIndex("BestOfNomination_promotedNomineeId_key").using("btree", table.promotedNomineeId.asc().nullsLast()),
	index("BestOfNomination_status_createdAt_idx").using("btree", table.status.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "BestOfNomination_businessId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "BestOfNomination_ownerId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const bestOfVote = pgTable("BestOfVote", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	voterId: text().notNull(),
	nomineeId: text().notNull(),
	voterNameSnapshot: text().notNull(),
	voterImageSnapshot: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("BestOfVote_nomineeId_createdAt_idx").using("btree", table.nomineeId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("BestOfVote_voterId_createdAt_idx").using("btree", table.voterId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	uniqueIndex("BestOfVote_voterId_nomineeId_key").using("btree", table.voterId.asc().nullsLast(), table.nomineeId.asc().nullsLast()),
	foreignKey({
			columns: [table.voterId],
			foreignColumns: [owner.id],
			name: "BestOfVote_voterId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.nomineeId],
			foreignColumns: [bestOfNominee.id],
			name: "BestOfVote_nomineeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const guestAuthor = pgTable("GuestAuthor", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	displayName: text().notNull(),
	title: text(),
	bio: text().notNull(),
	photoUrl: text(),
	personalSiteUrl: text(),
	companyName: text(),
	companyUrl: text(),
	linkedinUrl: text(),
	twitterUrl: text(),
	facebookUrl: text(),
	instagramUrl: text(),
	businessId: text(),
	ownerId: text(),
	postsThisPeriod: integer().default(0).notNull(),
	periodStartedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastPostedAt: timestamp({ precision: 3, mode: 'date' }),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("GuestAuthor_isActive_idx").using("btree", table.isActive.asc().nullsLast()),
	index("GuestAuthor_slug_idx").using("btree", table.slug.asc().nullsLast()),
	uniqueIndex("GuestAuthor_slug_key").using("btree", table.slug.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "GuestAuthor_businessId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owner.id],
			name: "GuestAuthor_ownerId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const guestPost = pgTable("GuestPost", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	slug: text().notNull(),
	postType: text().default('GUEST').notNull(),
	title: text().notNull(),
	excerpt: text().notNull(),
	body: text().notNull(),
	heroImageUrl: text(),
	status: text().default('draft').notNull(),
	submittedAt: timestamp({ precision: 3, mode: 'date' }),
	scheduledFor: timestamp({ precision: 3, mode: 'date' }),
	publishedAt: timestamp({ precision: 3, mode: 'date' }),
	rejectionReason: text(),
	authorId: text(),
	editorNotes: text(),
	metaTitle: text(),
	metaDescription: text(),
	spotifyTrack1: text(),
	spotifyTrack2: text(),
	faqItems: jsonb().default([]),
	outingPhotos: jsonb().default([]).notNull(),
	youtubeVideoId: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("GuestPost_authorId_publishedAt_idx").using("btree", table.authorId.asc().nullsLast(), table.publishedAt.desc().nullsFirst()),
	index("GuestPost_postType_publishedAt_idx").using("btree", table.postType.asc().nullsLast(), table.publishedAt.desc().nullsFirst()),
	uniqueIndex("GuestPost_slug_key").using("btree", table.slug.asc().nullsLast()),
	index("GuestPost_status_publishedAt_idx").using("btree", table.status.asc().nullsLast(), table.publishedAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [guestAuthor.id],
			name: "GuestPost_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const expertPartnerLead = pgTable("ExpertPartnerLead", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessId: text().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	message: text().notNull(),
	sourceIp: text(),
	userAgent: text(),
	contacted: boolean().default(false).notNull(),
	contactedAt: timestamp({ precision: 3, mode: 'date' }),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("ExpertPartnerLead_businessId_createdAt_idx").using("btree", table.businessId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("ExpertPartnerLead_contacted_idx").using("btree", table.contacted.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "ExpertPartnerLead_businessId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const expertPartnerStat = pgTable("ExpertPartnerStat", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessId: text().notNull(),
	month: timestamp({ precision: 3, mode: 'date' }).notNull(),
	storyViews: integer().default(0).notNull(),
	newsletterOpens: integer().default(0).notNull(),
	listingClicks: integer().default(0).notNull(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("ExpertPartnerStat_businessId_month_idx").using("btree", table.businessId.asc().nullsLast(), table.month.desc().nullsFirst()),
	uniqueIndex("ExpertPartnerStat_businessId_month_key").using("btree", table.businessId.asc().nullsLast(), table.month.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "ExpertPartnerStat_businessId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const businessAudit = pgTable("BusinessAudit", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessId: text().notNull(),
	auditedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	httpStatus: integer(),
	finalUrl: text(),
	error: text(),
	pageLoadMs: integer(),
	contentLength: integer(),
	hasSsl: boolean().default(false).notNull(),
	isMobileFriendly: boolean().default(false).notNull(),
	siteLoads: boolean().default(false).notNull(),
	hasTitle: boolean().default(false).notNull(),
	hasMetaDescription: boolean().default(false).notNull(),
	hasSingleH1: boolean().default(false).notNull(),
	hasSitemap: boolean().default(false).notNull(),
	hasRobotsTxt: boolean().default(false).notNull(),
	hasSchemaOrg: boolean().default(false).notNull(),
	hasOpenGraph: boolean().default(false).notNull(),
	hasAltTextCoverage: boolean().default(false).notNull(),
	hasContactForm: boolean().default(false).notNull(),
	hasVisibleEmail: boolean().default(false).notNull(),
	foundEmail: text(),
	foundPhone: text(),
	hasGoogleAnalytics: boolean().default(false).notNull(),
	hasGoogleTagManager: boolean().default(false).notNull(),
	hasMetaPixel: boolean().default(false).notNull(),
	copyrightYear: integer(),
	hasDeprecatedHtml: boolean().default(false).notNull(),
	hasBlog: boolean().default(false).notNull(),
	score: integer().default(0).notNull(),
	rawHtml: text(),
	rawSignals: jsonb(),
}, (table) => [
	index("BusinessAudit_auditedAt_idx").using("btree", table.auditedAt.asc().nullsLast()),
	index("BusinessAudit_businessId_idx").using("btree", table.businessId.asc().nullsLast()),
	index("BusinessAudit_score_idx").using("btree", table.score.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "BusinessAudit_businessId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const deal = pgTable("Deal", {
	id: text().primaryKey().$defaultFn(() => createId()).notNull(),
	businessId: text().notNull(),
	headline: text().notNull(),
	description: text(),
	code: text(),
	imageUrl: text(),
	startsAt: timestamp({ precision: 3, mode: 'date' }),
	expiresAt: timestamp({ precision: 3, mode: 'date' }),
	displayOrder: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}, (table) => [
	index("Deal_businessId_isActive_displayOrder_idx").using("btree", table.businessId.asc().nullsLast(), table.isActive.asc().nullsLast(), table.displayOrder.asc().nullsLast()),
	index("Deal_createdAt_idx").using("btree", table.createdAt.asc().nullsLast()),
	index("Deal_isActive_expiresAt_idx").using("btree", table.isActive.asc().nullsLast(), table.expiresAt.asc().nullsLast()),
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "Deal_businessId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
