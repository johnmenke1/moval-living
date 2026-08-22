/**
 * VotersFeed — server component showing recent voters under a nominee.
 *
 * Calls the /api/best-of/nominees/[id]/voters endpoint on the server
 * (no HTTP overhead — direct Prisma query would also work but going
 * through the API keeps the contract in one place).
 *
 * Renders up to 12 recent voters as inline avatars + names, with a
 * "+N more" link if total exceeds displayed. Avatar is the voter's
 * profile image if set, otherwise their initials on a gradient bg.
 */

interface Voter {
  name: string
  image: string | null
  votedAt: string
}

interface VotersFeedProps {
  voters: Voter[]
  total: number
  displayed: number
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

// Deterministic gradient pair per name so the same voter always gets the
// same background. Uses a hash → small prime mod → hue rotation.
function avatarGradientForName(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  const complement = (hue + 35) % 360
  return [`hsl(${hue}, 65%, 45%)`, `hsl(${complement}, 60%, 35%)`]
}

// Re-export for unit tests; not part of the public component API.
export { initials, avatarGradientForName }

export function VotersFeed({ voters, total, displayed }: VotersFeedProps) {
  if (voters.length === 0) {
    return (
      <p className="mt-3 text-xs text-text-secondary">
        Be the first to vote.
      </p>
    )
  }

  const moreCount = Math.max(0, total - displayed)

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex -space-x-2">
          {voters.map((voter, idx) => {
            const [from, to] = avatarGradientForName(voter.name)
            return (
              <div
                key={`${voter.name}-${idx}`}
                title={`${voter.name} voted`}
                aria-label={`${voter.name} voted`}
                className="relative w-7 h-7 rounded-full ring-2 ring-white overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  background: voter.image
                    ? undefined
                    : `linear-gradient(135deg, ${from}, ${to})`,
                }}
              >
                {voter.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={voter.image}
                    alt={voter.name}
                    width={28}
                    height={28}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials(voter.name)}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="text-xs text-text-secondary leading-tight">
          <div className="font-medium text-text">
            {total} {total === 1 ? 'vote' : 'votes'}
          </div>
          {moreCount > 0 && (
            <div className="text-text-secondary">
              +{moreCount} more
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
