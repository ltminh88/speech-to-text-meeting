import type { LayoutServerLoad } from './$types';

// Expose the auth session to every page (client hydration + guards).
export const load: LayoutServerLoad = async ({ locals: { session } }) => {
  return { session };
};
