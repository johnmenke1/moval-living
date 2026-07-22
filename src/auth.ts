import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    // Minimal credentials provider — real auth is out of scope for MVP.
    // Swap this for Google OAuth or add bcrypt password check when ready.
    Credentials({
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Demo: any email/password combo creates a session.
        // Replace with real DB lookup + bcrypt.compare() before launch.
        if (!credentials?.email) return null
        return { id: '1', email: credentials.email as string, name: 'Business Owner' }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
  trustHost: true,
})
