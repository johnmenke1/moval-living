/**
 * /best-of/voted/[voteId] helpers — pure functions for share-text
 * formatting and canonical-URL building. No DB or auth calls live here
 * so unit tests can verify the logic without spinning up Prisma.
 */

interface ShareMessageInput {
  voterName: string
  nomineeName: string
  categoryName: string
}

/**
 * Build the social-share message that gets injected into navigator.share()
 * or copied to the clipboard. Kept short so it fits in a single tweet.
 */
export function buildShareMessage({
  voterName,
  nomineeName,
  categoryName,
}: ShareMessageInput): string {
  return `${voterName} voted for ${nomineeName} in the Best Of MoVal — ${categoryName} category. Cast your vote:`
}

/**
 * Build the absolute share URL for a given vote id. Used as both the
 * canonical <link rel="canonical"> on the page AND the URL component of
 * any share message.
 */
export function buildCanonicalShareUrl(
  voteId: string,
  baseUrl: string,
): string {
  const cleaned = baseUrl.replace(/\/+$/, '')
  return `${cleaned}/best-of/voted/${voteId}`
}
