import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user }, fetch }) => {
  const res = await fetch('/api/sessions');
  const { sessions } = res.ok ? await res.json() : { sessions: [] };
  return { email: user?.email ?? null, sessions };
};
