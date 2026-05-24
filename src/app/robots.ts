import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/api/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
