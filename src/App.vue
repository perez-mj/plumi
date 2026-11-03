<!-- src/App.vue -->
<template>
  <ion-app>
    <ion-router-outlet />
    <RealtimeToaster />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import RealtimeToaster from '@/components/realtime/RealtimeToaster.vue';
import { useNotifications } from '@/composables/useNotifications';

// Global notifications subscription — attaches/detaches with auth.user.
useNotifications();
</script>