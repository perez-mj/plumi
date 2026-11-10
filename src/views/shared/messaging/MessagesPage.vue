<!-- src/views/shared/messaging/MessagesPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false">
      <div class="messages-page">
        <!-- Unified Toolbar (No Title) -->
        <div class="messages-toolbar">
          <div class="messages-toolbar__actions">
            <ion-button size="small" @click="openNewPicker">
              <ion-icon slot="start" :icon="addOutline" /> New message
            </ion-button>
          </div>
        </div>

        <LoadingState v-if="loadingConversations" />

        <ErrorState
          v-else-if="conversationsError"
          :message="conversationsError"
          @retry="loadConversations()"
        />

        <div
          v-else
          class="messenger"
          :class="{ 'messenger--chat-open': selectedId }"
        >
          <!-- INBOX PANEL -->
          <aside class="conversation-panel">
            <div class="conversation-panel__header">
              <div class="conversation-search">
                <ion-icon :icon="searchOutline" />
                <input
                  v-model="conversationSearch"
                  type="search"
                  aria-label="Search conversations"
                  placeholder="Search conversations"
                />
              </div>
              <button
                type="button"
                class="icon-button"
                aria-label="Refresh conversations"
                @click="loadConversations()"
              >
                <ion-icon :icon="refreshOutline" />
              </button>
            </div>

            <div class="conversation-list">
              <p v-if="!conversations.length" class="panel-hint">
                Your conversations will appear here. Select New message to get started.
              </p>
              <p v-else-if="!filteredConversations.length" class="panel-hint">
                No matching conversations.
              </p>

              <button
                v-for="conversation in filteredConversations"
                :key="conversation.id"
                type="button"
                class="conversation"
                :class="{ 'conversation--active': selectedId === conversation.id }"
                @click="selectConversation(conversation.id)"
              >
                <span class="avatar">
                  {{ initials(conversationLabel(conversation)) }}
                </span>

                <span class="conversation__body">
                  <span class="conversation__heading">
                    <strong>{{ conversationLabel(conversation) }}</strong>
                    <time>{{ formatConversationDate(conversation.updated_at) }}</time>
                  </span>
                  <span class="conversation__type">
                    {{ typeLabel(conversation.type) }}
                  </span>
                </span>
              </button>
            </div>
          </aside>

          <!-- CHAT PANEL -->
          <section class="chat-panel">
            <div v-if="!selectedId" class="chat-placeholder">
              <span class="chat-placeholder__icon">
                <ion-icon :icon="chatbubblesOutline" />
              </span>
              <h2>Your conversations, in one place</h2>
              <p>Select a conversation or start a new message with someone from your courses.</p>
              <ion-button @click="openNewPicker">
                <ion-icon slot="start" :icon="addOutline" /> Start a conversation
              </ion-button>
            </div>

            <template v-else>
              <header class="chat-header">
                <button
                  type="button"
                  class="icon-button chat-header__back"
                  aria-label="Back to conversations"
                  @click="backToConversations"
                >
                  <ion-icon :icon="arrowBackOutline" />
                </button>

                <span class="avatar">
                  {{ initials(selectedTitle) }}
                </span>

                <div class="chat-header__details">
                  <h2>{{ selectedTitle }}</h2>
                  <p class="connection-status" :class="{ 'connection-status--live': connectionStatus === 'live' }">
                    <span />
                    {{ connectionLabel }}
                  </p>
                </div>

                <button
                  type="button"
                  class="icon-button"
                  aria-label="Reload conversation"
                  @click="reopen"
                >
                  <ion-icon :icon="refreshOutline" />
                </button>
              </header>

              <LoadingState v-if="loadingMessages" />
              <ErrorState v-else-if="messagesError" :message="messagesError" @retry="reopen" />

              <template v-else>
                <div
                  ref="messagesEl"
                  class="chat-messages"
                  aria-label="Conversation messages"
                  @scroll.passive="handleMessagesScroll"
                >
                  <div v-if="!messages.length" class="empty-chat">
                    <ion-icon :icon="chatbubbleOutline" />
                    <h3>Start the conversation</h3>
                    <p>Send the first message below.</p>
                  </div>

                  <template v-for="(message, index) in messages" :key="message.id">
                    <div v-if="showDateSeparator(index)" class="date-separator">
                      <span>{{ formatMessageDate(message.created_at) }}</span>
                    </div>

                    <article class="message" :class="{ 'message--mine': message.sender_id === auth.user?.id }">
                      <span v-if="message.sender_id !== auth.user?.id" class="message__avatar">
                        {{ initials(message.sender_name) }}
                      </span>

                      <div class="message__body">
                        <span v-if="message.sender_id !== auth.user?.id" class="message__author">
                          {{ message.sender_name }}
                        </span>

                        <div class="message__bubble">
                          <p>{{ message.content }}</p>
                        </div>

                        <div class="message__meta">
                          <time>{{ formatTime(message.created_at) }}</time>
                          <span v-if="message.edited_at">Edited</span>
                          <span v-if="message.id.startsWith('tmp-')">Sending…</span>
                        </div>
                      </div>
                    </article>
                  </template>
                </div>

                <button v-if="showLatestButton" type="button" class="latest-button" @click="jumpToLatest">
                  <ion-icon :icon="arrowDownOutline" /> Latest messages
                </button>

                <div class="typing-status" aria-live="polite">
                  <template v-if="typingLabel">
                    <span class="typing-dots"><i /><i /><i /></span>
                    {{ typingLabel }}
                  </template>
                </div>

                <div v-if="sendError" class="send-error" role="alert">{{ sendError }}</div>

                <form class="composer" @submit.prevent="sendDraft">
                  <textarea
                    v-model="draft"
                    rows="2"
                    class="composer__input"
                    aria-label="Message"
                    placeholder="Write a message…"
                    :disabled="sending"
                    @input="signalTyping"
                    @keydown="handleComposerKeydown"
                  />

                  <ion-button
                    type="submit"
                    class="composer__send"
                    aria-label="Send message"
                    :disabled="!draft.trim() || sending"
                  >
                    <ion-spinner v-if="sending" name="crescent" />
                    <ion-icon v-else :icon="sendOutline" />
                  </ion-button>
                </form>
              </template>
            </template>
          </section>
        </div>
      </div>

      <!-- NEW MESSAGE MODAL -->
      <ion-modal class="people-modal" :is-open="showNewPicker" @didDismiss="closeNewPicker">
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>New message</ion-title>
            <ion-buttons slot="end">
              <ion-button aria-label="Close" :disabled="startingDirect" @click="closeNewPicker">
                <ion-icon slot="icon-only" :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <div class="people-picker">
            <div class="conversation-search">
              <ion-icon :icon="searchOutline" />
              <input
                v-model="peopleSearch"
                type="search"
                aria-label="Search people"
                placeholder="Search by name"
                :disabled="startingDirect"
              />
            </div>

            <LoadingState v-if="loadingPeople" />
            <p v-if="peopleError" class="send-error" role="alert">{{ peopleError }}</p>

            <p v-if="!loadingPeople && !peopleError && !peopleList.length" class="panel-hint">
              {{ peopleSearch.trim() ? 'No people match your search.' : 'No eligible people are available yet.' }}
            </p>

            <div v-if="!loadingPeople" class="people-list">
              <button
                v-for="person in peopleList"
                :key="person.id"
                type="button"
                class="person"
                :disabled="startingDirect"
                @click="startDirect(person.id)"
              >
                <span class="avatar">
                  <img v-if="person.avatar_url" :src="person.avatar_url" alt="" />
                  <template v-else>
                    {{ initials(`${person.first_name} ${person.last_name}`) }}
                  </template>
                </span>

                <span class="person__details">
                  <strong>{{ person.first_name }} {{ person.last_name }}</strong>
                  <span>Course member</span>
                </span>

                <ion-spinner v-if="startingDirect && startingPersonId === person.id" name="crescent" />
                <ion-icon v-else :icon="chevronForwardOutline" />
              </button>
            </div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, ref, watch,
} from 'vue';
import { useRoute } from 'vue-router';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal,
  IonPage, IonSpinner, IonTitle, IonToolbar, onIonViewDidEnter, onIonViewWillLeave,
} from '@ionic/vue';
import {
  addOutline, arrowBackOutline, arrowDownOutline, chatbubbleOutline,
  chatbubblesOutline, chevronForwardOutline, closeOutline, refreshOutline,
  searchOutline, sendOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useAuthStore } from '@/stores/authStore';
import { useMessages } from '@/composables/useMessages';
import {
  listMessageablePeople, listMyConversations, openDirectConversation,
  type ConversationSummary, type PersonSummary,
} from '@/services/messaging';

const auth = useAuthStore();
const route = useRoute();

const conversations = ref<ConversationSummary[]>([]);
const loadingConversations = ref(true);
const conversationsError = ref<string | null>(null);
const conversationSearch = ref('');
const selectedId = ref<string | null>(null);
const draft = ref('');
const sending = ref(false);
const sendError = ref<string | null>(null);
const showLatestButton = ref(false);

const showNewPicker = ref(false);
const peopleSearch = ref('');
const peopleList = ref<PersonSummary[]>([]);
const loadingPeople = ref(false);
const peopleError = ref<string | null>(null);
const startingDirect = ref(false);
const startingPersonId = ref<string | null>(null);

const {
  messages, messagesEl, typingUsers, loadingMessages, messagesError,
  connectionStatus, openConversation, close, send, signalTyping, markRead,
  scrollToBottom, isNearBottom,
} = useMessages();

let active = false;
let conversationRequest = 0;
let peopleRequest = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const filteredConversations = computed(() => {
  const term = conversationSearch.value.trim().toLocaleLowerCase();
  return conversations.value.filter((conversation) =>
    conversationLabel(conversation).toLocaleLowerCase().includes(term)
  );
});

const selectedConversation = computed(() =>
  conversations.value.find((conversation) => conversation.id === selectedId.value)
);

const selectedTitle = computed(() =>
  selectedConversation.value ? conversationLabel(selectedConversation.value) : 'Conversation'
);

const connectionLabel = computed(() => {
  if (connectionStatus.value === 'live') return 'Live updates connected';
  if (connectionStatus.value === 'connecting') return 'Connecting…';
  if (connectionStatus.value === 'error') return 'Connection interrupted · tap reload';
  return 'Conversation';
});

const typingLabel = computed(() => {
  const people = Object.values(typingUsers.value).map((person) => person.name);
  if (!people.length) return '';
  return `${people.join(', ')} ${people.length === 1 ? 'is' : 'are'} typing…`;
});

function conversationLabel(conversation: ConversationSummary): string {
  return (
    conversation.title?.trim() ||
    (conversation.type === 'DIRECT' ? 'Direct message'
      : conversation.type === 'COURSE' ? 'Course conversation' : 'Group conversation')
  );
}

function typeLabel(type: ConversationSummary['type']): string {
  return {
    DIRECT: 'Direct message',
    COURSE: 'Course conversation',
    GROUP: 'Group conversation',
  }[type];
}

function initials(name: string): string {
  return (
    name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part.charAt(0)).join('').toUpperCase() || 'M'
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return fallback;
}

async function loadConversations(showLoading = true): Promise<void> {
  const request = ++conversationRequest;
  if (showLoading) loadingConversations.value = true;
  conversationsError.value = null;

  try {
    const rows = await listMyConversations();
    if (!active || request !== conversationRequest) return;
    conversations.value = rows;
  } catch (error: unknown) {
    if (!active || request !== conversationRequest) return;
    if (showLoading) {
      conversationsError.value = getErrorMessage(error, 'Unable to load conversations.');
    }
  } finally {
    if (active && request === conversationRequest) loadingConversations.value = false;
  }
}

async function selectConversation(id: string): Promise<void> {
  if (selectedId.value === id && connectionStatus.value !== 'idle') return;
  selectedId.value = id;
  draft.value = '';
  sendError.value = null;
  showLatestButton.value = false;
  await openConversation(id);
}

async function reopen(): Promise<void> {
  const id = selectedId.value;
  if (!id) return;
  sendError.value = null;
  showLatestButton.value = false;
  await openConversation(id);
}

function backToConversations(): void {
  close();
  selectedId.value = null;
  sendError.value = null;
  showLatestButton.value = false;
}

async function sendDraft(): Promise<void> {
  const text = draft.value;
  const id = selectedId.value;
  if (!id || !text.trim() || sending.value) return;

  sending.value = true;
  sendError.value = null;

  try {
    await send(text);
    if (active && selectedId.value === id && draft.value === text) {
      draft.value = '';
    }
    if (active) void loadConversations(false);
  } catch (error: unknown) {
    if (active && selectedId.value === id) {
      sendError.value = getErrorMessage(error, 'Message could not be sent. Please try again.');
    }
  } finally {
    sending.value = false;
  }
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendDraft();
  }
}

function handleMessagesScroll(): void {
  showLatestButton.value = !isNearBottom();
}

function jumpToLatest(): void {
  scrollToBottom(true);
  showLatestButton.value = false;
  void markRead();
}

function openNewPicker(): void {
  showNewPicker.value = true;
  peopleSearch.value = '';
  peopleError.value = null;
  void loadPeople();
}

function closeNewPicker(): void {
  showNewPicker.value = false;
  peopleRequest++;
  clearTimeout(searchTimer);
  peopleSearch.value = '';
  peopleList.value = [];
  peopleError.value = null;
  loadingPeople.value = false;
}

async function loadPeople(): Promise<void> {
  if (!showNewPicker.value) return;
  const request = ++peopleRequest;
  loadingPeople.value = true;
  peopleError.value = null;

  try {
    const people = await listMessageablePeople(peopleSearch.value);
    if (!active || !showNewPicker.value || request !== peopleRequest) return;
    peopleList.value = people;
  } catch (error: unknown) {
    if (!active || !showNewPicker.value || request !== peopleRequest) return;
    peopleError.value = getErrorMessage(error, 'Unable to load people.');
  } finally {
    if (request === peopleRequest) loadingPeople.value = false;
  }
}

async function startDirect(otherId: string): Promise<void> {
  if (startingDirect.value) return;
  startingDirect.value = true;
  startingPersonId.value = otherId;
  peopleError.value = null;

  try {
    const id = await openDirectConversation(otherId);
    if (!active) return;
    closeNewPicker();
    await loadConversations(false);
    if (active) await selectConversation(id);
  } catch (error: unknown) {
    if (active) {
      peopleError.value = getErrorMessage(error, 'Unable to start the conversation.');
    }
  } finally {
    startingDirect.value = false;
    startingPersonId.value = null;
  }
}

function queryConversationId(): string | null {
  const value = route.query.c ?? route.query.conversation;
  return typeof value === 'string' ? value : null;
}

async function openQueryConversation(): Promise<void> {
  const id = queryConversationId();
  if (id && conversations.value.some((conversation) => conversation.id === id)) {
    await selectConversation(id);
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) return formatTime(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMessageDate(value: string): string {
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function showDateSeparator(index: number): boolean {
  const current = messages.value[index];
  const previous = messages.value[index - 1];
  if (!current) return false;
  if (!previous) return true;
  return new Date(current.created_at).toDateString() !== new Date(previous.created_at).toDateString();
}

function handleFocus(): void {
  if (active && selectedId.value && !document.hidden && isNearBottom()) {
    void markRead();
  }
}

function deactivate(): void {
  active = false;
  conversationRequest++;
  peopleRequest++;
  clearTimeout(searchTimer);
  close();
  closeNewPicker();
  window.removeEventListener('focus', handleFocus);
  document.removeEventListener('visibilitychange', handleFocus);
}

watch(peopleSearch, () => {
  clearTimeout(searchTimer);
  peopleRequest++;
  if (!showNewPicker.value) return;
  loadingPeople.value = true;
  searchTimer = setTimeout(() => { void loadPeople(); }, 300);
});

watch(
  () => [route.query.c, route.query.conversation],
  () => { if (active) void openQueryConversation(); }
);

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    if (active) handleMessagesScroll();
  }
);

onIonViewDidEnter(async () => {
  active = true;
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);
  await loadConversations();
  if (!active) return;
  if (queryConversationId()) {
    await openQueryConversation();
  } else if (selectedId.value && conversations.value.some((c) => c.id === selectedId.value)) {
    await reopen();
  }
});

onIonViewWillLeave(deactivate);
onBeforeUnmount(deactivate);
</script>

<style scoped>
/* =========================================
   UNIFIED DESIGN SYSTEM (NO HARDCODED COLORS)
   ========================================= */

.messages-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--plumi-content-max-width);
  height: 100%;
  min-height: 0;
  margin-inline: auto;
  padding: var(--plumi-page-padding);
  color: var(--plumi-ink);
  gap: var(--plumi-space-4);
}

/* Toolbar */
.messages-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* Pushed to right since title is gone */
  flex-shrink: 0;
}

/* Messenger Grid */
.messenger {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  box-shadow: var(--plumi-shadow-card);
}

/* Left Panel (Inbox) */
.conversation-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
}
.conversation-panel__header {
  display: flex;
  align-items: center;
  gap: var(--plumi-space-2);
  padding: var(--plumi-space-4);
  border-bottom: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
}
.conversation-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--plumi-space-2);
  padding: 0 var(--plumi-space-3);
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface-muted);
  color: var(--plumi-text-muted);
}
.conversation-search:focus-within {
  border-color: var(--plumi-primary);
  background: var(--plumi-surface);
}
.conversation-search input {
  width: 100%;
  height: 40px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--plumi-ink);
  font: inherit;
  font-size: var(--plumi-text-sm);
}
.conversation-search input::placeholder {
  color: var(--plumi-text-muted);
}

.icon-button {
  display: inline-grid;
  flex: 0 0 36px;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  border-radius: var(--plumi-radius-sm);
  background: var(--plumi-surface);
  color: var(--plumi-text-muted);
  cursor: pointer;
  transition: all var(--plumi-duration-fast) var(--plumi-easing);
}
.icon-button:hover {
  color: var(--plumi-primary);
  background: var(--plumi-primary-soft);
}

.conversation-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--plumi-space-2);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.conversation {
  display: flex;
  align-items: center;
  gap: var(--plumi-space-3);
  width: 100%;
  padding: var(--plumi-space-3);
  border: 0;
  border-radius: var(--plumi-radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--plumi-duration-fast) var(--plumi-easing);
}
.conversation:hover { background: var(--plumi-surface-muted); }
.conversation--active { background: var(--plumi-primary-soft); }

.avatar {
  display: grid;
  flex: 0 0 42px;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  font-size: var(--plumi-text-xs);
  font-weight: var(--plumi-weight-bold);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }

.conversation__body { flex: 1; min-width: 0; }
.conversation__heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.conversation__heading strong { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); color: var(--plumi-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conversation__heading time { flex-shrink: 0; color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); }
.conversation__type { display: block; margin-top: 4px; color: var(--plumi-text-muted); font-size: 11px; }

.panel-hint {
  margin: 0; padding: var(--plumi-space-6) var(--plumi-space-4);
  color: var(--plumi-text-muted); font-size: var(--plumi-text-sm);
  line-height: var(--plumi-line-relaxed); text-align: center;
}

/* Right Panel (Chat) */
.chat-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--plumi-bg);
}
.chat-placeholder {
  display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center;
  padding: var(--plumi-space-6); text-align: center;
}
.chat-placeholder__icon {
  display: grid; place-items: center; width: 86px; height: 86px;
  margin-bottom: var(--plumi-space-4); border-radius: var(--plumi-radius-xl);
  background: var(--plumi-primary-soft); color: var(--plumi-primary);
}
.chat-placeholder__icon ion-icon { font-size: 38px; }
.chat-placeholder h2 { margin: 0; font-size: var(--plumi-text-xl); font-weight: var(--plumi-weight-bold); color: var(--plumi-ink); }
.chat-placeholder p { max-width: 350px; margin: var(--plumi-space-3) 0 var(--plumi-space-5); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }

.chat-header {
  display: flex; flex-shrink: 0; align-items: center; gap: var(--plumi-space-3);
  min-height: 72px; padding: var(--plumi-space-3) var(--plumi-space-4);
  border-bottom: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  background: var(--plumi-surface);
}
.chat-header__back { display: none; }
.chat-header__details { flex: 1; min-width: 0; }
.chat-header__details h2 { margin: 0; font-size: var(--plumi-text-md); font-weight: var(--plumi-weight-bold); color: var(--plumi-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.connection-status { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; color: var(--plumi-text-muted); font-size: 11px; }
.connection-status > span { width: 6px; height: 6px; border-radius: 50%; background: var(--plumi-text-subtle); }
.connection-status--live > span { background: var(--plumi-success); }

.chat-messages {
  display: flex; flex: 1; flex-direction: column; gap: var(--plumi-space-4);
  min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: var(--plumi-space-4); background: var(--plumi-bg);
}
.empty-chat { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; color: var(--plumi-text-muted); text-align: center; }
.empty-chat > ion-icon { font-size: 36px; }
.empty-chat h3 { margin: var(--plumi-space-3) 0 0; color: var(--plumi-ink); font-size: var(--plumi-text-md); }
.empty-chat p { margin-top: var(--plumi-space-2); font-size: var(--plumi-text-sm); }

.date-separator { display: flex; justify-content: center; margin: var(--plumi-space-2) 0; }
.date-separator span { padding: 4px 12px; border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); border-radius: var(--plumi-radius-pill); background: var(--plumi-surface); color: var(--plumi-text-muted); font-size: var(--plumi-text-xs); }

.message { display: flex; align-items: flex-end; align-self: flex-start; gap: var(--plumi-space-2); max-width: 80%; }
.message--mine { align-self: flex-end; }
.message__avatar { display: grid; flex: 0 0 28px; place-items: center; width: 28px; height: 28px; margin-bottom: 18px; border-radius: var(--plumi-radius-sm); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-size: 9px; font-weight: var(--plumi-weight-bold); }
.message__body { min-width: 0; }
.message__author { display: block; margin: 0 0 4px 4px; color: var(--plumi-text-muted); font-size: 10px; font-weight: var(--plumi-weight-medium); }
.message__bubble { padding: var(--plumi-space-2) var(--plumi-space-3); border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); border-radius: var(--plumi-radius-md) var(--plumi-radius-md) var(--plumi-radius-md) 2px; background: var(--plumi-surface); }
.message--mine .message__bubble { border-color: transparent; border-radius: var(--plumi-radius-md) var(--plumi-radius-md) 2px var(--plumi-radius-md); background: var(--plumi-primary); color: var(--plumi-brand-contrast); }
.message__bubble p { margin: 0; overflow-wrap: anywhere; font-size: var(--plumi-text-sm); line-height: 1.5; white-space: pre-wrap; }
.message__meta { display: flex; gap: 6px; margin-top: 4px; color: var(--plumi-text-muted); font-size: 9px; }
.message--mine .message__meta { justify-content: flex-end; }

.typing-status { display: flex; flex-shrink: 0; align-items: center; gap: 6px; min-height: 24px; padding: 4px var(--plumi-space-4); color: var(--plumi-text-muted); font-size: 11px; }
.typing-dots { display: inline-flex; gap: 2px; }
.typing-dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--plumi-primary); }

.composer { display: flex; flex-shrink: 0; align-items: flex-end; gap: var(--plumi-space-2); margin: 0 var(--plumi-space-4) var(--plumi-space-4); padding: var(--plumi-space-2) var(--plumi-space-2) var(--plumi-space-2) var(--plumi-space-3); border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.composer:focus-within { border-color: var(--plumi-primary); }
.composer__input { display: block; flex: 1; min-width: 0; max-height: 150px; padding: var(--plumi-space-1) 0; border: 0; outline: 0; resize: vertical; background: transparent; color: var(--plumi-ink); font: inherit; font-size: var(--plumi-text-sm); line-height: 1.5; }
.composer__send { --border-radius: var(--plumi-radius-sm); --box-shadow: none; width: 42px; height: 42px; margin: 0; }
.composer__send ion-spinner { width: 18px; height: 18px; }

.send-error { margin: 0; padding: var(--plumi-space-2) var(--plumi-space-4); color: var(--plumi-danger); font-size: var(--plumi-text-xs); }

.latest-button {
  position: absolute; right: var(--plumi-space-4); bottom: 140px;
  display: flex; align-items: center; gap: 6px; padding: var(--plumi-space-2) var(--plumi-space-3);
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); border-radius: var(--plumi-radius-pill);
  background: var(--plumi-surface); color: var(--plumi-primary);
  box-shadow: var(--plumi-shadow-card); cursor: pointer; font-size: 11px;
}

/* People Modal (New Message) */
.people-modal {
  --width: 480px; --height: auto; --max-height: 85vh;
  --border-radius: var(--plumi-radius-lg); --box-shadow: var(--plumi-shadow-popover);
}
.people-modal::part(content) { border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border); }
.people-modal ion-toolbar { --background: var(--plumi-surface); --color: var(--plumi-ink); }
.people-modal ion-content { --background: var(--plumi-surface); }
.people-picker { padding: var(--plumi-space-4); display: flex; flex-direction: column; gap: var(--plumi-space-4); }
.people-picker .conversation-search { margin: 0; }

.people-list { display: flex; flex-direction: column; gap: 4px; }
.person {
  display: flex; align-items: center; gap: var(--plumi-space-3);
  width: 100%; padding: var(--plumi-space-3);
  border: 0; border-radius: var(--plumi-radius-md);
  background: transparent; color: var(--plumi-ink);
  text-align: left; cursor: pointer; transition: background var(--plumi-duration-fast);
}
.person:hover { background: var(--plumi-surface-muted); }
.person:disabled { cursor: wait; opacity: 0.65; }
.person__details { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.person__details strong { font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person__details > span { color: var(--plumi-text-muted); font-size: 11px; }
.person > ion-icon { color: var(--plumi-text-muted); }

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .messages-page { padding: var(--plumi-space-3); gap: var(--plumi-space-3); }
  
  .messenger { display: flex; flex-direction: column; border-radius: var(--plumi-radius-md); }
  .conversation-panel { flex: 1; border-right: 0; }
  .chat-panel { display: none; }
  
  .messenger--chat-open .conversation-panel { display: none; }
  .messenger--chat-open .chat-panel { display: flex; flex: 1; }

  .chat-header { gap: var(--plumi-space-2); min-height: 64px; padding: var(--plumi-space-2) var(--plumi-space-3); }
  .chat-header__back { display: inline-grid; }
  .chat-header .avatar { flex-basis: 32px; width: 32px; height: 32px; border-radius: var(--plumi-radius-sm); font-size: 10px; }
  .chat-header__details h2 { font-size: var(--plumi-text-sm); }
  .connection-status { font-size: 9px; }

  .chat-messages { padding: var(--plumi-space-3); gap: var(--plumi-space-3); }
  .message { max-width: 92%; }
  .message__bubble { padding: var(--plumi-space-2); }
  
  .composer { margin: 0 var(--plumi-space-3) var(--plumi-space-3); border-radius: var(--plumi-radius-md); }
  .composer__input { font-size: 16px; } /* Prevents iOS zoom */
  
  .latest-button { bottom: 120px; right: var(--plumi-space-3); }
  
  .people-modal { --width: 100%; --height: 80%; --max-height: 90%; --border-radius: var(--plumi-radius-xl) var(--plumi-radius-xl) 0 0; align-items: flex-end; }
}
</style>