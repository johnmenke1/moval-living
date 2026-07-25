import { DefaultSession } from 'next-auth'

type MovalRole = 'USER' | 'ADMIN'

declare module 'next-auth' {
  interface User {
    role?: MovalRole
  }

  interface Session {
    user: {
      id: string
      role: MovalRole
    } & DefaultSession['user']
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string
    role?: MovalRole
  }
}
