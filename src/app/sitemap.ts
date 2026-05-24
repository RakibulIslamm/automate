import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const now = new Date();
  const routes = ['/', '/pricing', '/legal/terms', '/legal/privacy'];
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.6,
  }));
}
