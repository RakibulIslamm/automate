import { ImageResponse } from 'next/og';

/**
 * Dynamic OG image — rendered on the edge for every social share. We
 * keep it simple: warm off-white background, big serif headline, tagline,
 * and a wordmark. Matches the marketing/dashboard aesthetic so the share
 * card and the page look related.
 */

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: '#FAF9F6',
          color: '#171717',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 500 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: '#171717',
            }}
          />
          AutoMate
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              fontWeight: 400,
              fontFamily: 'serif',
              maxWidth: 1000,
            }}
          >
            Automate anything you can describe.
          </div>
          <div style={{ fontSize: 28, color: '#525252', maxWidth: 900 }}>
            AI-built workflows across Gmail, Drive, Slack, Notion and Calendar.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#737373' }}>
          <span>useautomate.app</span>
          <span>50 free runs · no card required</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
