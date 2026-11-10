// src/lib/authRedirect.ts
import { Capacitor } from '@capacitor/core';

/**
 * Redirect target for Supabase Auth emails (confirmation, recovery, magic link).
 *
 * - On web:      current origin + "/auth/callback"
 * - On native:   custom app URL scheme registered in capacitor.config.ts
 *
 * The native scheme must ALSO be added to Supabase → Auth → URL Configuration
 * → "Redirect URLs" as a wildcard (e.g. `io.plumi.lms://auth/callback`).
 */
export function authRedirectTo(): string {
  if (Capacitor.isNativePlatform()) {
    // Must match the `ios.scheme` / `android.data.scheme` in capacitor.config.ts
    return 'io.plumi.lms://auth/callback';
  }
  return `${window.location.origin}/auth/callback`;
}

/**
 * Redirect target used when the user finishes a password reset.
 * After updateUser({ password }) Supabase keeps the session; we land on login
 * with a flag so the page can show a success message.
 */
export function passwordResetSuccessRedirect(): string {
  if (Capacitor.isNativePlatform()) {
    return 'io.plumi.lms://login?reset=success';
  }
  return `${window.location.origin}/login?reset=success`;
}