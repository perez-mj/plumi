// src/composables/useAuthDeepLink.ts
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

/**
 * Registers a native listener so email confirmation / recovery links that
 * use `io.plumi.lms://auth/callback?...` reach Supabase's URL parser.
 *
 * On web this is a no-op — detectSessionInUrl handles it automatically.
 *
 * Call once at app boot (after Supabase client exists).
 */
export function installAuthDeepLink(): void {
  if (!Capacitor.isNativePlatform()) return;

  CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith('io.plumi.lms://')) return;

    // Supabase expects either a full URL with hash tokens or a code/token query.
    // Hand the URL to the SDK so it can exchange the token and emit
    // SIGNED_IN / PASSWORD_RECOVERY on the auth state listener.
    try {
      const parsed = new URL(url);

      // PKCE flow: `?code=...`
      const code = parsed.searchParams.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      // Implicit flow: `#access_token=...&refresh_token=...&type=...`
      if (parsed.hash) {
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (e) {
      console.error('[auth] deep-link handling failed', e);
    }
  });
}