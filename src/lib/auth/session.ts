import 'server-only';
import type { Session } from 'next-auth';
import { auth } from '../../../auth';
import { connectDb } from '@/lib/db/connect';
import { User, type UserDoc } from '@/lib/db/models';

/**
 * Read the current Auth.js session in server code. Returns null when not
 * signed in. Cheap — just decodes the JWT cookie.
 */
export async function getSession(): Promise<Session | null> {
  return auth();
}

/**
 * Fetch the full User doc for the current session. Returns null if there's
 * no session OR if the corresponding User row is missing (which would mean
 * the user was deleted from the DB but still holds a valid JWT).
 *
 * Use this when you need fields beyond what's in the session JWT (e.g.
 * `stripeCustomerId`, `usage`) — for `id`, `plan`, `isAdmin` the session
 * already carries them.
 */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const session = await getSession();
  if (!session?.user?.email) return null;

  await connectDb();
  const doc = await User.findOne({ email: session.user.email.toLowerCase() });
  return doc ? (doc.toObject() as UserDoc) : null;
}
