import type { DefaultSession } from 'next-auth';
import type { Plan } from '@/lib/db/models';

/**
 * Module augmentation: teach TS that our `session.user` carries `id`, `plan`,
 * `isAdmin` on top of the default `{name, email, image}` fields, and that our
 * JWT mirror those.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      plan: Plan;
      isAdmin: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    plan?: Plan;
    isAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    plan?: Plan;
    isAdmin?: boolean;
  }
}
