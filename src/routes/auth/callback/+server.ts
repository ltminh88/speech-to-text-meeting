import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// OAuth redirect target: exchange the code for a cookie session, then continue.
export const GET: RequestHandler = async ({ locals: { supabase }, url }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) throw redirect(303, next);
  }
  throw redirect(303, '/login?error=auth_callback_failed');
};
