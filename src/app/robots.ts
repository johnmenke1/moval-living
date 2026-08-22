import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /claim/ is the acquisition landing page (rank for "claim your
        // business listing") — allow it. Only disallow the post-action
        // confirmation pages that have no SEO value and shouldn't end
        // up in search results.
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/claim/complete',
          '/claim/success',
          '/my-submissions/',
        ],
      },
    ],
    sitemap: 'https://www.moval.living/sitemap.xml',
    host: 'https://www.moval.living',
  }
}
