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

function isAllowed(row: NotificationRow): boolean {
  return row.type !== 'NEW_MESSAGE';
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationRow[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const toasts = ref<ToastEntry[]>([]);

  const unreadCount = computed(
    () => items.value.filter((row) => isAllowed(row) && !row.is_read).length,
  );

  const recent = computed(
    () => items.value.filter(isAllowed).slice(0, 20),
  );

  async function load(): Promise<void> {
    loading.value = true;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        reset();
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'NEW_MESSAGE')
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS);

      if (error) throw error;

      items.value = ((data ?? []) as NotificationRow[]).filter(isAllowed);
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function push(row: NotificationRow): void {
    if (!isAllowed(row)) return;
    if (items.value.some((item) => item.id === row.id)) return;

    items.value.unshift(row);

    if (items.value.length > MAX_ITEMS) {
      items.value.length = MAX_ITEMS;
    }

    if (!row.is_read) {
      toasts.value.push({
        id: row.id,
        notification: row,
      });
    }
  }

  function patch(row: NotificationRow): void {
    if (!isAllowed(row)) {
      remove(row.id);
      return;
    }

    const index = items.value.findIndex((item) => item.id === row.id);

    if (index >= 0) {
      items.value[index] = {
        ...items.value[index],
        ...row,
      };
    }

    if (row.is_read) {
      toasts.value = toasts.value.filter(
        (toast) => toast.notification.id !== row.id,
      );
    }
  }

  function remove(id: string): void {
    items.value = items.value.filter((item) => item.id !== id);
    toasts.value = toasts.value.filter(
      (toast) => toast.notification.id !== id,
    );
  }

  async function markRead(id: string): Promise<void> {
    const original = items.value.find((item) => item.id === id);

    if (!original || original.is_read || !isAllowed(original)) return;

    const now = new Date().toISOString();

    items.value = items.value.map((item) =>
      item.id === id
        ? { ...item, is_read: true, read_at: now }
        : item,
    );

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now,
      })
      .eq('id', id);

    if (error) {
      items.value = items.value.map((item) =>
        item.id === id ? original : item,
      );

      throw error;
    }

    toasts.value = toasts.value.filter(
      (toast) => toast.notification.id !== id,
    );
  }

  async function markAllRead(): Promise<void> {
    const unread = items.value.filter(
      (item) => isAllowed(item) && !item.is_read,
    );

    if (!unread.length) return;

    const now = new Date().toISOString();
    const ids = new Set(unread.map((item) => item.id));

    items.value = items.value.map((item) =>
      ids.has(item.id)
        ? { ...item, is_read: true, read_at: now }
        : item,
    );

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now,
      })
      .in('id', Array.from(ids));

    if (error) {
      const originals = new Map(
        unread.map((item) => [item.id, item]),
      );

      items.value = items.value.map(
        (item) => originals.get(item.id) ?? item,
      );

      throw error;
    }

    toasts.value = toasts.value.filter(
      (toast) => !ids.has(toast.notification.id),
    );
  }

  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
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