/**
 * VoteShareCard — the visual "I voted for X" share card.
 *
 * This is rendered as the preview on /best-of/voted/[voteId] AND will
 * become the source of truth for the dynamic OG image once Task 13
 * ships (the OG image renderer will use the same layout primitives).
 *
 * For now: pure server component, gradient background, voter avatar
 * (image OR initials-on-gradient fallback), nominee name + category,
 * and the MoVal.living brand mark.
 *
 * 1080×1350 aspect ratio (Instagram portrait). Future v2: render this
 * as a true <canvas> or hand off to next/og for the actual OG image;
 * for the share preview on this page, HTML+CSS is fine.
 */

interface VoteShareCardProps {
  voterName: string
  voterImage: string | null
  nomineeName: string
  nomineeLogo: string | null
  nomineeSlug: string
  categoryName: string
  categorySlug: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function avatarGradient(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  const complement = (hue + 35) % 360
  return [`hsl(${hue}, 65%, 45%)`, `hsl(${complement}, 60%, 35%)`]
}

export function VoteShareCard({
  voterName,
  voterImage,
  nomineeName,
  nomineeLogo,
  nomineeSlug,
  categoryName,
  categorySlug,
}: VoteShareCardProps) {
  const [from, to] = avatarGradient(voterName)

  return (
    <div
      className="aspect-[4/5] w-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 relative"
      style={{
        background:
          'linear-gradient(135deg, #00405c 0%, #007a7f 45%, #c9786d 100%)',
      }}
    >
      {/* Brand mark — top-left */}
      <div className="absolute top-5 left-5 flex items-center gap-2 text-white">
        <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-sm">
          M
        </div>
        <span className="text-sm font-bold tracking-wide">
          moval<span className="opacity-80">.living</span>
        </span>
      </div>

      {/* Year stamp — top-right */}
      <div className="absolute top-5 right-5 text-white/70 text-xs font-medium tracking-widest uppercase">
        Best Of · 2026
      </div>

      {/* Centered voter identity */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <div
          className="w-24 h-24 rounded-full ring-4 ring-white/30 shadow-xl flex items-center justify-center text-2xl font-bold text-white mb-4 overflow-hidden"
          style={{
            background: voterImage
              ? undefined
              : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        >
          {voterImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={voterImage}
              alt={voterName}
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials(voterName)}</span>
          )}
        </div>
        <p className="text-white/85 text-sm font-medium mb-1">
          {voterName}
        </p>
        <p className="text-white text-2xl font-bold leading-tight mb-1">
          voted for
        </p>
        <h2 className="text-white text-3xl sm:text-4xl font-bold leading-tight max-w-md">
          {nomineeName}
        </h2>
        <p className="text-white/75 text-sm mt-2">
          {categoryName}
        </p>
      </div>

      {/* Bottom CTA — link to cast your own vote */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center">
        <a
          href={`/best-of/${categorySlug}`}
          className="text-white/90 text-sm font-medium bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/25 transition-colors"
        >
          Cast your vote →
        </a>
      </div>

      {/* Hidden semantic text — for crawlers and the share-card OG
          image renderer (Task 13) to read structured data without
          parsing JSX. */}
      <span className="sr-only">
        {voterName} voted for {nomineeName} in {categoryName}. Business
        slug: {nomineeSlug}. Category slug: {categorySlug}.
      </span>
    </div>
  )
}
