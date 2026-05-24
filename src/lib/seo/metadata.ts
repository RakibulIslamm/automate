import type { Metadata } from 'next';
import { env } from '@/lib/env';

interface BuildMetadataInput {
  title?: string;
  description?: string;
  /** Path relative to the site root, e.g. `/pricing`. Used to set canonical + OG urls. */
  path?: string;
  /** Override the dynamic OG image route. */
  image?: string;
  noIndex?: boolean;
}

const DEFAULT_TITLE = 'AutoMate — AI-powered workflow automation';
const DEFAULT_DESCRIPTION =
  "Describe an automation in plain English. AutoMate's AI builds and runs the workflow across Gmail, Drive, Slack, Notion and Calendar — no clicking through menus.";

function baseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}

/**
 * Single source of truth for page metadata. Pages call this in their
 * `export const metadata = buildMetadata({...})` so every public route
 * gets a consistent title/description, canonical URL, and dynamic OG
 * card. Defaults match the root layout — overrides only need to
 * specify what's different.
 */
export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const title = input.title ?? DEFAULT_TITLE;
  const description = input.description ?? DEFAULT_DESCRIPTION;
  const url = `${baseUrl()}${input.path ?? '/'}`;
  const image = input.image ?? `${baseUrl()}/opengraph-image`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl()),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AutoMate',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: 'AutoMate' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
