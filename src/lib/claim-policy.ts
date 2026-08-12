export type ClaimableBusiness = {
  ownerId: string | null
  claimExpiresAt: Date | null
}

export function isClaimValid(business: ClaimableBusiness, now = new Date()): boolean {
  return !business.ownerId && !!business.claimExpiresAt && business.claimExpiresAt.getTime() > now.getTime()
}

export function getAutoApprovedClaimData(ownerId: string) {
  return {
    owner: { connect: { id: ownerId } },
    claimToken: null,
    claimExpiresAt: null,
    status: 'APPROVED' as const,
    // Live DB had this column already (from a sibling subagent's direct DDL)
    // but no code path was populating it. Setting it here means the homepage
    // "X just claimed..." ticker has data to surface once new claims happen.
    claimedAt: new Date(),
  }
}
