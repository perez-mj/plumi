<!-- src/views/public/ResetPasswordPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="auth">
        <div class="auth__brand">
          <img src="/assets/plumi-brand.jpg" alt="Plumi" class="auth__logo" />
          <h1 class="auth__name">Plumi</h1>
          <p class="auth__tagline">Your AI-assisted learning platform</p>
          <div class="auth__intro">
            <span class="auth__eyebrow">SECURE RESET</span>
            <h2>Choose a new<br />password.</h2>
            <p>Pick something strong<br />and easy to remember.</p>
          </div>
        </div>

        <form class="auth__form" @submit.prevent="submit">
          <div>
            <p class="auth__welcome">Almost done</p>
            <h2 class="auth__title">Set a new password</h2>
            <p class="auth__description">
              <template v-if="checking">Verifying your reset link…</template>
              <template v-else-if="!hasSession">This reset link is invalid or has expired. Request a new one.</template>
              <template v-else>Choose a password with at least 8 characters.</template>
            </p>
          </div>

          <template v-if="hasSession">
            <label>New password
              <input v-model="password" type="password" required autocomplete="new-password" minlength="8" />
            </label>
            <label>Confirm new password
              <input v-model="confirm" type="password" required autocomplete="new-password" minlength="8" />
            </label>

            <ion-button type="submit" expand="block" :disabled="loading">
              {{ loading ? 'Updating…' : 'Update password' }}
            </ion-button>
          </template>

          <template v-else-if="!checking">
            <ion-button expand="block" @click="goForgot">Request a new link</ion-button>
          </template>

          <p v-if="error" class="auth__error">{{ error }}</p>
          <p v-if="done" class="auth__success">Password updated. Redirecting to sign in…</p>

          <p class="auth__footer">
            <router-link :to="{ name: 'login' }">Back to sign in</router-link>
          </p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const auth = useAuthStore();
const router = useRouter();

const password = ref('');
const confirm = ref('');
const loading = ref(false);
const checking = ref(true);
const hasSession = ref(false);
const error = ref<string | null>(null);
const done = ref(false);

onMounted(async () => {
  // When the recovery link lands here, Supabase has already exchanged the
  // token for a temporary session via detectSessionInUrl. Confirm that a
  // session exists so the form only appears when updateUser will work.
  const { data } = await supabase.auth.getSession();
  hasSession.value = !!data.session;
  checking.value = false;
});

async function submit() {
  error.value = null;
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.';
    return;
  }

  loading.value = true;
  try {
    await auth.updatePassword(password.value);
    done.value = true;
    // Sign out so the temp recovery session doesn't linger; user signs in fresh.
    await auth.logout();
    router.replace({ name: 'login', query: { reset: 'success' } });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not update your password.';
  } finally {
    loading.value = false;
  }
}

function goForgot() {
  router.replace({ name: 'forgot-password' });
}
</script>

<style scoped>
/* Same auth shell as LoginPage */
.auth { min-height:100%; display:grid; grid-template-columns:1fr 1fr; padding:40px; gap:clamp(32px,7vw,120px); align-items:center; background:var(--plumi-bg); }
.auth__brand { align-self:stretch; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; padding:clamp(28px,5vw,72px); border-radius:30px; background:var(--plumi-brand); color:#fff; }
.auth__logo { width:68px; height:68px; border-radius:18px; object-fit:cover; }
.auth__name { margin:14px 0 6px; font-size:30px; font-weight:750; letter-spacing:-.045em; }
.auth__tagline { margin:0; color:#e2c7e5; font-size:13px; line-height:1.6; }
.auth__intro { margin-top:72px; }
.auth__eyebrow { color:#dfb9e3; font-size:10px; font-weight:650; letter-spacing:.16em; }
.auth__intro h2 { margin:18px 0; color:white; font-size:clamp(28px,3.4vw,48px); line-height:1.2; font-weight:650; letter-spacing:-.045em; }
.auth__intro p { color:#e2c7e5; font-size:14px; line-height:1.9; }
.auth__form { width:100%; max-width:420px; display:flex; flex-direction:column; gap:22px; margin:40px 0; }
.auth__welcome { margin:0 0 10px; color:var(--plumi-primary); font-size:12px; font-weight:700; }
.auth__title { margin:0; font-size:28px; font-weight:750; letter-spacing:-.045em; color:var(--plumi-ink); }
.auth__description { margin:12px 0 8px; color:var(--plumi-text-muted); font-size:13px; line-height:1.7; }
.auth__form label { display:flex; flex-direction:column; gap:9px; font-size:13px; font-weight:600; color:var(--plumi-ink); }
.auth__form input { width:100%; min-height:52px; padding:14px; border:1px solid var(--plumi-border-strong); border-radius:12px; background:var(--plumi-surface); color:var(--plumi-ink); font-size:16px; }
.auth__form input:focus-visible { outline:0; border-color:var(--plumi-primary); box-shadow:var(--plumi-focus-ring); }
.auth__form ion-button { min-height:50px; margin:4px 0 0; }
.auth__error { margin:0; color:var(--plumi-danger); font-size:13px; line-height:1.6; }
.auth__success { margin:0; color:var(--plumi-success, #2e7d32); font-size:13px; line-height:1.6; }
.auth__footer { margin:8px 0 0; font-size:13px; color:var(--plumi-text-muted); }
.auth__footer a { color:var(--plumi-primary); font-weight:600; text-decoration:none; }
@media(max-width:700px) {
 .auth { display:flex; flex-direction:column; justify-content:flex-start; gap:0; padding:20px; }
 .auth__brand { width:100%; padding:24px; border-radius:22px; }
 .auth__logo { width:48px; height:48px; border-radius:12px; }
 .auth__name { margin-top:10px; font-size:26px; }
 .auth__intro { display:none; }
 .auth__form { margin:32px auto; max-width:440px; gap:20px; }
 .auth__title { font-size:24px; }
}
</style>