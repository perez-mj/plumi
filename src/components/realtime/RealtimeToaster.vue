<!-- src/components/realtime/RealtimeToaster.vue -->
<template>
  <div class="toaster" aria-live="polite" aria-atomic="true">
    <transition-group name="toast" tag="div">
      <div
        v-for="t in store.toasts"
        :key="t.id"
        class="toast"
        role="status"
        @click="handleClick(t)"
      >
        <div class="toast__body">
          <p class="toast__title">{{ t.notification.title }}</p>
          <p v-if="t.notification.body" class="toast__text">{{ t.notification.body }}</p>
        </div>
        <button
          class="toast__close"
          type="button"
          aria-label="Dismiss notification"
          @click.stop="store.dismissToast(t.id)"
        >
          <ion-icon :icon="closeOutline" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { useNotificationsStore } from '@/stores/notificationsStore';

interface ToastEntry {
  id: string;
  notification: { id: string; title: string; body: string | null; link: string | null; is_read: boolean };
}

const store = useNotificationsStore();
const router = useRouter();

async function handleClick(t: ToastEntry) {
  store.dismissToast(t.id);
  if (!t.notification.is_read) {
    try { await store.markRead(t.notification.id); } catch { /* ignore */ }
  }
  if (t.notification.link) {
    try { await router.push(t.notification.link); } catch { /* ignore */ }
  }
}

// Auto-dismiss toasts after 6s
watch(
  () => store.toasts.map((t) => t.id),
  (ids) => {
    const ts = Date.now();
    ids.forEach((id) => {
      const delay = 6000;
      window.setTimeout(() => {
        // Only remove if it's still around after `delay`
        const exists = store.toasts.find((x) => x.id === id);
        if (exists) store.dismissToast(id);
      }, Math.max(0, delay - (Date.now() - ts)));
    });
  },
  { deep: true },
);
</script>

<style scoped>
.toaster {
  position: fixed;
  top: calc(var(--plumi-topbar-height, 72px) + var(--size-3));
  inset-inline-end: var(--size-4);
  z-index: var(--plumi-layer-toast, 200);
  display: flex;
  flex-direction: column;
  gap: var(--size-2);
  width: min(360px, calc(100vw - 24px));
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: var(--size-2);
  padding: var(--size-3);
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface-raised);
  box-shadow: var(--plumi-shadow-raised);
  cursor: pointer;
}
.toast__body { flex: 1; min-width: 0; }
.toast__title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.toast__text { margin: 2px 0 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.toast__close { flex: 0 0 auto; padding: 4px; border: 0; background: transparent; color: var(--plumi-text-muted); cursor: pointer; }
.toast__close:hover { color: var(--plumi-ink); }
.toast-enter-active,
.toast-leave-active { transition: opacity var(--plumi-duration-normal), transform var(--plumi-duration-normal); }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateX(8px); }
@media (max-width: 480px) {
  .toaster { top: auto; bottom: calc(var(--size-4) + env(safe-area-inset-bottom)); inset-inline: var(--size-3); width: auto; }
  .toast-enter-from,
  .toast-leave-to { transform: translateY(8px); }
}
</style>