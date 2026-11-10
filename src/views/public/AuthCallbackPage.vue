<!-- src/views/public/AuthCallbackPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="callback">
        <div class="callback__card">
          <div v-if="state === 'loading'" class="callback__body">
            <div class="callback__spinner" aria-hidden="true"></div>
            <h1>Finishing up…</h1>
            <p>{{ message }}</p>
          </div>

          <div v-else-if="state === 'success'" class="callback__body">
            <div class="callback__icon callback__icon--ok">✓</div>
            <h1>You're all set</h1>
            <p>{{ message }}</p>
            <ion-button expand="block" @click="goLogin">Continue to sign in</ion-button>
          </div>

          <div v-else class="callback__body">
            <div class="callback__icon callback__icon--err">!</div>
            <h1>Something went wrong</h1>
            <p>{{ message }}</p>
            <ion-button expand="block" @click="goLogin">Back to sign in</ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type State = 'loading' | 'success' | 'error';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const state = ref<State>('loading');
const message = ref('Verifying your link…');

onMounted(async () => {
  // Supabase appends `error`, `error_code`, `error_description` to the URL
  // when a link is invalid/expired. Check first.
  const qError = (route.query.error_description ?? route.query.error) as string | undefined;
  if (qError) {
    state.value = 'error';
    message.value = decodeURIComponent(qError);
    return;
  }

  // Supabase also reports errors in the URL hash (e.g. #error=access_denied).
  if (window.location.hash.includes('error=')) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hError =
      hashParams.get('error_description') ?? hashParams.get('error') ?? 'Link could not be verified.';
    state.value = 'error';
    message.value = hError;
    return;
  }

  // Give detectSessionInUrl a tick to finish exchanging the token. Poll
  // briefly in case the SDK is still working when the route mounts.
  let session = await waitForSession(6000);

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = hashParams.get('type'); // 'signup' | 'recovery' | 'invite' | 'email_change' | 'magiclink'
  const queryType = route.query.type as string | undefined;
  const flow = type ?? queryType ?? 'signup';

  if (flow === 'recovery') {
    // send the user to ResetPasswordPage — the session is already active
    router.replace({ name: 'reset-password' });
    return;
  }

  if (!session) {
    state.value = 'error';
    message.value =
      'We could not verify this link. It may have expired, or this browser may not have cookies enabled.';
    return;
  }

  // Email confirmation: load the profile so the store is populated before
  // the guard runs on the next navigation.
  try {
    await auth.init();
    await auth.refresh();
  } catch {
    /* non-fatal */
  }

  state.value = 'success';
  message.value =
    flow === 'email_change'
      ? 'Your new email is confirmed. Please sign in again.'
      : 'Your email is confirmed. You can now sign in to Plumi.';

  // If already authenticated (e.g. profile was loaded), skip ahead.
  const home = homeForRole(auth.role);
  setTimeout(() => {
    if (auth.isAuthenticated && flow !== 'email_change') {
      router.replace({ name: home });
    }
  }, 1500);
});

async function waitForSession(timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

function homeForRole(role: string | null): string {
  if (role === 'admin') return 'admin-dashboard';
  if (role === 'instructor') return 'instructor-dashboard';
  return 'student-dashboard';
}

function goLogin() {
  router.replace({ name: 'login', query: state.value === 'success' ? { confirmed: '1' } : {} });
}
</script>

<style scoped>
.callback { min-height:100%; display:grid; place-items:center; padding:24px; background:var(--plumi-bg); }
.callback__card { width:100%; max-width:440px; padding:40px 32px; background:var(--plumi-surface); border:1px solid var(--plumi-border); border-radius:24px; box-shadow:var(--plumi-shadow-card); text-align:center; }
.callback__body { display:flex; flex-direction:column; align-items:center; gap:16px; }
.callback__body h1 { margin:0; font-size:24px; font-weight:750; letter-spacing:-.04em; color:var(--plumi-ink); }
.callback__body p { margin:0; color:var(--plumi-text-muted); font-size:14px; line-height:1.7; }
.callback__icon { width:56px; height:56px; border-radius:50%; display:grid; place-items:center; font-size:26px; font-weight:700; color:#fff; }
.callback__icon--ok { background:var(--plumi-success, #2e7d32); }
.callback__icon--err { background:var(--plumi-danger); }
.callback__spinner { width:36px; height:36px; border:3px solid var(--plumi-border-strong); border-top-color:var(--plumi-primary); border-radius:50%; animation:spin .9s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>