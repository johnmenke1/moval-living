'use client'

// Required by Next.js 16 to render the global error page.
// Workaround for https://github.com/vercel/next.js/issues/83613
// (Internal workStore not-initialized bug during static prerender of /_global-error).
// `dynamic = 'force-dynamic'` is the workaround from vercel/next.js discussion #74858.
export const dynamic = 'force-dynamic'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
