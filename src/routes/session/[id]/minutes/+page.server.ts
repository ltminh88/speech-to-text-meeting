import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const [sessionRes, minutesRes] = await Promise.all([
    fetch(`/api/sessions/${params.id}`),
    fetch(`/api/sessions/${params.id}/minutes`)
  ]);
  if (!sessionRes.ok) throw error(sessionRes.status, 'session not found');
  const { session } = await sessionRes.json();
  const minutesData = minutesRes.ok ? await minutesRes.json() : { minutes: null, generatedAt: null };
  return { session, ...minutesData };
};
