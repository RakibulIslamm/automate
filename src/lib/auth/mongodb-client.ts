import { MongoClient, type MongoClientOptions } from 'mongodb';
import { env } from '@/lib/env';

/**
 * Native MongoClient promise for the @auth/mongodb-adapter. Auth.js's adapter
 * needs the raw driver — separate from our Mongoose connection — but it
 * points at the SAME database, so the adapter's `users` collection IS our
 * Mongoose User collection. (Phase 4's signIn callback then enriches it
 * with our app-specific defaults like plan='free'.)
 *
 * We cache the connect promise on `globalThis` so Turbopack HMR in dev
 * doesn't fan out into dozens of MongoClient instances.
 */

const options: MongoClientOptions = {};

declare global {
  // eslint-disable-next-line no-var
  var __automateAuthMongo: Promise<MongoClient> | undefined;
}

function buildClient(): Promise<MongoClient> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — Auth.js MongoDB adapter cannot connect.');
  }
  return new MongoClient(env.MONGODB_URI, options).connect();
}

const clientPromise: Promise<MongoClient> =
  globalThis.__automateAuthMongo ?? (globalThis.__automateAuthMongo = buildClient());

export default clientPromise;
