// src/stores/notificationsStore.ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabase';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface ToastEntry {
  id: string;
  notification: NotificationRow;
}

const MAX_ITEMS = 100;

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationRow[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const toasts = ref<ToastEntry[]>([]);

  const unreadCount = computed(() => items.value.filter((n) => !n.is_read).length);
  const recent = computed(() => items.value.slice(0, 20));

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { items.value = []; return; }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS);
      if (error) throw error;
      items.value = (data ?? []) as NotificationRow[];
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function push(row: NotificationRow): void {
    if (items.value.some((n) => n.id === row.id)) return;
    items.value.unshift(row);
    if (items.value.length > MAX_ITEMS) items.value.length = MAX_ITEMS;

    // Fire a toast for realtime inserts only (not initial load)
    toasts.value.push({ id: crypto.randomUUID(), notification: row });
  }

  function patch(row: NotificationRow): void {
    const idx = items.value.findIndex((n) => n.id === row.id);
    if (idx >= 0) items.value[idx] = { ...items.value[idx], ...row };
  }

  function remove(id: string): void {
    items.value = items.value.filter((n) => n.id !== id);
  }

  async function markRead(id: string): Promise<void> {
    const idx = items.value.findIndex((n) => n.id === id);
    if (idx < 0 || items.value[idx].is_read) return;

    // Optimistic
    items.value[idx] = {
      ...items.value[idx],
      is_read: true,
      read_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      // Roll back
      items.value[idx] = { ...items.value[idx], is_read: false, read_at: null };
      throw error;
    }
  }

  async function markAllRead(): Promise<void> {
    const unread = items.value.filter((n) => !n.is_read);
    if (!unread.length) return;

    const now = new Date().toISOString();
    const ids = unread.map((n) => n.id);
    items.value = items.value.map((n) =>
      ids.includes(n.id) ? { ...n, is_read: true, read_at: now } : n,
    );
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .in('id', ids);
    if (error) {
      await load();
      throw error;
    }
  }

  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function reset(): void {
    items.value = [];
    toasts.value = [];
    loaded.value = false;
  }

  return {
    items,
    loading,
    loaded,
    toasts,
    unreadCount,
    recent,
    load,
    push,
    patch,
    remove,
    markRead,
    markAllRead,
    dismissToast,
    reset,
  };
});