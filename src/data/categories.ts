export interface Category {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  image: string
  count?: number
}

export const categories: Category[] = [
  {
    id: 'restaurants',
    name: 'Restaurants & Dining',
    slug: 'restaurants',
    description: 'Local eateries, cafes, food trucks, and catering',
    icon: 'UtensilsCrossed',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  },
  {
    id: 'contractors',
    name: 'Contractors & Construction',
    slug: 'contractors',
    description: 'Home builders, remodelers, plumbers, electricians',
    icon: 'HardHat',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    slug: 'healthcare',
    description: 'Doctors, dentists, clinics, pharmacies, specialists',
    icon: 'Stethoscope',
    image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=80',
  },
  {
    id: 'retail',
    name: 'Retail & Shopping',
    slug: 'retail',
    description: 'Boutiques, shops, stores, and e-commerce locals',
    icon: 'ShoppingBag',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
  },
  {
    id: 'automotive',
    name: 'Automotive',
    slug: 'automotive',
    description: 'Auto repair, dealerships, parts, tires, detailing',
    icon: 'Car',
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80',
  },
  {
    id: 'professional',
    name: 'Professional Services',
    slug: 'professional',
    description: 'Attorneys, accountants, real estate, insurance',
    icon: 'Briefcase',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
  },
  {
    id: 'beauty',
    name: 'Beauty & Wellness',
    slug: 'beauty',
    description: 'Salons, spas, gyms, yoga, nails, barbers',
    icon: 'Sparkles',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  },
  {
    id: 'home-services',
    name: 'Home Services',
    slug: 'home-services',
    description: 'Landscaping, cleaning, pest control, HVAC, painting',
    icon: 'Wrench',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80',
  },
  {
    id: 'education',
    name: 'Education & Tutoring',
    slug: 'education',
    description: 'Schools, tutors, music lessons, driving instructors',
    icon: 'GraduationCap',
    image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80',
  },
  {
    id: 'pets',
    name: 'Pets & Veterinary',
    slug: 'pets',
    description: 'Vets, pet stores, grooming, dog walking, boarding',
    icon: 'PawPrint',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
  },
  {
    id: 'finance',
    name: 'Banks & Financial',
    slug: 'finance',
    description: 'Banks, credit unions, loan officers, financial advisors',
    icon: 'Landmark',
    image: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297a?w=800&q=80',
  },
  {
    id: 'auto',
    name: 'Auto & Transportation',
    slug: 'auto',
    description: 'Repair shops, tires, auto parts, body shops',
    icon: 'Gauge',
    image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&q=80',
  },
  {
    id: 'real-estate',
    name: 'Real Estate & Mortgage',
    slug: 'real-estate',
    description: 'Realtors, mortgage brokers, title companies, property managers',
    icon: 'Building',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  },
]

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find(c => c.slug === slug)
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id)
}
