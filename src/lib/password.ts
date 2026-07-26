import bcrypt from 'bcryptjs'

// 12 rounds is bcryptjs's default and a sensible baseline for interactive
// login on commodity hardware. Bumping this up doubles compute per login;
// for an admin dashboard with a handful of users, 12 is fine.
const BCRYPT_COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}