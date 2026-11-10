<!-- src/views/public/LandingPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="landing">
        <header class="landing__hero">
          <img src="/assets/plumi-brand.jpg" alt="Plumi" class="landing__logo" />
          <span class="landing__eyebrow">WELCOME TO PLUMI</span>
          <h1 class="landing__title">Your next chapter<br />starts here.</h1>
          <p class="landing__tagline">
            Your courses, your community, your progress. One thoughtful workspace.
          </p>
          <div class="landing__cta">
            <ion-button class="landing__cta-primary" @click="goLogin">
              Sign in
            </ion-button>
            <ion-button class="landing__cta-ghost" fill="outline" @click="goRegister">
              Create account
            </ion-button>
          </div>
        </header>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton } from '@ionic/vue';

const router = useRouter();

function goLogin() {
  router.push({ name: 'login' });
}

function goRegister() {
  router.push({ name: 'register' });
}
</script>

<style scoped>
.landing { min-height:100%; display:grid; place-items:center; padding:clamp(24px,6vw,80px); background:var(--plumi-bg); }
.landing__hero { display:flex; flex-direction:column; align-items:center; gap:24px; width:100%; max-width:1000px; padding:clamp(32px,6vw,80px) 24px; border:1px solid var(--plumi-border); border-radius:32px; background:var(--plumi-surface); box-shadow:var(--plumi-shadow-card); text-align:center; }
.landing__logo { width:82px; height:82px; border-radius:24px; object-fit:cover; }
.landing__eyebrow { font-size:11px; font-weight:700; letter-spacing:.2em; color:var(--plumi-primary); }
.landing__title { margin:0; font-size:clamp(34px,6vw,72px); line-height:1.08; letter-spacing:-.055em; font-weight:750; color:var(--plumi-ink); }
.landing__tagline { margin:0; max-width:40ch; color:var(--plumi-text-muted); font-size:16px; line-height:1.8; }
.landing__cta { margin-top:8px; display:flex; flex-wrap:wrap; gap:12px; justify-content:center; }
.landing__cta ion-button { min-height:50px; }
.landing__cta-primary { --background:var(--plumi-primary); --color:#fff; }
.landing__cta-ghost { --color:var(--plumi-ink); }
@media(max-width:480px) {
  .landing__cta { flex-direction:column; width:100%; }
  .landing__cta ion-button { width:100%; }
}
</style>