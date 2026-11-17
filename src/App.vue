<template>
  <ion-app>
    <ion-router-outlet />
    <RealtimeToaster />
  </ion-app>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import RealtimeToaster from '@/components/realtime/RealtimeToaster.vue';
import { useNotifications } from '@/composables/useNotifications';
import { usePushNotifications } from '@/composables/usePushNotifications';
import { useAuthStore } from '@/stores/authStore';

// Global notifications subscription — attaches/detaches with auth.user.
useNotifications();

// Register push once a user is present (cold start + sign-in).
const auth = useAuthStore();
const { register: registerPush } = usePushNotifications();
watch(
  () => auth.user?.id,
  (id) => { if (id) registerPush(); },
  { immediate: true },
);
</script>