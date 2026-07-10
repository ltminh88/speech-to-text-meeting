import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Routes reachable without an authenticated session.
const PUBLIC_PATHS = ['/', '/login', '/auth'];

const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: ((cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      }) satisfies CookieMethodsServer['setAll']
    }
  });

  // Validate the session against the auth server (getUser), not just the cookie.
  event.locals.safeGetSession = async () => {
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };

    return { session, user };
  };

  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  // Auth guard: redirect unauthenticated access on protected routes to /login.
  if (!session && !isPublic(event.url.pathname)) {
    throw redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
  }

  return resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
  });
};
