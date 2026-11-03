// src/composables/useNotifications.ts
import { watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useRealtimeChannel } from '@/composables/useRealtimeChannel';
import type { NotificationRow } from '@/stores/notificationsStore';

/**
 * Global notifications subscription. Mount ONCE in App.vue.
 * Watches auth.user so it re-attaches when the user changes.
 */
export function useNotifications() {
  const auth = useAuthStore();
  const store = useNotificationsStore();
  const { create, dispose, status } = useRealtimeChannel('notifications-global');

  let channel: ReturnType<typeof create>['channel'] | null = null;

  function attach(userId: string) {
    dispose();
    store.reset();

    void store.load();

    const handle = create();
    channel = handle.channel;

    handle.channel
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            store.push(payload.new as NotificationRow);
          } else if (payload.eventType === 'UPDATE') {
            store.patch(payload.new as NotificationRow);
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (old?.id) store.remove(old.id);
          }
        },
      );

    // On reconnect, re-fetch to fill any missed window.
    handle.onReconnect(() => { void store.load(); });
  }

  watch(
    () => auth.user?.id,
    (id) => {
      if (id) attach(id);
      else { dispose(); store.reset(); channel = null; }
    },
    { immediate: true },
  );

  return { status, store };
}