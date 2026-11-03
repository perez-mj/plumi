<!-- src/views/shared/messaging/MessagesPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false">
      <div class="messages">
        <PageHeader title="Messages" subtitle="Your conversations">
          <template #actions>
            <ion-button size="small" @click="openNewPicker">
              <ion-icon slot="start" :icon="addOutline" /> New
            </ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loadingConversations" />
        <ErrorState v-else-if="conversationsError" :message="conversationsError" @retry="loadConversations" />
        <EmptyState v-else-if="!conversations.length" title="No conversations yet"
          message="Start a conversation with someone from your courses." :icon="chatbubblesOutline">
          <ion-button size="small" @click="openNewPicker">
            <ion-icon slot="start" :icon="addOutline" /> New conversation
          </ion-button>
        </EmptyState>

        <div v-else class="messages__layout">
          <aside class="conv-list">
            <button v-for="c in conversations" :key="c.id" class="conv"
              :class="{ 'conv--active': selectedId === c.id }" @click="selectConversation(c.id)">
              <span class="conv__avatar">{{ (c.title ?? 'C').charAt(0) }}</span>
              <div class="conv__body">
                <p class="conv__title">{{ c.title ?? conversationLabel(c) }}</p>
                <p class="conv__type">{{ c.type }}</p>
              </div>
            </button>
          </aside>

          <section class="chat">
            <div v-if="!selectedId" class="chat__empty">
              <p>Select a conversation to start messaging.</p>
            </div>
            <template v-else>
              <LoadingState v-if="loadingMessages" />
              <ErrorState v-else-if="messagesError" :message="messagesError" @retry="reopen" />
              <template v-else>
                <div ref="messagesEl" class="chat__messages">
                  <div
                    v-for="msg in messages"
                    :key="msg.id"
                    class="chat__msg"
                    :class="{ 'chat__msg--mine': msg.sender_id === auth.user?.id }"
                  >
                    <p class="chat__msg-author">{{ msg.sender_name }}</p>
                    <p class="chat__msg-content">{{ msg.content }}</p>
                    <p class="chat__msg-time">{{ formatTime(msg.created_at) }}</p>
                  </div>
                </div>
                <p v-if="typingList" class="chat__typing">{{ typingList }} typing…</p>
                <form class="chat__composer" @submit.prevent="sendDraft">
                  <input
                    v-model="draft"
                    placeholder="Type a message…"
                    class="chat__input"
                    @input="signalTyping"
                  />
                  <ion-button type="submit" :disabled="!draft.trim() || sending">
                    <ion-icon :icon="sendOutline" />
                  </ion-button>
                </form>
              </template>
            </template>
          </section>
        </div>
      </div>

      <!-- New conversation picker -->
      <ion-modal :is-open="showNewPicker" @didDismiss="closeNewPicker">
        <ion-content class="modal-content">
          <div class="modal-inner">
            <h2>New conversation</h2>
            <input
              v-model="peopleSearch"
              placeholder="Search people…"
              class="modal-input"
            />
            <LoadingState v-if="loadingPeople" />
            <p v-else-if="peopleError" class="modal-error">{{ peopleError }}</p>
            <p v-else-if="!peopleList.length" class="modal-hint">
              No one to message yet. You can message people who share a course with you.
            </p>
            <ul v-else class="people-list">
              <li
                v-for="p in peopleList"
                :key="p.id"
                class="people-item"
                @click="startDirect(p.id)"
              >
                <span class="people-avatar">
                  <img v-if="p.avatar_url" :src="p.avatar_url" :alt="p.first_name" />
                  <template v-else>{{ p.first_name.charAt(0) }}</template>
                </span>
                <div class="people-body">
                  <p class="people-name">{{ p.first_name }} {{ p.last_name }}</p>
                  <p class="people-email">{{ p.email }}</p>
                </div>
              </li>
            </ul>
            <div class="modal-actions">
              <ion-button fill="clear" @click="closeNewPicker">Close</ion-button>
            </div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonContent, IonButton, IonIcon, IonModal,
} from '@ionic/vue';
import {
  addOutline, chatbubblesOutline, sendOutline,
} from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useAuthStore } from '@/stores/authStore';
import { useMessages } from '@/composables/useMessages';
import {
  listMyConversations,
  openDirectConversation,
  listMessageablePeople,
  type ConversationSummary,
  type PersonSummary,
} from '@/services/messaging';

const auth = useAuthStore();
const route = useRoute();

const conversations = ref<ConversationSummary[]>([]);
const loadingConversations = ref(true);
const conversationsError = ref<string | null>(null);
const selectedId = ref<string | null>(null);
const draft = ref('');
const sending = ref(false);

const showNewPicker = ref(false);
const peopleSearch = ref('');
const peopleList = ref<PersonSummary[]>([]);
const loadingPeople = ref(false);
const peopleError = ref<string | null>(null);

const {
  messages,
  messagesEl,
  typingUsers,
  loadingMessages,
  messagesError,
  openConversation,
  close,
  send,
  signalTyping,
  markRead,
} = useMessages();

const typingList = computed(() =>
  Object.values(typingUsers.value).map((t) => t.name).join(', '),
);

function conversationLabel(c: ConversationSummary): string {
  if (c.type === 'COURSE' && c.title) return c.title;
  return c.type === 'DIRECT' ? 'Direct message' : c.type;
}

async function loadConversations() {
  conversationsError.value = null;
  loadingConversations.value = true;
  try {
    conversations.value = await listMyConversations();
  } catch (e: unknown) {
    conversationsError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loadingConversations.value = false;
  }
}

async function selectConversation(id: string) {
  if (selectedId.value === id) return;
  close();
  selectedId.value = id;
  await openConversation(id);
}

async function reopen() {
  if (selectedId.value) await openConversation(selectedId.value);
}

async function sendDraft() {
  const text = draft.value;
  if (!text.trim()) return;
  sending.value = true;
  try {
    await send(text);
    draft.value = '';
    await markRead();
  } finally {
    sending.value = false;
  }
}

/* ------------------ New conversation ------------------ */

function openNewPicker() {
  showNewPicker.value = true;
  peopleSearch.value = '';
}

function closeNewPicker() {
  showNewPicker.value = false;
  peopleSearch.value = '';
  peopleList.value = [];
  peopleError.value = null;
}

async function loadPeople() {
  loadingPeople.value = true;
  peopleError.value = null;
  try {
    peopleList.value = await listMessageablePeople(peopleSearch.value);
  } catch (e: unknown) {
    peopleError.value = e instanceof Error ? e.message : 'Failed to load people.';
  } finally {
    loadingPeople.value = false;
  }
}

async function startDirect(otherId: string) {
  try {
    const id = await openDirectConversation(otherId);
    showNewPicker.value = false;
    peopleSearch.value = '';
    await loadConversations();
    await selectConversation(id);
  } catch (e: unknown) {
    peopleError.value = e instanceof Error ? e.message : 'Could not start conversation.';
  }
}

watch(showNewPicker, (v) => { if (v) void loadPeople(); });
watch(peopleSearch, () => { if (showNewPicker.value) void loadPeople(); });

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

onMounted(async () => {
  await loadConversations();
  const target = (route.query.c ?? route.query.conversation) as string | undefined;
  if (target && conversations.value.some((c) => c.id === target)) {
    await selectConversation(target);
  }
});

onBeforeUnmount(close);
</script>

<style scoped>
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
.chat__msg--mine { align-self: flex-end; background: var(--plumi-primary-soft); }
.chat__msg-author { margin: 0 0 2px; font-size: var(--plumi-text-xs); font-weight: var(--plumi-weight-semibold); color: var(--plumi-primary); }
.chat__msg-content { margin: 0; font-size: var(--plumi-text-sm); white-space: pre-line; }
.chat__msg-time { margin: 2px 0 0; font-size: 10px; color: var(--plumi-text-subtle); }
.chat__typing { margin: 0; padding: 0 var(--size-3); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); font-style: italic; }
.chat__composer { display: flex; gap: var(--size-2, 0.5rem); padding: var(--size-2, 0.5rem); border-top: 1px solid var(--plumi-border); }
.chat__input { flex: 1; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.modal-content { --background: var(--plumi-surface); }
.modal-inner { padding: var(--size-5, 1.25rem); max-width: 520px; margin-inline: auto; display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.modal-inner h2 { margin: 0; font-size: var(--plumi-text-lg); }
.modal-input { width: 100%; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.modal-hint { margin: 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); text-align: center; padding: var(--size-3); }
.modal-error { margin: 0; color: var(--plumi-danger); font-size: var(--plumi-text-sm); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
.people-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; max-height: 50vh; overflow-y: auto; }
.people-item { display: flex; align-items: center; gap: var(--size-3); padding: var(--size-2); border-radius: var(--plumi-radius-md); cursor: pointer; }
.people-item:hover { background: var(--plumi-surface-muted); }
.people-avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); overflow: hidden; flex: 0 0 auto; }
.people-avatar img { width: 100%; height: 100%; object-fit: cover; }
.people-body { flex: 1; min-width: 0; }
.people-name { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.people-email { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
</style>