// src/stores/authStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { authRedirectTo } from '@/lib/authRedirect';

export type Role = 'admin' | 'instructor' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl?: string | null;
  bio?: string | null;
  isActive: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  /* -------------------- state -------------------- */
  const user = ref<AuthUser | null>(null);
  const ready = ref(false);          // initial session restore finished
  const loading = ref(false);        // a login/logout is in flight
  const error = ref<string | null>(null);

  /* -------------------- getters -------------------- */
  const isAuthenticated = computed(() => !!user.value);
  const role = computed<Role | null>(() => user.value?.role ?? null);
  const displayName = computed(() => {
    const u = user.value;
    if (!u) return '';
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return full || u.email;
  });

  /* -------------------- helpers -------------------- */

  // Fetch the profile row + role name for a given auth uid.
  async function fetchProfile(uid: string): Promise<AuthUser | null> {
  const { data, error: err } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      first_name,
      last_name,
      avatar_url,
      bio,
      is_active,
      deleted_at,
      roles ( name )
    `)
    .eq('id', uid)
    .maybeSingle();

  if (err) throw err;
  if (!data || data.deleted_at) return null;

  const roleRel = (data as unknown as { roles?: { name: string } | { name: string }[] | null }).roles;
  const roleName: string =
    (Array.isArray(roleRel) ? roleRel[0]?.name : roleRel?.name) ?? 'STUDENT';

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    role: roleName.toLowerCase() as Role,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    isActive: data.is_active ?? true,
  };
}

  // Load user from a Supabase session. Clears user if no profile found.
  async function hydrateFromSession(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      user.value = null;
      return;
    }
    try {
      user.value = await fetchProfile(session.user.id);
    } catch (e) {
      // Profile fetch failure should not keep the session alive in a
      // half-authenticated state — sign out to avoid a loop.
      console.error('[auth] profile fetch failed', e);
      await supabase.auth.signOut();
      user.value = null;
    }
  }

  /* -------------------- actions -------------------- */

  /**
   * Called once at app boot (or by the router guard).
   * Restores the session and wires the auth state listener.
   * Safe to call multiple times.
   */
  let listenerBound = false;
  async function init(): Promise<void> {
    if (ready.value) return;

    await hydrateFromSession();

    if (!listenerBound) {
      listenerBound = true;
            supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Recovery link exchanged — ResetPasswordPage will read the session.
          // Do NOT set user here; just let the recovery page take over.
          return;
        }
        if (event === 'SIGNED_OUT' || !session?.user) {
          user.value = null;
          return;
        }
        if (event === 'TOKEN_REFRESHED' && user.value) return;

        try {
          user.value = await fetchProfile(session.user.id);
        } catch (e) {
          console.error('[auth] profile fetch on auth change failed', e);
        }
      });
    }

    ready.value = true;
  }

  /**
   * Sign in with email + password.
   * Throws on failure so the login page can show the error.
   */
  async function login(email: string, password: string): Promise<AuthUser> {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) throw err;
      if (!data.user) throw new Error('Sign in failed');

      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('Your account has no profile. Contact an administrator.');
      }
      if (!profile.isActive) {
        await supabase.auth.signOut();
        throw new Error('Your account is disabled. Contact an administrator.');
      }

      user.value = profile;
      return profile;
    } catch (e: unknown) {
      const msg = extractMessage(e);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Sign out. Does not navigate — the layout handles routing.
   */
  async function logout(): Promise<void> {
    loading.value = true;
    try {
      await supabase.auth.signOut();
    } finally {
      user.value = null;
      loading.value = false;
    }
  }

    /**
   * Register a new account. Sends a confirmation email via Supabase Auth
   * (delivered through Resend SMTP in production).
   * The profile row is created by the DB trigger (see `profiles` migration);
   * if your trigger reads `raw_user_meta_data`, the names are passed here.
   */
  async function register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: authRedirectTo(),
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
          },
        },
      });
      if (err) throw err;

      // If confirmations are enabled (recommended in prod), `data.session`
      // will be null and the user must click the email link first.
      // If confirmations are disabled (dev), we sign them in immediately.
      if (data.session && data.user) {
        user.value = await fetchProfile(data.user.id);
      }
    } catch (e: unknown) {
      const msg = extractMessage(e);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Send a password recovery email. Always resolves to avoid leaking which
   * addresses exist (Supabase does this server-side too, but this keeps the
   * UX consistent).
   */
  async function sendPasswordReset(email: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectTo(),
      });
      if (err) throw err;
    } catch (e: unknown) {
      const msg = extractMessage(e);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update the password for the *currently authenticated* user.
   * Only call after a recovery link has established a session.
   */
  async function updatePassword(newPassword: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
    } catch (e: unknown) {
      const msg = extractMessage(e);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Re-send the confirmation email for an account that hasn't confirmed yet.
   */
  async function resendConfirmation(email: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: authRedirectTo() },
      });
      if (err) throw err;
    } catch (e: unknown) {
      const msg = extractMessage(e);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Reload the current user's profile from the DB.
   * Useful after profile edits.
   */
  async function refresh(): Promise<void> {
    await hydrateFromSession();
  }

    return {
    // state
    user,
    ready,
    loading,
    error,
    // getters
    isAuthenticated,
    role,
    displayName,
    // actions
    init,
    login,
    logout,
    refresh,
    register,          
    sendPasswordReset, 
    updatePassword,    
    resendConfirmation,
  };
});

/* -------------------- internals -------------------- */

function extractMessage(e: unknown): string {
  if (!e) return 'Something went wrong. Please try again.';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;

  // Supabase AuthError shapes
  const anyE = e as { message?: string; error_description?: string; status?: number };
  if (anyE.error_description) return anyE.error_description;
  if (anyE.message) return anyE.message;
  if (anyE.status === 400) return 'Invalid email or password.';
  return 'Something went wrong. Please try again.';
}