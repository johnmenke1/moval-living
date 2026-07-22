import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export function generateBusinessSlug(name: string, id: string): string {
  const base = slugify(name)
  const shortId = id.slice(-6).toLowerCase()
  return `${base}-${shortId}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function isBusinessOpen(hours: Record<string, { open: string; close: string; closed: boolean }> | null): boolean {
  if (!hours) return false
  const now = new Date()
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const today = days[now.getDay()]
  const todayHours = hours[today]
  
  if (!todayHours || todayHours.closed) return false
  
  const currentTime = now.getHours() * 60 + now.getMinutes()
  const [openHour, openMin] = todayHours.open.replace(/[APM\s]/g, '').split(':').map(Number)
  const [closeHour, closeMin] = todayHours.close.replace(/[APM\s]/g, '').split(':').map(Number)
  
  const openTime = (openHour % 12) * 60 + openMin + (todayHours.open.includes('PM') ? 720 : 0)
  const closeTime = (closeHour % 12) * 60 + closeMin + (todayHours.close.includes('PM') ? 720 : 0)
  
  return currentTime >= openTime && currentTime <= closeTime
}

export function averageRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
}
