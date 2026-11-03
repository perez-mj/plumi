// src/composables/useMessages.ts
import { nextTick, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useRealtimeChannel } from '@/composables/useRealtimeChannel';
import { useAuthStore } from '@/stores/authStore';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender_name: string;
}

const SENDER_NAME_TTL_MS = 5 * 60 * 1000;

export function useMessages() {
  const auth = useAuthStore();

  const messages = ref<ChatMessage[]>([]);
  const messagesEl = ref<HTMLDivElement | null>(null);
  const typingUsers = ref<Record<string, { name: string; at: number }>>({});
  const onlineUserIds = ref<string[]>([]);
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);

  const senderNameCache = new Map<string, { name: string; at: number }>();

  let currentConversationId: string | null = null;
  let typingTimer: number | undefined;
  let typingJanitor: number | undefined;
  const realtime = useRealtimeChannel('messages-slot');

  /* -------------------------------------------------------- */

  async function resolveSenderName(userId: string): Promise<string> {
    if (userId === auth.user?.id) return 'You';

    const cached = senderNameCache.get(userId);
    if (cached && Date.now() - cached.at < SENDER_NAME_TTL_MS) return cached.name;

    const { data, error } = await supabase.rpc('get_display_names', {
      p_ids: [userId],
    });
    if (error) {
      console.warn('[messages] get_display_names failed', error);
      return 'Member';
    }
    const row = (data ?? [])[0] as
      | { first_name: string; last_name: string }
      | undefined;
    const name = row
      ? `${row.first_name} ${row.last_name}`.trim() || 'Member'
      : 'Member';
    senderNameCache.set(userId, { name, at: Date.now() });
    return name;
  }

  function mapRow(row: {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    sender?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[];
  }, senderName?: string): ChatMessage {
    const s = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    const fallback = s ? `${s.first_name} ${s.last_name}`.trim() : null;
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      content: row.content,
      created_at: row.created_at,
      edited_at: row.edited_at,
      deleted_at: row.deleted_at,
      sender_name:
        senderName ??
        (row.sender_id === auth.user?.id ? 'You' : fallback ?? 'Member'),
    };
  }

  /* -------------------------------------------------------- */
  /* Public API                                               */
  /* -------------------------------------------------------- */

  async function openConversation(conversationId: string) {
    currentConversationId = conversationId;
    messages.value = [];
    messagesError.value = null;
    typingUsers.value = {};
    onlineUserIds.value = [];
    loadingMessages.value = true;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `id, conversation_id, sender_id, content, created_at, edited_at, deleted_at,
           sender:profiles!messages_sender_id_fkey ( first_name, last_name )`,
        )
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      messages.value = (data ?? []).map((r) => mapRow(r as never));
      await nextTick();
      scrollToBottom(true);
      void markRead();
    } catch (e: unknown) {
      messagesError.value = e instanceof Error ? e.message : 'Failed to load messages.';
    } finally {
      loadingMessages.value = false;
    }

    bindRealtime(conversationId);
  }

  function bindRealtime(conversationId: string) {
    const handle = realtime.create();
    const ch = handle.channel;

    ch
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (currentConversationId !== conversationId) return;
          const row = payload.new as ChatMessage;
          if (messages.value.some((m) => m.id === row.id)) return;
          const name = await resolveSenderName(row.sender_id);
          messages.value.push({ ...row, sender_name: name });
          if (isNearBottom()) {
            await nextTick();
            scrollToBottom();
          }
          if (document.hasFocus() && row.sender_id !== auth.user?.id) {
            void markRead();
          }
        },
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (currentConversationId !== conversationId) return;
          const row = payload.new as ChatMessage;
          const idx = messages.value.findIndex((m) => m.id === row.id);
          if (idx < 0) return;
          if (row.deleted_at) {
            messages.value.splice(idx, 1);
            return;
          }
          messages.value[idx] = {
            ...messages.value[idx],
            content: row.content,
            edited_at: row.edited_at,
          };
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ user_id: string; name: string }>();
        onlineUserIds.value = Object.values(state)
          .flat()
          .map((p) => (p as { user_id: string }).user_id);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as { user_id: string; name: string };
        if (p.user_id === auth.user?.id) return;
        typingUsers.value[p.user_id] = { name: p.name, at: Date.now() };
      });

    void ch.track({
      user_id: auth.user?.id,
      name: auth.displayName || 'Member',
    });

    if (typingJanitor) window.clearInterval(typingJanitor);
    typingJanitor = window.setInterval(() => {
      const cutoff = Date.now() - 4000;
      for (const [id, t] of Object.entries(typingUsers.value)) {
        if (t.at < cutoff) delete typingUsers.value[id];
      }
    }, 1500);

    handle.onReconnect(() => {
      if (currentConversationId === conversationId) {
        void reloadCurrent();
      }
    });
  }

  async function reloadCurrent() {
    const id = currentConversationId;
    if (!id) return;
    const { data, error } = await supabase
      .from('messages')
      .select(
        `id, conversation_id, sender_id, content, created_at, edited_at, deleted_at,
         sender:profiles!messages_sender_id_fkey ( first_name, last_name )`,
      )
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return;
    messages.value = (data ?? []).map((r) => mapRow(r as never));
    await nextTick();
    scrollToBottom(true);
  }

  function close() {
    realtime.dispose();
    currentConversationId = null;
    messages.value = [];
    typingUsers.value = {};
    onlineUserIds.value = [];
    if (typingTimer) { window.clearTimeout(typingTimer); typingTimer = undefined; }
    if (typingJanitor) { window.clearInterval(typingJanitor); typingJanitor = undefined; }
  }

  /* -------------------------------------------------------- */
  /* Send + typing + read                                     */
  /* -------------------------------------------------------- */

  async function send(content: string): Promise<void> {
    if (!currentConversationId || !auth.user?.id) return;
    const text = content.trim();
    if (!text) return;

    // Optimistic — a temporary row that gets replaced by the realtime INSERT
    const tempId = `tmp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: currentConversationId,
      sender_id: auth.user.id,
      content: text,
      created_at: now,
      edited_at: null,
      deleted_at: null,
      sender_name: 'You',
    };
    messages.value.push(optimistic);
    await nextTick();
    scrollToBottom(true);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        sender_id: auth.user.id,
        content: text,
      })
      .select(
        `id, conversation_id, sender_id, content, created_at, edited_at, deleted_at,
         sender:profiles!messages_sender_id_fkey ( first_name, last_name )`,
      )
      .single();

    if (error) {
      const idx = messages.value.findIndex((m) => m.id === tempId);
      if (idx >= 0) messages.value.splice(idx, 1);
      throw error;
    }

    // Replace the temp row with the server row (avoids realtime insert duplication)
    const idx = messages.value.findIndex((m) => m.id === tempId);
    if (idx >= 0) messages.value[idx] = mapRow(data as never, 'You');
  }

  function signalTyping() {
    if (!realtime.channel.value || !auth.user?.id) return;
    if (typingTimer) return;
    void realtime.channel.value.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: auth.user.id, name: auth.displayName || 'Member' },
    });
    typingTimer = window.setTimeout(() => { typingTimer = undefined; }, 2000);
  }

  async function markRead(): Promise<void> {
    if (!currentConversationId || !auth.user?.id) return;
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', currentConversationId)
      .eq('user_id', auth.user.id);
  }

  /* -------------------------------------------------------- */
  /* Scroll helpers                                           */
  /* -------------------------------------------------------- */

  function isNearBottom(): boolean {
    const el = messagesEl.value;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function scrollToBottom(force = false): void {
    const el = messagesEl.value;
    if (!el) return;
    if (force || isNearBottom()) {
      el.scrollTop = el.scrollHeight;
    }
  }

  return {
    messages,
    messagesEl,
    typingUsers,
    onlineUserIds,
    loadingMessages,
    messagesError,
    openConversation,
    close,
    send,
    signalTyping,
    markRead,
    scrollToBottom,
    isNearBottom,
  };
}