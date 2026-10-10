// Relations — field names intentionally match the former Prisma schema
// (e.g. GuestPost.author, GuestAuthor.posts) so `with: { author: true }`
// call sites read the same as the old `include: { author: true }`.
// This file is now hand-maintained; drizzle-kit pull does NOT regenerate these names.
import { relations } from "drizzle-orm/relations"
import { business, venue, category, owner, account, session, review, emailChangeRequest, socialPost, submission, event, eventAttendee, bestOfCategory, bestOfNominee, bestOfNomination, bestOfVote, guestAuthor, guestPost, expertPartnerLead, expertPartnerStat, businessAudit, deal } from "./schema"

export const businessRelations = relations(business, ({ one, many }) => ({
	category: one(category, { fields: [business.categoryId], references: [category.id] }),
	owner: one(owner, { fields: [business.ownerId], references: [owner.id] }),
	reviews: many(review),
	socialPosts: many(socialPost),
	bestOfNominees: many(bestOfNominee),
	bestOfNominations: many(bestOfNomination),
	guestAuthors: many(guestAuthor),
	expertPartnerLeads: many(expertPartnerLead),
	expertPartnerStats: many(expertPartnerStat),
	audits: many(businessAudit),
	events: many(event),
	deals: many(deal),
}))

export const venueRelations = relations(venue, ({ many }) => ({
	events: many(event),
	submissions: many(submission),
}))

export const categoryRelations = relations(category, ({ many }) => ({
	businesses: many(business),
}))

export const ownerRelations = relations(owner, ({ one, many }) => ({
	accounts: many(account),
	sessions: many(session),
	business: one(business),
	guestAuthors: many(guestAuthor),
	bestOfVotes: many(bestOfVote),
	reviews: many(review),
	bestOfNominations: many(bestOfNomination),
	emailChangeRequests: many(emailChangeRequest),
	eventAttendees: many(eventAttendee),
}))

export const accountRelations = relations(account, ({ one }) => ({
	owner: one(owner, { fields: [account.userId], references: [owner.id] }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
	owner: one(owner, { fields: [session.userId], references: [owner.id] }),
}))

export const reviewRelations = relations(review, ({ one }) => ({
	business: one(business, { fields: [review.businessId], references: [business.id] }),
	owner: one(owner, { fields: [review.ownerId], references: [owner.id] }),
}))

export const emailChangeRequestRelations = relations(emailChangeRequest, ({ one }) => ({
	owner: one(owner, { fields: [emailChangeRequest.ownerId], references: [owner.id] }),
}))

export const socialPostRelations = relations(socialPost, ({ one }) => ({
	business: one(business, { fields: [socialPost.businessId], references: [business.id] }),
}))

export const submissionRelations = relations(submission, ({ one }) => ({
	venue: one(venue, { fields: [submission.venueId], references: [venue.id] }),
	promotedToEvent: one(event, { fields: [submission.promotedToEventId], references: [event.id], relationName: "SubmissionToEvent" }),
}))

export const eventRelations = relations(event, ({ one, many }) => ({
	business: one(business, { fields: [event.businessId], references: [business.id] }),
	venue: one(venue, { fields: [event.venueId], references: [venue.id] }),
	submissions: many(submission, { relationName: "SubmissionToEvent" }),
	attendees: many(eventAttendee),
}))

export const eventAttendeeRelations = relations(eventAttendee, ({ one }) => ({
	event: one(event, { fields: [eventAttendee.eventId], references: [event.id] }),
	owner: one(owner, { fields: [eventAttendee.ownerId], references: [owner.id] }),
}))

export const bestOfCategoryRelations = relations(bestOfCategory, ({ one, many }) => ({
	parentCategory: one(bestOfCategory, { fields: [bestOfCategory.parentCategoryId], references: [bestOfCategory.id], relationName: "BestOfCategoryHierarchy" }),
	subCategories: many(bestOfCategory, { relationName: "BestOfCategoryHierarchy" }),
	nominees: many(bestOfNominee),
}))

export const bestOfNomineeRelations = relations(bestOfNominee, ({ one, many }) => ({
	category: one(bestOfCategory, { fields: [bestOfNominee.categoryId], references: [bestOfCategory.id] }),
	business: one(business, { fields: [bestOfNominee.businessId], references: [business.id] }),
	votes: many(bestOfVote),
}))

export const bestOfNominationRelations = relations(bestOfNomination, ({ one }) => ({
	business: one(business, { fields: [bestOfNomination.businessId], references: [business.id] }),
	owner: one(owner, { fields: [bestOfNomination.ownerId], references: [owner.id] }),
}))

export const bestOfVoteRelations = relations(bestOfVote, ({ one }) => ({
	voter: one(owner, { fields: [bestOfVote.voterId], references: [owner.id] }),
	nominee: one(bestOfNominee, { fields: [bestOfVote.nomineeId], references: [bestOfNominee.id] }),
}))

export const guestAuthorRelations = relations(guestAuthor, ({ one, many }) => ({
	business: one(business, { fields: [guestAuthor.businessId], references: [business.id] }),
	owner: one(owner, { fields: [guestAuthor.ownerId], references: [owner.id] }),
	posts: many(guestPost),
}))

export const guestPostRelations = relations(guestPost, ({ one }) => ({
	author: one(guestAuthor, { fields: [guestPost.authorId], references: [guestAuthor.id] }),
}))

export const expertPartnerLeadRelations = relations(expertPartnerLead, ({ one }) => ({
	business: one(business, { fields: [expertPartnerLead.businessId], references: [business.id] }),
}))

export const expertPartnerStatRelations = relations(expertPartnerStat, ({ one }) => ({
	business: one(business, { fields: [expertPartnerStat.businessId], references: [business.id] }),
}))

export const businessAuditRelations = relations(businessAudit, ({ one }) => ({
	business: one(business, { fields: [businessAudit.businessId], references: [business.id] }),
}))

export const dealRelations = relations(deal, ({ one }) => ({
	business: one(business, { fields: [deal.businessId], references: [business.id] }),
}))
