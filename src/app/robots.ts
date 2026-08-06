import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/claim/', '/my-submissions/'],
      },
    ],
    sitemap: 'https://www.moval.living/sitemap.xml',
    host: 'https://www.moval.living',
  }
}
