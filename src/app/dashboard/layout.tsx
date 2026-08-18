// Every dashboard route depends on the current authenticated session and
// owner-specific database state. Keep the entire private area dynamic.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
