import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/sessions/${params.id}`);
  if (!res.ok) throw error(res.status, 'session not found');
  return await res.json();
};
