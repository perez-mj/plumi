<!-- src/views/shared/messaging/MessagesPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false">
      <div class="messages">
        <PageHeader title="Messages" subtitle="Your conversations" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!conversations.length" title="No conversations yet"
          message="Course discussions and direct messages will appear here." :icon="chatbubblesOutline" />

        <div v-else class="messages__layout">
          <aside class="conv-list">
            <button v-for="c in conversations" :key="c.id" class="conv"
              :class="{ 'conv--active': selectedId === c.id }" @click="selectConversation(c.id)">
              <span class="conv__avatar">{{ (c.title ?? 'C').charAt(0) }}</span>
              <div class="conv__body">
                <p class="conv__title">{{ c.title ?? 'Untitled' }}</p>
                <p class="conv__type">{{ c.type }}</p>
              </div>
            </button>
          </aside>

          <section class="chat">
            <div v-if="!selectedId" class="chat__empty">
              <p>Select a conversation to start messaging.</p>
            </div>
            <template v-else>
              <div ref="messagesRef" class="chat__messages">
                <div v-for="msg in messages" :key="msg.id" class="chat__msg">
                  <p class="chat__msg-author">{{ msg.sender_name }}</p>
                  <p class="chat__msg-content">{{ msg.content }}</p>
                  <p class="chat__msg-time">{{ formatTime(msg.created_at) }}</p>
                </div>
              </div>
              <form class="chat__composer" @submit.prevent="send">
                <input v-model="draft" placeholder="Type a message…" class="chat__input" />
                <ion-button type="submit" :disabled="!draft.trim() || sending">
                  <ion-icon :icon="sendOutline" />
                </ion-button>
              </form>
            </template>
          </section>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { chatbubblesOutline, sendOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface Conversation { id: string; title: string | null; type: string; }
interface ChatMessage { id: string; content: string; created_at: string; sender_name: string; }

const auth = useAuthStore();
const conversations = ref<Conversation[]>([]);
const messages = ref<ChatMessage[]>([]);
const selectedId = ref<string | null>(null);
const draft = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const sending = ref(false);
const messagesRef = ref<HTMLDivElement | null>(null);

let channel: ReturnType<typeof supabase.channel> | null = null;

async function load() {
  error.value = null;
  try {
    const { data, error: err } = await supabase
      .from('conversations')
      .select('id, title, type')
      .order('updated_at', { ascending: false });
    if (err) throw err;
    conversations.value = (data ?? []) as Conversation[];
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function selectConversation(id: string) {
  selectedId.value = id;
  if (channel) await channel.unsubscribe();
  channel = null;

  const { data, error: err } = await supabase
    .from('messages')
    .select(`id, content, created_at, sender:profiles!messages_sender_id_fkey ( first_name, last_name )`)
    .eq('conversation_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (err) { error.value = err.message; return; }

  messages.value = (data ?? []).map((m) => {
    const sender = (m as { sender: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] }).sender;
    const s = Array.isArray(sender) ? sender[0] : sender;
    return {
      id: m.id, content: m.content, created_at: m.created_at,
      sender_name: s ? `${s.first_name} ${s.last_name}` : 'Unknown',
    };
  });

  await nextTick();
  scrollToBottom();

  channel = supabase
    .channel(`messages-${id}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
      (payload) => {
        const m = payload.new as { id: string; content: string; created_at: string; sender_id: string };
        messages.value.push({
          id: m.id, content: m.content, created_at: m.created_at,
          sender_name: m.sender_id === auth.user?.id ? 'You' : 'Someone',
        });
        void nextTick(scrollToBottom);
      })
    .subscribe();
}

async function send() {
  if (!draft.value.trim() || !selectedId.value || !auth.user) return;
  sending.value = true;
  try {
    const { error: err } = await supabase.from('messages').insert({
      conversation_id: selectedId.value,
      sender_id: auth.user.id,
      content: draft.value.trim(),
    });
    if (err) throw err;
    draft.value = '';
  } finally { sending.value = false; }
}

function scrollToBottom() {
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
onBeforeUnmount(() => { void channel?.unsubscribe(); });
</script>

<style scoped>
/* No vh math — this fills ion-content, which fills ion-page, which
   fills the router outlet inside .content-wrapper. */
.messages {
  display: flex;
  flex-direction: column;
  gap: var(--size-4, 1rem);
  height: 100%;
  min-height: 0;
  padding: var(--plumi-page-padding, var(--size-4, 1rem));
  max-width: var(--plumi-content-max-width, 1100px);
  margin-inline: auto;
  width: 100%;
}
.messages__layout {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--size-3, 0.75rem);
}
@media (max-width: 767px) {
  .messages__layout { grid-template-columns: 1fr; }
  .conv-list { max-height: 40%; }
}
.conv-list { border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); overflow-y: auto; padding: var(--size-2, 0.5rem); display: flex; flex-direction: column; gap: 2px; min-height: 0; }
.conv { display: flex; align-items: center; gap: var(--size-2, 0.5rem); padding: var(--size-2, 0.5rem); border: 0; border-radius: var(--plumi-radius-sm); background: transparent; text-align: start; cursor: pointer; }
.conv:hover, .conv--active { background: var(--plumi-surface-muted); }
.conv__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); flex: 0 0 auto; }
.conv__body { flex: 1; min-width: 0; }
.conv__title { margin: 0; font-size: var(--plumi-text-sm); color: var(--plumi-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv__type { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.chat { display: flex; flex-direction: column; border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); overflow: hidden; min-height: 0; }
.chat__empty { flex: 1; display: grid; place-items: center; color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.chat__messages { flex: 1; overflow-y: auto; padding: var(--size-3, 0.75rem); display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); min-height: 0; }
.chat__msg { padding: var(--size-2, 0.5rem) var(--size-3, 0.75rem); background: var(--plumi-surface-muted); border-radius: var(--plumi-radius-md); max-width: 75%; }
.chat__msg-author { margin: 0 0 2px; font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); color: var(--plumi-primary); }
.chat__msg-content { margin: 0; font-size: var(--plumi-text-sm); white-space: pre-line; }
.chat__msg-time { margin: 2px 0 0; font-size: 10px; color: var(--plumi-text-subtle); }
.chat__composer { display: flex; gap: var(--size-2, 0.5rem); padding: var(--size-2, 0.5rem); border-top: 1px solid var(--plumi-border); }
.chat__input { flex: 1; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
</style>