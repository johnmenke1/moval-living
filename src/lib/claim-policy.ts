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
  }
}
