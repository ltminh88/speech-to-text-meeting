import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Start Google OAuth. Supabase returns a provider URL we redirect the browser to.
export const GET: RequestHandler = async ({ locals: { supabase }, url }) => {
  const redirectTo = url.searchParams.get('redirectTo') ?? '/dashboard';
  const callback = `${url.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback, scopes: 'openid email profile' }
  });

  if (error || !data.url) {
    throw redirect(303, `/login?error=${encodeURIComponent(error?.message ?? 'oauth_failed')}`);
  }
  throw redirect(303, data.url);
};
