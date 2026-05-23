import { NextResponse, type NextRequest } from 'next/server';

/**
 * Placeholder client-error sink. Phase 3 swaps the body of this handler for a
 * real ErrorLog write. Until then we log to the server console so dev still
 * surfaces client-side failures.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    // eslint-disable-next-line no-console
    console.error('[client-error]', body);
  } catch {
    // Never throw out of the error sink.
  }
  return new NextResponse(null, { status: 204 });
}
