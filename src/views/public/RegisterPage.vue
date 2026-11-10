<!-- src/views/public/RegisterPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="auth">
        <div class="auth__brand">
          <img src="/assets/plumi-brand.jpg" alt="Plumi" class="auth__logo" />
          <h1 class="auth__name">Plumi</h1>
          <p class="auth__tagline">Your AI-assisted learning platform</p>
          <div class="auth__intro">
            <span class="auth__eyebrow">CREATE YOUR ACCOUNT</span>
            <h2>One account.<br />Every course.</h2>
            <p>We'll send a confirmation link<br />to verify your email.</p>
          </div>
        </div>

        <form class="auth__form" @submit.prevent="submit">
          <div>
            <p class="auth__welcome">Get started</p>
            <h2 class="auth__title">Create your Plumi account</h2>
            <p class="auth__description">Use your school email address.</p>
          </div>

          <label>First name
            <input v-model="firstName" type="text" required autocomplete="given-name" />
          </label>
          <label>Last name
            <input v-model="lastName" type="text" required autocomplete="family-name" />
          </label>
          <label>Email
            <input v-model="email" type="email" required autocomplete="email" />
          </label>
          <label>Password
            <input v-model="password" type="password" required autocomplete="new-password" minlength="8" />
          </label>
          <label>Confirm password
            <input v-model="confirm" type="password" required autocomplete="new-password" minlength="8" />
          </label>

          <ion-button type="submit" expand="block" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Create account' }}
          </ion-button>

          <p v-if="error" class="auth__error">{{ error }}</p>
          <p v-if="sent" class="auth__success">
            Check your inbox — we sent a confirmation link to <strong>{{ email }}</strong>.
            After confirming, you can sign in.
          </p>

          <p class="auth__footer">
            Already have an account?
            <router-link :to="{ name: 'login' }">Sign in</router-link>
          </p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const sent = ref(false);

async function submit() {
  error.value = null;
  sent.value = false;

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
    await auth.register({
      email: email.value.trim().toLowerCase(),
      password: password.value,
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
    });
    sent.value = true;
    password.value = '';
    confirm.value = '';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Registration failed.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth { min-height:100%; display:grid; grid-template-columns:1fr 1fr; padding:40px; gap:clamp(32px,7vw,120px); align-items:center; background:var(--plumi-bg); }
.auth__brand { align-self:stretch; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; padding:clamp(28px,5vw,72px); border-radius:30px; background:var(--plumi-brand); color:#fff; }
.auth__logo { width:68px; height:68px; border-radius:18px; object-fit:cover; }
.auth__name { margin:14px 0 6px; font-size:30px; font-weight:750; letter-spacing:-.045em; }
.auth__tagline { margin:0; color:#e2c7e5; font-size:13px; line-height:1.6; }
.auth__intro { margin-top:72px; }
.auth__eyebrow { color:#dfb9e3; font-size:10px; font-weight:650; letter-spacing:.16em; }
.auth__intro h2 { margin:18px 0; color:white; font-size:clamp(28px,3.4vw,48px); line-height:1.2; font-weight:650; letter-spacing:-.045em; }
.auth__intro p { color:#e2c7e5; font-size:14px; line-height:1.9; }
.auth__form { width:100%; max-width:420px; display:flex; flex-direction:column; gap:20px; margin:40px 0; }
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
 .auth__form { margin:32px auto; max-width:440px; gap:18px; }
 .auth__title { font-size:24px; }
}
</style>