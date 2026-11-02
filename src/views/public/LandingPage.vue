<!-- src/views/public/LandingPage.vue -->
<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="landing">
        <header class="landing__hero">
          <img src="/assets/plumi-bg-transparent-object-512.png" alt="Plumi" class="landing__logo" />
          <h1 class="landing__title">Plumi</h1>
          <p class="landing__tagline">An AI-integrated learning management platform</p>
          <div class="landing__cta">
            <ion-button @click="$router.push({ name: 'login' })">Sign in</ion-button>
          </div>
        </header>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonButton } from '@ionic/vue';
</script>

<style scoped>
.landing { min-height: 100%; display: grid; place-items: center; background: var(--plumi-bg); padding: var(--size-4, 1rem); }
.landing__hero { display: flex; flex-direction: column; align-items: center; gap: var(--size-3, 0.75rem); text-align: center; }
.landing__logo { width: 96px; height: 96px; object-fit: contain; }
.landing__title { margin: 0; font-size: var(--plumi-text-3xl); letter-spacing: -0.04em; }
.landing__tagline { margin: 0; color: var(--plumi-text-muted); }
.landing__cta { margin-top: var(--size-3, 0.75rem); }
</style>