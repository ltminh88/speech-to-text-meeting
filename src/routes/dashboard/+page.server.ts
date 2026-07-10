import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user } }) => {
  // Route already guarded in hooks.server.ts; user is guaranteed non-null here.
  return { email: user?.email ?? null };
};
