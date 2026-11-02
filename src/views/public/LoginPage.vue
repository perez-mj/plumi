<!-- src/views/auth/LoginPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="auth">
        <div class="auth__brand">
          <img src="/assets/plumi-bg-transparent-object-512.png" alt="Plumi" class="auth__logo" />
          <h1 class="auth__name">Plumi</h1>
          <p class="auth__tagline">Your AI-assisted learning platform</p>
        </div>

        <form class="auth__form" @submit.prevent="submit">
          <h2 class="auth__title">Sign in</h2>
          <label>Email <input v-model="email" type="email" required autocomplete="email" /></label>
          <label>Password <input v-model="password" type="password" required autocomplete="current-password" /></label>
          <ion-button type="submit" expand="block" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </ion-button>
          <p v-if="error" class="auth__error">{{ error }}</p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    await auth.login(email.value, password.value);
    const explicitRedirect = route.query.redirect as string | undefined;
    if (explicitRedirect && explicitRedirect !== '/app') {
      await router.replace(explicitRedirect);
      return;
    }
    const role = auth.role ?? 'student';
    const homeName =
      role === 'admin' ? 'admin-dashboard'
      : role === 'instructor' ? 'instructor-dashboard'
      : 'student-dashboard';
    await router.replace({ name: homeName });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign in failed.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--size-4, 1rem); background: var(--plumi-bg); }
.auth__brand { display: flex; flex-direction: column; align-items: center; gap: var(--size-2, 0.5rem); margin-bottom: var(--size-5, 1.25rem); }
.auth__logo { width: 72px; height: 72px; object-fit: contain; }
.auth__name { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.auth__tagline { margin: 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.auth__form { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); padding: var(--size-5, 1.25rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.auth__title { margin: 0; font-size: var(--plumi-text-lg); }
.auth__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.auth__form input { padding: var(--size-2, 0.5rem) var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.auth__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; text-align: center; }
</style>