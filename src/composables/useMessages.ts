import { nextTick, onBeforeUnmount, ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

function createMessageId(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error(
      'Your browser cannot generate message IDs. Please use an updated browser.',
    );
  }

  const bytes = new Uint8Array(16);

  cryptoApi.getRandomValues(bytes);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

type MessageRow = Pick<
  Database['public']['Tables']['messages']['Row'],
  | 'id'
  | 'conversation_id'
  | 'sender_id'
  | 'content'
  | 'created_at'
  | 'edited_at'
  | 'deleted_at'
>;

export interface ChatMessage extends MessageRow {
  sender_name: string;
}

type TypingUser = {
  name: string;
  at: number;
};

const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, content, created_at, edited_at, deleted_at';

export function useMessages() {
  const auth = useAuthStore();

  const messages = ref<ChatMessage[]>([]);
  const messagesEl = ref<HTMLDivElement | null>(null);
  const typingUsers = ref<Record<string, TypingUser>>({});
  const onlineUserIds = ref<string[]>([]);
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);

  const connectionStatus = ref<
    'idle' | 'connecting' | 'live' | 'error'
  >('idle');

  const names = new Map<string, string>();
  const liveRows = new Map<string, MessageRow>();

  let currentConversationId: string | null = null;
  let channel: RealtimeChannel | null = null;
  let generation = 0;
  let loadVersion = 0;
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  let typingJanitor: ReturnType<typeof setInterval> | undefined;

  function isCurrent(
    token: number,
    conversationId: string,
  ): boolean {
    return (
      generation === token &&
      currentConversationId === conversationId
    );
  }

  async function loadNames(userIds: string[]): Promise<void> {
    const missing = [
      ...new Set(
        userIds.filter(
          (id) => id !== auth.user?.id && !names.has(id),
        ),
      ),
    ];

    if (!missing.length) return;

    const { data, error } = await supabase.rpc(
      'get_display_names',
      { p_ids: missing },
    );

    if (error) return;

    for (const person of data ?? []) {
      names.set(
        person.id,
        `${person.first_name} ${person.last_name}`.trim() ||
          'Member',
      );
    }
  }

  function mapRow(row: MessageRow): ChatMessage {
    return {
      ...row,
      sender_name:
        row.sender_id === auth.user?.id
          ? 'You'
          : names.get(row.sender_id) ?? 'Member',
    };
  }

  function sortMessages(): void {
    messages.value.sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  }

  function upsertMessage(row: MessageRow): void {
    messages.value = messages.value.filter(
      (message) => message.id !== `tmp-${row.id}`,
    );

    const index = messages.value.findIndex(
      (message) => message.id === row.id,
    );

    if (row.deleted_at) {
      if (index >= 0) {
        messages.value.splice(index, 1);
      }

      return;
    }

    const message = mapRow(row);

    if (index >= 0) {
      messages.value[index] = message;
    } else {
      messages.value.push(message);
    }

    sortMessages();
  }

  async function refreshMessages(
    conversationId: string,
    token: number,
    forceScroll = false,
  ): Promise<void> {
    const request = ++loadVersion;
    const shouldScroll = forceScroll || isNearBottom();

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (!isCurrent(token, conversationId)) return;

      const fetched = new Map<string, MessageRow>(
        (data ?? []).map((row) => [row.id, row]),
      );

      for (const [id, row] of liveRows) {
        fetched.set(id, row);
      }

      await loadNames(
        [...fetched.values()].map((row) => row.sender_id),
      );

      if (
        !isCurrent(token, conversationId) ||
        request !== loadVersion
      ) {
        return;
      }

      for (const [id, row] of liveRows) {
        fetched.set(id, row);
      }

      const pending = messages.value.filter(
        (message) =>
          message.id.startsWith('tmp-') &&
          !fetched.has(message.id.slice(4)),
      );

      messages.value = [
        ...[...fetched.values()]
          .filter((row) => !row.deleted_at)
          .map(mapRow),
        ...pending,
      ];

      sortMessages();
      messagesError.value = null;

      await nextTick();

      if (!isCurrent(token, conversationId)) return;

      if (shouldScroll) {
        scrollToBottom(true);
      }

      if (document.hasFocus() && !document.hidden) {
        void markRead();
      }
    } catch (error: unknown) {
      if (
        isCurrent(token, conversationId) &&
        request === loadVersion
      ) {
        messagesError.value = getErrorMessage(error);
      }
    } finally {
      if (
        isCurrent(token, conversationId) &&
        request === loadVersion
      ) {
        loadingMessages.value = false;
      }
    }
  }

  function bindRealtime(
    conversationId: string,
    token: number,
  ): void {
    const chatChannel = supabase.channel(
      `conversation:${conversationId}`,
    );

    channel = chatChannel;

    async function handleRow(row: MessageRow): Promise<void> {
      if (!isCurrent(token, conversationId)) return;

      const shouldScroll = isNearBottom();

      liveRows.set(row.id, row);

      await loadNames([row.sender_id]);

      if (!isCurrent(token, conversationId)) return;

      const latest = liveRows.get(row.id);

      if (!latest) return;

      upsertMessage(latest);

      await nextTick();

      if (!isCurrent(token, conversationId)) return;

      if (shouldScroll) {
        scrollToBottom(true);
      }

      if (
        row.sender_id !== auth.user?.id &&
        document.hasFocus() &&
        !document.hidden
      ) {
        void markRead();
      }
    }

    chatChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          void handleRow(payload.new as MessageRow);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          void handleRow(payload.new as MessageRow);
        },
      )
      .on('presence', { event: 'sync' }, () => {
        if (!isCurrent(token, conversationId)) return;

        const state = chatChannel.presenceState<{
          user_id: string;
        }>();

        onlineUserIds.value = [
          ...new Set(
            Object.values(state)
              .flat()
              .map((person) => person.user_id)
              .filter(Boolean),
          ),
        ];
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!isCurrent(token, conversationId)) return;

        const person = payload as {
          user_id?: string;
          name?: string;
        };

        if (
          !person.user_id ||
          person.user_id === auth.user?.id
        ) {
          return;
        }

        typingUsers.value[person.user_id] = {
          name: person.name || 'Member',
          at: Date.now(),
        };
      });

    chatChannel.subscribe((status) => {
      if (!isCurrent(token, conversationId)) return;

      if (status === 'SUBSCRIBED') {
        connectionStatus.value = 'live';

        void chatChannel.track({
          user_id: auth.user?.id,
          name: auth.displayName || 'Member',
        });

        void refreshMessages(conversationId, token);
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        connectionStatus.value = 'error';
        onlineUserIds.value = [];
        typingUsers.value = {};
      } else {
        connectionStatus.value = 'connecting';
      }
    });

    typingJanitor = setInterval(() => {
      if (!isCurrent(token, conversationId)) return;

      const cutoff = Date.now() - 4000;

      for (const [id, person] of Object.entries(typingUsers.value)) {
        if (person.at < cutoff) {
          delete typingUsers.value[id];
        }
      }
    }, 1000);
  }

  async function openConversation(
    conversationId: string,
  ): Promise<void> {
    close();

    currentConversationId = conversationId;
    loadingMessages.value = true;
    messagesError.value = null;
    connectionStatus.value = 'connecting';

    const token = generation;

    bindRealtime(conversationId, token);

    await refreshMessages(conversationId, token, true);
  }

  function close(): void {
    generation++;
    loadVersion++;

    const previousChannel = channel;

    channel = null;
    currentConversationId = null;

    if (previousChannel) {
      void supabase.removeChannel(previousChannel);
    }

    clearTimeout(typingTimer);
    clearInterval(typingJanitor);

    typingTimer = undefined;
    typingJanitor = undefined;

    messages.value = [];
    typingUsers.value = {};
    onlineUserIds.value = [];
    loadingMessages.value = false;
    messagesError.value = null;
    connectionStatus.value = 'idle';

    liveRows.clear();
    names.clear();
  }

  async function send(content: string): Promise<void> {
    const conversationId = currentConversationId;
    const senderId = auth.user?.id;
    const token = generation;
    const text = content.trim();

    if (!conversationId || !senderId) {
      throw new Error(
        'Select a conversation before sending.',
      );
    }

    if (!text) return;

    const serverId = createMessageId();
    const tempId = `tmp-${serverId}`;

    messages.value.push({
      id: tempId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: text,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      sender_name: 'You',
    });

    await nextTick();

    if (isCurrent(token, conversationId)) {
      scrollToBottom(true);
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          id: serverId,
          conversation_id: conversationId,
          sender_id: senderId,
          content: text,
        })
        .select(MESSAGE_COLUMNS)
        .single();

      if (error) throw error;

      if (!isCurrent(token, conversationId)) return;

      const latest = liveRows.get(data.id) ?? data;

      liveRows.set(data.id, latest);
      upsertMessage(latest);

      await nextTick();

      if (isCurrent(token, conversationId)) {
        scrollToBottom(true);
      }
    } catch (error: unknown) {
      if (isCurrent(token, conversationId)) {
        messages.value = messages.value.filter(
          (message) => message.id !== tempId,
        );
      }

      throw error;
    }
  }

  function signalTyping(): void {
    if (
      !channel ||
      !auth.user?.id ||
      connectionStatus.value !== 'live' ||
      typingTimer
    ) {
      return;
    }

    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: auth.user.id,
        name: auth.displayName || 'Member',
      },
    });

    typingTimer = setTimeout(() => {
      typingTimer = undefined;
    }, 2000);
  }

  async function markRead(): Promise<void> {
    const conversationId = currentConversationId;
    const userId = auth.user?.id;

    if (!conversationId || !userId) return;

    await supabase
      .from('conversation_members')
      .update({
        last_read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }

  function isNearBottom(): boolean {
    const element = messagesEl.value;

    if (!element) return true;

    return (
      element.scrollHeight -
        element.scrollTop -
        element.clientHeight <
      120
    );
  }

  function scrollToBottom(force = false): void {
    const element = messagesEl.value;

    if (!element) return;

    if (force || isNearBottom()) {
      element.scrollTop = element.scrollHeight;
    }
  }

  onBeforeUnmount(close);

  return {
    messages,
    messagesEl,
    typingUsers,
    onlineUserIds,
    loadingMessages,
    messagesError,
    connectionStatus,
    openConversation,
    close,
    send,
    signalTyping,
    markRead,
    scrollToBottom,
    isNearBottom,
  };
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message);
  }

  return 'Unable to load messages. Please try again.';
}