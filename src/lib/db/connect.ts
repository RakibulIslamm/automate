import mongoose, { type Mongoose } from 'mongoose';
import { env } from '@/lib/env';
import { ExternalServiceError } from '@/lib/errors';

/**
 * Serverless-safe Mongoose connection. We cache the *promise* on `globalThis`
 * so hot reloads (and concurrent first-request connects in the same lambda
 * container) share a single connection. Every server action / route handler
 * should `await connectDb()` before reading or writing.
 */

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __automateMongoose: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__automateMongoose ?? { conn: null, promise: null };
if (!globalThis.__automateMongoose) globalThis.__automateMongoose = cache;

let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  const conn = mongoose.connection;
  conn.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[mongo] connection lost — Mongoose will auto-reconnect');
  });
  conn.on('reconnected', () => {
    // eslint-disable-next-line no-console
    console.info('[mongo] reconnected');
  });
  conn.on('error', (err: Error) => {
    // eslint-disable-next-line no-console
    console.error('[mongo] connection error', err.message);
  });
}

export async function connectDb(): Promise<Mongoose> {
  if (cache.conn && cache.conn.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    const uri = env.MONGODB_URI;
    if (!uri) {
      throw new ExternalServiceError('MongoDB', 'MONGODB_URI is not set. Add it to .env.local.');
    }

    attachListeners();

    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => {
        cache.conn = m;
        return m;
      })
      .catch((err: unknown) => {
        cache.promise = null;
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new ExternalServiceError('MongoDB', `Failed to connect: ${message}`, err);
      });
  }

  try {
    return await cache.promise;
  } catch (err) {
    if (err instanceof ExternalServiceError) throw err;
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new ExternalServiceError('MongoDB', message, err);
  }
}
