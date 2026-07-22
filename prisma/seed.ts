import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  { name: 'Restaurants & Dining', slug: 'restaurants', description: 'Local eateries, cafes, food trucks, and catering', icon: 'UtensilsCrossed' },
  { name: 'Contractors & Construction', slug: 'contractors', description: 'Home builders, remodelers, plumbers, electricians', icon: 'HardHat' },
  { name: 'Healthcare & Medical', slug: 'healthcare', description: 'Doctors, dentists, clinics, pharmacies, specialists', icon: 'Stethoscope' },
  { name: 'Retail & Shopping', slug: 'retail', description: 'Boutiques, shops, stores, and e-commerce locals', icon: 'ShoppingBag' },
  { name: 'Automotive', slug: 'automotive', description: 'Auto repair, dealerships, parts, tires, detailing', icon: 'Car' },
  { name: 'Professional Services', slug: 'professional', description: 'Attorneys, accountants, real estate, insurance', icon: 'Briefcase' },
  { name: 'Beauty & Wellness', slug: 'beauty', description: 'Salons, spas, gyms, yoga, nails, barbers', icon: 'Sparkles' },
  { name: 'Home Services', slug: 'home-services', description: 'Landscaping, cleaning, pest control, HVAC, painting', icon: 'Wrench' },
  { name: 'Education & Tutoring', slug: 'education', description: 'Schools, tutors, music lessons, driving instructors', icon: 'GraduationCap' },
  { name: 'Pets & Veterinary', slug: 'pets', description: 'Vets, pet stores, grooming, dog walking, boarding', icon: 'PawPrint' },
  { name: 'Banks & Financial', slug: 'finance', description: 'Banks, credit unions, loan officers, financial advisors', icon: 'Landmark' },
]

async function main() {
  console.log('🌱 Seeding database...')

  // Create categories
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }
  console.log(`✅ Created ${categories.length} categories`)

  // Get category IDs
  const catMap: Record<string, string> = {}
  const dbCategories = await prisma.category.findMany()
  for (const cat of dbCategories) {
    catMap[cat.slug] = cat.id
  }

  // Create sample businesses
  const businesses = [
    {
      slug: 'ranch-deli-moval-abc123',
      name: 'Ranch Deli & Grill',
      tagline: 'Authentic Mexican flavors in Moreno Valley',
      description: `Ranch Deli & Grill has been serving the Moreno Valley community for over 15 years with authentic Mexican cuisine made from fresh, locally-sourced ingredients. Our family recipes have been passed down through three generations, and every dish is prepared with love and the finest ingredients.

Our menu features classic favorites like carnitas, al pastor, and bistek, along with daily specials that showcase seasonal ingredients. Whether you're craving a quick taco or a full family feast, Ranch Deli has something for everyone.

We take pride in our fast, friendly service and our commitment to the community. From local school fundraisers to youth sports sponsorships, Ranch Deli gives back to the neighborhood that has supported us for so long.`,
      categorySlug: 'restaurants',
      tier: 'FEATURED' as const,
      status: 'APPROVED' as const,
      address: '24140 Sunnymead Blvd',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      phone: '951-555-0142',
      email: 'info@ranchdelimoval.com',
      website: 'https://ranchdelimoval.com',
      facebook: 'https://facebook.com/ranchdeli',
      instagram: 'https://instagram.com/ranchdelimoval',
      hours: {
        mon: { open: '7:00 AM', close: '9:00 PM', closed: false },
        tue: { open: '7:00 AM', close: '9:00 PM', closed: false },
        wed: { open: '7:00 AM', close: '9:00 PM', closed: false },
        thu: { open: '7:00 AM', close: '9:00 PM', closed: false },
        fri: { open: '7:00 AM', close: '10:00 PM', closed: false },
        sat: { open: '8:00 AM', close: '10:00 PM', closed: false },
        sun: { open: '8:00 AM', close: '8:00 PM', closed: false },
      },
    },
    {
      slug: 'valley-dental-care-def456',
      name: 'Valley Dental Care',
      tagline: 'Comfortable family dentistry in Moreno Valley',
      description: `Valley Dental Care provides comprehensive dental services for the entire family in a comfortable, modern environment. Dr. Sarah Chen and our experienced team are committed to making every visit a positive experience.

From routine cleanings and check-ups to cosmetic dentistry and orthodontics, we offer a full range of services to keep your smile healthy and beautiful. We use the latest dental technology, including digital X-rays and laser dentistry, to ensure the best outcomes for our patients.

We accept most insurance plans and offer flexible payment options to make dental care accessible to everyone in Moreno Valley. New patients are always welcome!`,
      categorySlug: 'healthcare',
      tier: 'FEATURED' as const,
      status: 'APPROVED' as const,
      address: '12900 Frederick St, Suite B',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      phone: '951-555-0199',
      email: 'appointments@valleydentalcare.com',
      website: 'https://valleydentalcaremv.com',
      hours: {
        mon: { open: '8:00 AM', close: '5:00 PM', closed: false },
        tue: { open: '8:00 AM', close: '5:00 PM', closed: false },
        wed: { open: '10:00 AM', close: '7:00 PM', closed: false },
        thu: { open: '8:00 AM', close: '5:00 PM', closed: false },
        fri: { open: '8:00 AM', close: '3:00 PM', closed: false },
        sat: { open: '9:00 AM', close: '1:00 PM', closed: false },
        sun: { open: '', close: '', closed: true },
      },
    },
    {
      slug: 'moval-auto-repair-ghi789',
      name: "Moval Auto Repair & Tires",
      tagline: "Honest auto care you can trust",
      description: `Moval Auto Repair & Tires has been keeping Moreno Valley drivers safe on the road for over 20 years. As a family-owned and operated shop, we treat every customer like family.

Our ASE-certified technicians handle everything from oil changes and brake service to complete engine repair and transmission work. We also stock a wide selection of tires from top brands at competitive prices, with free rotation and alignment with every purchase.

We believe in honest, upfront pricing with no surprises. Every repair is explained in plain language, and we never recommend work you don't need. Our goal is to build lasting relationships with our customers based on trust and quality workmanship.`,
      categorySlug: 'automotive',
      tier: 'FREE' as const,
      status: 'APPROVED' as const,
      address: '25520 Alessandro Blvd',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      phone: '951-555-0177',
      email: 'service@movalautorepair.com',
      hours: {
        mon: { open: '7:30 AM', close: '6:00 PM', closed: false },
        tue: { open: '7:30 AM', close: '6:00 PM', closed: false },
        wed: { open: '7:30 AM', close: '6:00 PM', closed: false },
        thu: { open: '7:30 AM', close: '6:00 PM', closed: false },
        fri: { open: '7:30 AM', close: '5:00 PM', closed: false },
        sat: { open: '8:00 AM', close: '2:00 PM', closed: false },
        sun: { open: '', close: '', closed: true },
      },
    },
  ]

  for (const biz of businesses) {
    const { categorySlug, hours, ...bizData } = biz
    await prisma.business.upsert({
      where: { slug: biz.slug },
      update: {},
      create: {
        ...bizData,
        categoryId: catMap[categorySlug],
        hours,
      },
    })

    // Add sample reviews
    const business = await prisma.business.findUnique({ where: { slug: biz.slug } })
    if (business) {
      const reviews = [
        { authorName: 'Jennifer L.', rating: 5, content: 'Absolutely love this place! The food is always fresh and the staff is incredibly friendly.' },
        { authorName: 'Robert M.', rating: 4, content: 'Great quality for the price. Will definitely be coming back!' },
        { authorName: 'Ana R.', rating: 5, content: 'Best kept secret in Moreno Valley. The portions are huge and the flavors are amazing.' },
      ]
      for (const review of reviews) {
        await prisma.review.upsert({
          where: { id: `${business.id}-${review.authorName.toLowerCase().replace(' ', '-')}` },
          update: {},
          create: { ...review, businessId: business.id },
        })
      }
    }
  }
  console.log(`✅ Created ${businesses.length} sample businesses with reviews`)

  console.log('\n🎉 Seed complete!')
  console.log('   Database URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
