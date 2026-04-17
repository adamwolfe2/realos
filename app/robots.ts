import { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/get-site-url'

const SITE_URL = getSiteUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/client-portal/',
          '/api/',
          '/print/',
          '/supplier/',
          '/checkout/',
          '/sign-in/',
          '/sign-up/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
