import 'server-only';
import { redirect } from 'next/navigation';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { getCurrentUser, getSession } from './session';
import type { UserDoc } from '@/lib/db/models';

/**
 * Server-action / API guard. Throws `UnauthorizedError` if no session,
 * `UnauthorizedError` if session exists but the User doc is missing.
 * Both are 401s — the safe-route/safe-action wrappers map them to clean
 * responses without leaking which condition failed.
 */
export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Same as requireUser, plus `isAdmin`. Throws `ForbiddenError` (403) when
 * the user is signed in but not an admin — so the client knows the
 * difference between "log in" and "no permission."
 */
export async function requireAdmin(): Promise<UserDoc> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError('Admins only.');
  return user;
}

/**
 * Server-component guard. Throws a Next.js redirect to `/sign-in` with the
 * intended path preserved as `callbackUrl`. Use this in (dashboard)/* pages
 * to short-circuit rendering for signed-out visitors instead of returning a
 * 401 JSON shape.
 */
export async function requireUserOrRedirect(callbackUrl?: string): Promise<UserDoc> {
  const session = await getSession();
  if (!session?.user?.email) {
    const target = callbackUrl ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/sign-in';
    redirect(target);
  }
  const user = await getCurrentUser();
  if (!user) {
    // Session JWT is valid but the DB row vanished — force a fresh sign-in.
    redirect('/sign-in');
  }
  return user;
}
