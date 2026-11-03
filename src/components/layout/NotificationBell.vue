<!-- src/components/layout/NotificationBell.vue -->
<template>
  <div class="notif">
    <button
      class="icon-button notif__btn"
      type="button"
      :aria-label="`Notifications (${store.unreadCount} unread)`"
      :title="`${store.unreadCount} unread`"
      @click.stop="toggle"
    >
      <ion-icon :icon="notificationsOutline" />
      <span v-if="store.unreadCount > 0" class="notif__badge">
        {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
      </span>
    </button>

    <transition name="notif-pop">
      <div v-if="open" class="notif__panel" role="dialog" aria-label="Notifications" @click.stop>
        <header class="notif__head">
          <span class="notif__title">Notifications</span>
          <button
            v-if="store.unreadCount > 0"
            class="notif__link"
            type="button"
            :disabled="markingAll"
            @click="markAllRead"
          >
            {{ markingAll ? 'Marking…' : 'Mark all read' }}
          </button>
        </header>

        <div class="notif__body">
          <p v-if="store.loading" class="notif__empty">Loading…</p>
          <p v-else-if="!store.recent.length" class="notif__empty">No notifications yet.</p>
          <ul v-else class="notif__list">
            <li
              v-for="n in store.recent"
              :key="n.id"
              class="notif__item"
              :class="{ 'notif__item--unread': !n.is_read }"
              @click="openNotification(n)"
            >
              <div class="notif__item-body">
                <p class="notif__item-title">{{ n.title }}</p>
                <p v-if="n.body" class="notif__item-text">{{ n.body }}</p>
                <p class="notif__item-time">{{ formatTime(n.created_at) }}</p>
              </div>
              <button
                v-if="!n.is_read"
                class="notif__dot"
                type="button"
                title="Mark as read"
                aria-label="Mark as read"
                @click.stop="markRead(n.id)"
              />
            </li>
          </ul>
        </div>
      </div>
    </transition>

    <button
      v-if="open"
      class="notif__backdrop"
      type="button"
      aria-label="Close notifications"
      @click="close"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { notificationsOutline } from 'ionicons/icons';
import { useNotificationsStore } from '@/stores/notificationsStore';
import type { NotificationRow } from '@/stores/notificationsStore';

const store = useNotificationsStore();
const router = useRouter();

const open = ref(false);
const markingAll = ref(false);

function toggle() { open.value = !open.value; }
function close() { open.value = false; }

async function markRead(id: string) {
  try { await store.markRead(id); } catch { /* ignore */ }
}

async function markAllRead() {
  markingAll.value = true;
  try { await store.markAllRead(); } finally { markingAll.value = false; }
}

async function openNotification(n: NotificationRow) {
  await markRead(n.id);
  close();
  if (n.link) {
    try { await router.push(n.link); } catch { /* ignore */ }
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function onWindowClick() { if (open.value) close(); }
onMounted(() => window.addEventListener('click', onWindowClick));
onBeforeUnmount(() => window.removeEventListener('click', onWindowClick));
</script>

<style scoped>
.notif { position: relative; }
.notif__btn { position: relative; }
.notif__badge {
  position: absolute;
  top: 6px;
  inset-inline-end: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--plumi-danger);
  color: white;
  font-size: 10px;
  font-weight: var(--plumi-weight-bold);
  line-height: 18px;
  text-align: center;
}
.notif__panel {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: var(--plumi-layer-popover, 30);
  width: min(380px, calc(100vw - 24px));
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  box-shadow: var(--plumi-shadow-popover);
  overflow: hidden;
}
.notif__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--size-3) var(--size-4);
  border-bottom: 1px solid var(--plumi-border);
}
.notif__title { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.notif__link {
  border: none;
  background: none;
  color: var(--plumi-primary);
  font-size: var(--plumi-text-xs);
  cursor: pointer;
}
.notif__link:disabled { opacity: 0.5; cursor: default; }
.notif__body { overflow-y: auto; }
.notif__empty {
  padding: var(--size-6);
  margin: 0;
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
  text-align: center;
}
.notif__list { list-style: none; padding: 0; margin: 0; }
.notif__item {
  display: flex;
  align-items: flex-start;
  gap: var(--size-2);
  padding: var(--size-3) var(--size-4);
  border-bottom: 1px solid var(--plumi-border);
  cursor: pointer;
  transition: background var(--plumi-duration-fast);
}
.notif__item:hover { background: var(--plumi-surface-muted); }
.notif__item--unread { background: var(--plumi-primary-subtle); }
.notif__item:last-child { border-bottom: 0; }
.notif__item-body { flex: 1; min-width: 0; }
.notif__item-title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.notif__item-text { margin: 2px 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.notif__item-time { margin: 0; color: var(--plumi-text-subtle); font-size: 11px; }
.notif__dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border: 0;
  border-radius: 50%;
  background: var(--plumi-primary);
  cursor: pointer;
}
.notif__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--plumi-layer-backdrop, 25);
  background: transparent;
  border: 0;
  padding: 0;
}
.notif-pop-enter-active,
.notif-pop-leave-active { transition: opacity var(--plumi-duration-fast), transform var(--plumi-duration-fast); }
.notif-pop-enter-from,
.notif-pop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>