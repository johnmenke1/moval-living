import { slugify } from './utils'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Address {
  streetAddress: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

export interface GeoCoordinate {
  latitude: number
  longitude: number
}

export interface OpeningHours {
  dayOfWeek: string
  opens: string
  closes: string
}

export interface Review {
  author: string
  datePublished: string
  reviewBody: string
  reviewRating: number
}

export interface MenuItemInfo {
  name: string
  price: string
}

export interface PriceRange {
  priceRange: string
}

export interface GeoCircle {
  type: 'GeoCircle'
  geoMidpoint: GeoCoordinate
  geoRadius: string
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface AboutPage {
  type: 'AboutPage'
  description: string
  dateCreated?: string
  dateModified?: string
  author?: string
}

export interface Event {
  type: 'Event'
  name: string
  description: string
  startDate: string
  endDate: string
  eventStatus?: 'EventScheduled' | 'EventMoved' | 'EventPostponed' | 'EventRescheduled' | 'EventScheduled'
  eventAttendanceMode?: 'OnlineEventAttendanceMode' | 'OfflineEventAttendanceMode' | 'MixedEventAttendanceMode'
  location?: {
    type: 'Place' | 'VirtualLocation'
    name?: string
    address?: Address
    url?: string
  }
  organizer?: {
    type: 'Organization' | 'Person'
    name: string
    url?: string
  }
  performer?: {
    type: 'Organization' | 'Person'
    name: string
  }
  offers?: {
    price: string
    priceCurrency: string
    availability?: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock'
    url?: string
    validFrom?: string
  }
  geo?: GeoCircle
  image?: string
  keywords?: string
}

export interface CollectionPage {
  type: 'CollectionPage'
  name: string
  description: string
  url: string
  dateCreated?: string
  dateModified?: string
  breadcrumb?: BreadcrumbItem[]
}

export interface ItemListElement {
  position: number
  name: string
  url: string
  image?: string
  description?: string
  price?: string
  priceCurrency?: string
}

export interface LocalBusiness {
  type:
    | 'RealEstateAgent'
    | 'LocalBusiness'
    | 'HomeAndConstructionBusiness'
    | 'RealEstateListing'
  id: string
  name: string
  description: string
  url: string
  telephone?: string
  email?: string
  address?: Address
  geo?: {
    type: 'GeoCoordinates'
    latitude: number
    longitude: number
  }
  coordinates?: GeoCoordinate
  openingHoursSpecification?: OpeningHours[]
  rating?: {
    ratingValue: string
    reviewCount: number
    bestRating?: string
    worstRating?: string
  }
  review?: Review[]
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
    bestRating?: number
    worstRating?: number
  }
  priceRange?: string
  image?: string
  logo?: string
  sameAs?: string[]
  areaServed?: {
    type: string
    name: string
  }
  hasMenu?: MenuItemInfo[] | PriceRange
  latitude?: number
  longitude?: number
}

export interface WebSite {
  type: 'WebSite'
  name: string
  url: string
  description?: string
  inLanguage?: string
  publisher?: {
    type: 'Organization'
    name: string
    url?: string
    logo?: string
  }
  potentialAction?: {
    type: 'SearchAction'
    target: {
      type: 'EntryPoint'
      urlTemplate: string
    }
    query: string
  }
  sameAs?: string[]
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Build a GeoCircle JSON-LD object.
 * @param latitude  Center latitude
 * @param longitude Center longitude
 * @param radiusMeters Radius as a string with unit, e.g. "500 m"
 */
export function buildGeoCircle(
  latitude: number,
  longitude: number,
  radiusMeters: string
): GeoCircle {
  return {
    type: 'GeoCircle',
    geoMidpoint: { latitude, longitude },
    geoRadius: radiusMeters,
  }
}

/**
 * Build a BreadcrumbList JSON-LD object.
 * @param items Ordered list of breadcrumb items (home → ... → current)
 */
export function buildBreadcrumbList(items: BreadcrumbItem[]): {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Build a LocalBusiness JSON-LD object.
 * @param business LocalBusiness input data
 */
export function buildLocalBusiness(business: LocalBusiness): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': business.type,
    '@id': business.id,
    name: business.name,
    description: business.description,
    url: business.url,
    ...(business.telephone && { telephone: business.telephone }),
    ...(business.email && { email: business.email }),
    ...(business.address && { address: { ...business.address, '@type': 'PostalAddress' } }),
    ...(business.coordinates || (business.latitude != null && business.longitude != null)
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: business.coordinates?.latitude ?? business.latitude,
            longitude: business.coordinates?.longitude ?? business.longitude,
          },
        }
      : {}),
    ...(business.openingHoursSpecification && {
      openingHoursSpecification: business.openingHoursSpecification,
    }),
    ...(business.rating && {
      rating: {
        '@type': 'AggregateRating',
        ratingValue: business.rating.ratingValue,
        reviewCount: business.rating.reviewCount,
        bestRating: business.rating.bestRating,
        worstRating: business.rating.worstRating,
      },
    }),
    ...(business.review?.length && {
      review: business.review.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        datePublished: r.datePublished,
        reviewBody: r.reviewBody,
        reviewRating: { '@type': 'Rating', ratingValue: r.reviewRating },
      })),
    }),
    ...(business.aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: business.aggregateRating.ratingValue,
        reviewCount: business.aggregateRating.reviewCount,
        bestRating: business.aggregateRating.bestRating,
        worstRating: business.aggregateRating.worstRating,
      },
    }),
    ...(business.priceRange && { priceRange: business.priceRange }),
    ...(business.image && { image: business.image }),
    ...(business.logo && { logo: business.logo }),
    ...(business.sameAs?.length && { sameAs: business.sameAs }),
    ...(business.areaServed && { areaServed: business.areaServed }),
    ...(business.hasMenu && { hasMenu: business.hasMenu }),
  }
}

/**
 * Build a CollectionPage JSON-LD object.
 * @param page CollectionPage input data
 */
export function buildCollectionPage(page: CollectionPage): {
  '@context': 'https://schema.org'
  '@type': 'CollectionPage'
  name: string
  description: string
  url: string
  dateCreated?: string
  dateModified?: string
  breadcrumb?: ReturnType<typeof buildBreadcrumbList>
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: page.name,
    description: page.description,
    url: page.url,
    ...(page.dateCreated && { dateCreated: page.dateCreated }),
    ...(page.dateModified && { dateModified: page.dateModified }),
    ...(page.breadcrumb && page.breadcrumb.length > 0 && {
      breadcrumb: buildBreadcrumbList(page.breadcrumb),
    }),
  }
}

/**
 * Build an ItemList JSON-LD object.
 * @param name     Human-readable list name
 * @param elements Ordered list items
 * @param baseUrl  Used to auto-generate @id if not provided
 */
export function buildItemList(
  name: string,
  elements: ItemListElement[],
  baseUrl?: string
): {
  '@context': 'https://schema.org'
  '@type': 'ItemList'
  name: string
  numberOfItems: number
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    url: string
    image?: string
    description?: string
    offers?: {
      '@type': 'Offer'
      price: string
      priceCurrency: string
    }
  }>
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: elements.length,
    itemListElement: elements.map((el) => ({
      '@type': 'ListItem',
      position: el.position,
      name: el.name,
      url: el.url,
      ...(el.image && { image: el.image }),
      ...(el.description && { description: el.description }),
      ...(el.price &&
        el.priceCurrency && {
          offers: {
            '@type': 'Offer',
            price: el.price,
            priceCurrency: el.priceCurrency,
          },
        }),
    })),
  }
}

/**
 * Build an FAQPage JSON-LD object.
 * @param faqs Array of question/answer pairs
 */
export function buildFAQPage(faqs: FAQItem[]): {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: {
      '@type': 'Answer'
      text: string
    }
  }>
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * Build a WebSite JSON-LD object with optional search action.
 * @param site Site metadata
 * @param searchUrlTemplate URL template with {searchTermString}, e.g. "https://example.com/search?q={searchTermString}"
 */
export function buildWebSite(
  site: WebSite,
  searchUrlTemplate?: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.url,
    ...(site.description && { description: site.description }),
    ...(site.inLanguage && { inLanguage: site.inLanguage }),
    ...(site.publisher && {
      publisher: {
        '@type': 'Organization',
        name: site.publisher.name,
        ...(site.publisher.url && { url: site.publisher.url }),
        ...(site.publisher.logo && { logo: site.publisher.logo }),
      },
    }),
    ...(searchUrlTemplate && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: searchUrlTemplate,
        },
        query: 'required name=searchTermString',
      },
    }),
    ...(site.sameAs?.length && { sameAs: site.sameAs }),
  }
}

/**
 * Build an AboutPage JSON-LD object.
 * @param page AboutPage input data
 */
export function buildAboutPage(page: AboutPage): {
  '@context': 'https://schema.org'
  '@type': 'AboutPage'
  description: string
  dateCreated?: string
  dateModified?: string
  author?: {
    '@type': 'Person' | 'Organization'
    name: string
  }
} {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    description: page.description,
    ...(page.dateCreated && { dateCreated: page.dateCreated }),
    ...(page.dateModified && { dateModified: page.dateModified }),
    ...(page.author && {
      author: {
        '@type': 'Person',
        name: page.author,
      },
    }),
  }
}

/**
 * Build an Event JSON-LD object.
 * @param event Event input data
 */
export function buildEvent(event: Event): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    ...(event.eventStatus && { eventStatus: `https://schema.org/${event.eventStatus}` }),
    ...(event.eventAttendanceMode && {
      eventAttendanceMode: `https://schema.org/${event.eventAttendanceMode}`,
    }),
    ...(event.location && {
      location: {
        '@type': event.location.type,
        ...(event.location.name && { name: event.location.name }),
        ...(event.location.address && {
          address: { ...event.location.address, '@type': 'PostalAddress' },
        }),
        ...(event.location.url && { url: event.location.url }),
      },
    }),
    ...(event.organizer && {
      organizer: {
        '@type': event.organizer.type,
        name: event.organizer.name,
        ...(event.organizer.url && { url: event.organizer.url }),
      },
    }),
    ...(event.performer && {
      performer: {
        '@type': event.performer.type,
        name: event.performer.name,
      },
    }),
    ...(event.offers && {
      offers: {
        '@type': 'Offer',
        price: event.offers.price,
        priceCurrency: event.offers.priceCurrency,
        ...(event.offers.availability && { availability: event.offers.availability }),
        ...(event.offers.url && { url: event.offers.url }),
        ...(event.offers.validFrom && { validFrom: event.offers.validFrom }),
      },
    }),
    ...(event.geo && { geo: event.geo }),
    ...(event.image && { image: event.image }),
    ...(event.keywords && { keywords: event.keywords }),
  }
}

// ---------------------------------------------------------------------------
// Convenience: serialize JSON-LD to <script> tag string
// ---------------------------------------------------------------------------

/**
 * Wrap a JSON-LD graph in a <script type="application/ld+json"> tag.
 * Accepts any JSON-LD-compatible object.
 */
export function toScriptTag(graph: unknown): string {
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`
}

/**
 * Combine multiple JSON-LD objects into a @graph array inside a single
 * application/ld+json script tag. Use for pages that need multiple types.
 */
export function toGraphScriptTag(
  graphs: Array<unknown>
): string {
  return toScriptTag({ '@context': 'https://schema.org', '@graph': graphs })
}
