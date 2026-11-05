<template>
  <div class="notif">
    <button
      class="icon-button notif__btn"
      type="button"
      :aria-label="`Notifications (${store.unreadCount} unread)`"
      :title="`${store.unreadCount} unread`"
      :aria-expanded="open"
      aria-controls="plumi-notifications"
      @click.stop="toggle"
    >
      <ion-icon :icon="notificationsOutline" />

      <span v-if="store.unreadCount > 0" class="notif__badge">
        {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
      </span>
    </button>

    <button
      v-if="open"
      class="notif__backdrop"
      type="button"
      aria-label="Close notifications"
      @click.stop="close"
    />

    <transition name="notif-pop">
      <div
        v-if="open"
        id="plumi-notifications"
        class="notif__panel"
        role="dialog"
        aria-label="Notifications"
        @click.stop
        @keydown.esc.stop="close"
      >
        <header class="notif__head">
          <span class="notif__title">Notifications</span>

          <button
            v-if="store.unreadCount > 0"
            class="notif__link"
            type="button"
            :disabled="markingAll"
            @click.stop="markAllRead"
          >
            {{ markingAll ? 'Marking…' : 'Mark all read' }}
          </button>
        </header>

        <p v-if="errorMessage" class="notif__error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="notif__body">
          <p v-if="store.loading" class="notif__empty">
            Loading…
          </p>

          <p v-else-if="!store.recent.length" class="notif__empty">
            No notifications yet.
          </p>

          <ul v-else class="notif__list">
            <li
              v-for="notification in store.recent"
              :key="notification.id"
              class="notif__item"
              :class="{
                'notif__item--unread': !notification.is_read,
              }"
            >
              <button
                class="notif__item-body"
                type="button"
                @click="openNotification(notification)"
              >
                <span class="notif__item-title">
                  {{ notification.title }}
                </span>

                <span
                  v-if="notification.body"
                  class="notif__item-text"
                >
                  {{ notification.body }}
                </span>

                <span class="notif__item-time">
                  {{ formatTime(notification.created_at) }}
                </span>
              </button>

              <button
                v-if="!notification.is_read"
                class="notif__read-button"
                type="button"
                title="Mark as read"
                aria-label="Mark as read"
                :disabled="markingAll"
                @click.stop="markRead(notification.id)"
              >
                <span class="notif__dot" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { notificationsOutline } from 'ionicons/icons';
import {
  useNotificationsStore,
  type NotificationRow,
} from '@/stores/notificationsStore';

const store = useNotificationsStore();
const router = useRouter();

const open = ref(false);
const markingAll = ref(false);
const errorMessage = ref<string | null>(null);

function toggle() {
  open.value = !open.value;
  errorMessage.value = null;
}

function close() {
  open.value = false;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Unable to update notifications. Please try again.';
}

async function markRead(id: string): Promise<boolean> {
  errorMessage.value = null;

  try {
    await store.markRead(id);
    return true;
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
    return false;
  }
}

async function markAllRead() {
  if (markingAll.value) return;

  markingAll.value = true;
  errorMessage.value = null;

  try {
    await store.markAllRead();
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    markingAll.value = false;
  }
}

async function openNotification(notification: NotificationRow) {
  if (!notification.is_read) {
    const marked = await markRead(notification.id);
    if (!marked) return;
  }

  if (notification.link) {
    try {
      await router.push(notification.link);
      close();
    } catch (error: unknown) {
      errorMessage.value = getErrorMessage(error);
    }
  } else {
    close();
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) return '';

  const difference = Math.max(0, Date.now() - timestamp);

  if (difference < 60_000) return 'Just now';

  if (difference < 3_600_000) {
    return `${Math.floor(difference / 60_000)}m ago`;
  }

  if (difference < 86_400_000) {
    return `${Math.floor(difference / 3_600_000)}h ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function onWindowClick() {
  if (open.value) close();
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick);
  window.addEventListener('keydown', onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick);
  window.removeEventListener('keydown', onWindowKeydown);
});
</script>

<style scoped>
.notif {
  position: relative;
}

.notif__btn {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--plumi-border);
  border-radius: 12px;
  background: var(--plumi-surface);
  color: var(--plumi-ink);
  cursor: pointer;
}

.notif__btn ion-icon {
  font-size: 20px;
}

.notif__btn:hover {
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
}

.notif__badge {
  position: absolute;
  top: -4px;
  inset-inline-end: -4px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid var(--plumi-surface);
  border-radius: 999px;
  background: var(--plumi-danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.notif__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--plumi-layer-backdrop, 90);
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: default;
}

.notif__panel {
  position: absolute;
  top: calc(100% + 12px);
  inset-inline-end: 0;
  z-index: calc(var(--plumi-layer-backdrop, 90) + 1);
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100vw - 24px));
  max-height: min(70vh, 560px);
  overflow: hidden;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-lg, 20px);
  background: var(--plumi-surface);
  box-shadow: var(--plumi-shadow-popover);
}

.notif__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--plumi-border);
}

.notif__title {
  color: var(--plumi-ink);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-semibold, 600);
}

.notif__link {
  min-height: 36px;
  padding: 6px 0 6px 8px;
  border: 0;
  background: transparent;
  color: var(--plumi-primary);
  font-size: var(--plumi-text-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.notif__link:hover {
  text-decoration: underline;
}

.notif__link:disabled {
  opacity: 0.5;
  cursor: wait;
}

.notif__error {
  flex-shrink: 0;
  margin: 0;
  padding: 12px 18px;
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-danger-soft);
  color: var(--plumi-danger);
  font-size: var(--plumi-text-xs);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.notif__body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.notif__empty {
  margin: 0;
  padding: 32px 20px;
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
  text-align: center;
}

.notif__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notif__item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  border-bottom: 1px solid var(--plumi-border);
  transition: background var(--plumi-duration-fast, 120ms);
}

.notif__item:hover {
  background: var(--plumi-surface-muted);
}

.notif__item--unread {
  background: var(--plumi-primary-subtle);
}

.notif__item:last-child {
  border-bottom: 0;
}

.notif__item-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  min-width: 0;
  min-height: 76px;
  padding: 16px 0 16px 18px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.notif__item-body:last-child {
  padding-inline-end: 18px;
}

.notif__item-title {
  color: var(--plumi-ink);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-semibold, 600);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.notif__item-text {
  display: -webkit-box;
  overflow: hidden;
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-xs);
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notif__item-time {
  color: var(--plumi-text-subtle);
  font-size: 11px;
  line-height: 1.4;
}

.notif__read-button {
  display: grid;
  flex: 0 0 44px;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 4px 4px 0 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}

.notif__read-button:hover {
  background: var(--plumi-primary-soft);
}

.notif__read-button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.notif__dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--plumi-primary);
}

.notif-pop-enter-active,
.notif-pop-leave-active {
  transition:
    opacity var(--plumi-duration-fast, 120ms),
    transform var(--plumi-duration-fast, 120ms);
}

.notif-pop-enter-from,
.notif-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 600px) {
  .notif__panel {
    position: fixed;
    top: calc(76px + env(safe-area-inset-top, 0px));
    inset-inline: 12px;
    width: auto;
    max-height: calc(100dvh - 100px - env(safe-area-inset-top, 0px));
  }

  .notif__head {
    padding: 12px 16px;
  }

  .notif__link {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notif-pop-enter-active,
  .notif-pop-leave-active,
  .notif__item {
    transition: none;
  }
}
</style>