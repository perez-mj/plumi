<template>
  <ion-page>
    <ion-content :scroll-y="false">
      <div class="messages-page">
        <PageHeader
          title="Messages"
          subtitle="Stay connected with your learning community."
        >
          <template #actions>
            <ion-button
              class="new-message-button"
              @click="openNewPicker"
            >
              <ion-icon slot="start" :icon="addOutline" />
              New message
            </ion-button>
          </template>
        </PageHeader>

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
          <aside class="conversation-panel">
            <div class="conversation-panel__header">
              <div>
                <h2>Inbox</h2>
                <p>
                  {{ conversations.length }}
                  {{
                    conversations.length === 1
                      ? 'conversation'
                      : 'conversations'
                  }}
                </p>
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

            <div class="conversation-search">
              <ion-icon :icon="searchOutline" />
              <input
                v-model="conversationSearch"
                type="search"
                aria-label="Search conversations"
                placeholder="Search conversations"
              />
            </div>

            <div class="conversation-list">
              <p
                v-if="!conversations.length"
                class="panel-hint"
              >
                Your conversations will appear here.
                Select New message to get started.
              </p>

              <p
                v-else-if="!filteredConversations.length"
                class="panel-hint"
              >
                No matching conversations.
              </p>

              <button
                v-for="conversation in filteredConversations"
                :key="conversation.id"
                type="button"
                class="conversation"
                :class="{
                  'conversation--active':
                    selectedId === conversation.id,
                }"
                :aria-pressed="selectedId === conversation.id"
                @click="selectConversation(conversation.id)"
              >
                <span class="avatar">
                  {{ initials(conversationLabel(conversation)) }}
                </span>

                <span class="conversation__body">
                  <span class="conversation__heading">
                    <strong>
                      {{ conversationLabel(conversation) }}
                    </strong>
                    <time>
                      {{ formatConversationDate(conversation.updated_at) }}
                    </time>
                  </span>

                  <span class="conversation__type">
                    {{ typeLabel(conversation.type) }}
                  </span>
                </span>

                <ion-icon
                  class="conversation__arrow"
                  :icon="chevronForwardOutline"
                />
              </button>
            </div>
          </aside>

          <section class="chat-panel">
            <div
              v-if="!selectedId"
              class="chat-placeholder"
            >
              <span class="chat-placeholder__icon">
                <ion-icon :icon="chatbubblesOutline" />
              </span>

              <h2>Your conversations, in one place</h2>
              <p>
                Select a conversation or start a new message
                with someone from your courses.
              </p>

              <ion-button @click="openNewPicker">
                <ion-icon slot="start" :icon="addOutline" />
                Start a conversation
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
                  <p
                    class="connection-status"
                    :class="{
                      'connection-status--live':
                        connectionStatus === 'live',
                    }"
                  >
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

              <ErrorState
                v-else-if="messagesError"
                :message="messagesError"
                @retry="reopen"
              />

              <template v-else>
                <div
                  ref="messagesEl"
                  class="chat-messages"
                  aria-label="Conversation messages"
                  @scroll.passive="handleMessagesScroll"
                >
                  <div
                    v-if="!messages.length"
                    class="empty-chat"
                  >
                    <ion-icon :icon="chatbubbleOutline" />
                    <h3>Start the conversation</h3>
                    <p>Send the first message below.</p>
                  </div>

                  <template
                    v-for="(message, index) in messages"
                    :key="message.id"
                  >
                    <div
                      v-if="showDateSeparator(index)"
                      class="date-separator"
                    >
                      <span>
                        {{ formatMessageDate(message.created_at) }}
                      </span>
                    </div>

                    <article
                      class="message"
                      :class="{
                        'message--mine':
                          message.sender_id === auth.user?.id,
                      }"
                    >
                      <span
                        v-if="message.sender_id !== auth.user?.id"
                        class="message__avatar"
                      >
                        {{ initials(message.sender_name) }}
                      </span>

                      <div class="message__body">
                        <span
                          v-if="message.sender_id !== auth.user?.id"
                          class="message__author"
                        >
                          {{ message.sender_name }}
                        </span>

                        <div class="message__bubble">
                          <p>{{ message.content }}</p>
                        </div>

                        <div class="message__meta">
                          <time>
                            {{ formatTime(message.created_at) }}
                          </time>
                          <span v-if="message.edited_at">
                            Edited
                          </span>
                          <span
                            v-if="message.id.startsWith('tmp-')"
                          >
                            Sending…
                          </span>
                        </div>
                      </div>
                    </article>
                  </template>
                </div>

                <button
                  v-if="showLatestButton"
                  type="button"
                  class="latest-button"
                  @click="jumpToLatest"
                >
                  <ion-icon :icon="arrowDownOutline" />
                  Latest messages
                </button>

                <div
                  class="typing-status"
                  aria-live="polite"
                >
                  <template v-if="typingLabel">
                    <span class="typing-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    {{ typingLabel }}
                  </template>
                </div>

                <div
                  v-if="sendError"
                  class="send-error"
                  role="alert"
                >
                  {{ sendError }}
                </div>

                <form
                  class="composer"
                  @submit.prevent="sendDraft"
                >
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
                    <ion-spinner
                      v-if="sending"
                      name="crescent"
                    />
                    <ion-icon
                      v-else
                      :icon="sendOutline"
                    />
                  </ion-button>
                </form>

                <p class="composer-hint">
                  Enter to send · Shift + Enter for a new line
                </p>
              </template>
            </template>
          </section>
        </div>
      </div>

      <ion-modal
        class="people-modal"
        :is-open="showNewPicker"
        @didDismiss="closeNewPicker"
      >
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>New message</ion-title>
            <ion-buttons slot="end">
              <ion-button
                aria-label="Close new message"
                :disabled="startingDirect"
                @click="closeNewPicker"
              >
                <ion-icon
                  slot="icon-only"
                  :icon="closeOutline"
                />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <div class="people-picker">
            <p class="people-picker__description">
              Find someone who shares a course with you.
            </p>

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

            <p
              v-if="peopleError"
              class="send-error"
              role="alert"
            >
              {{ peopleError }}
            </p>

            <p
              v-if="
                !loadingPeople &&
                !peopleError &&
                !peopleList.length
              "
              class="panel-hint"
            >
              {{
                peopleSearch.trim()
                  ? 'No people match your search.'
                  : 'No eligible people are available yet.'
              }}
            </p>

            <div
              v-if="!loadingPeople"
              class="people-list"
            >
              <button
                v-for="person in peopleList"
                :key="person.id"
                type="button"
                class="person"
                :disabled="startingDirect"
                @click="startDirect(person.id)"
              >
                <span class="avatar">
                  <img
                    v-if="person.avatar_url"
                    :src="person.avatar_url"
                    alt=""
                  />
                  <template v-else>
                    {{
                      initials(
                        `${person.first_name} ${person.last_name}`,
                      )
                    }}
                  </template>
                </span>

                <span class="person__details">
                  <strong>
                    {{ person.first_name }}
                    {{ person.last_name }}
                  </strong>
                  <span>Course member</span>
                </span>

                <ion-spinner
                  v-if="
                    startingDirect &&
                    startingPersonId === person.id
                  "
                  name="crescent"
                />
                <ion-icon
                  v-else
                  :icon="chevronForwardOutline"
                />
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
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import {
  addOutline,
  arrowBackOutline,
  arrowDownOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  chevronForwardOutline,
  closeOutline,
  refreshOutline,
  searchOutline,
  sendOutline,
} from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useAuthStore } from '@/stores/authStore';
import { useMessages } from '@/composables/useMessages';
import {
  listMessageablePeople,
  listMyConversations,
  openDirectConversation,
  type ConversationSummary,
  type PersonSummary,
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
  messages,
  messagesEl,
  typingUsers,
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
} = useMessages();

let active = false;
let conversationRequest = 0;
let peopleRequest = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const filteredConversations = computed(() => {
  const term =
    conversationSearch.value.trim().toLocaleLowerCase();

  return conversations.value.filter((conversation) =>
    conversationLabel(conversation)
      .toLocaleLowerCase()
      .includes(term),
  );
});

const selectedConversation = computed(() =>
  conversations.value.find(
    (conversation) => conversation.id === selectedId.value,
  ),
);

const selectedTitle = computed(() =>
  selectedConversation.value
    ? conversationLabel(selectedConversation.value)
    : 'Conversation',
);

const connectionLabel = computed(() => {
  if (connectionStatus.value === 'live') {
    return 'Live updates connected';
  }

  if (connectionStatus.value === 'connecting') {
    return 'Connecting…';
  }

  if (connectionStatus.value === 'error') {
    return 'Connection interrupted · tap reload';
  }

  return 'Conversation';
});

const typingLabel = computed(() => {
  const people = Object.values(typingUsers.value)
    .map((person) => person.name);

  if (!people.length) return '';

  return `${people.join(', ')} ${
    people.length === 1 ? 'is' : 'are'
  } typing…`;
});

function conversationLabel(
  conversation: ConversationSummary,
): string {
  return (
    conversation.title?.trim() ||
    (conversation.type === 'DIRECT'
      ? 'Direct message'
      : conversation.type === 'COURSE'
        ? 'Course conversation'
        : 'Group conversation')
  );
}

function typeLabel(
  type: ConversationSummary['type'],
): string {
  return {
    DIRECT: 'Direct message',
    COURSE: 'Course conversation',
    GROUP: 'Group conversation',
  }[type];
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'M'
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message);
  }

  return fallback;
}

async function loadConversations(
  showLoading = true,
): Promise<void> {
  const request = ++conversationRequest;

  if (showLoading) {
    loadingConversations.value = true;
  }

  conversationsError.value = null;

  try {
    const rows = await listMyConversations();

    if (!active || request !== conversationRequest) return;

    conversations.value = rows;
  } catch (error: unknown) {
    if (!active || request !== conversationRequest) return;

    if (showLoading) {
      conversationsError.value = getErrorMessage(
        error,
        'Unable to load conversations.',
      );
    }
  } finally {
    if (active && request === conversationRequest) {
      loadingConversations.value = false;
    }
  }
}

async function selectConversation(id: string): Promise<void> {
  if (
    selectedId.value === id &&
    connectionStatus.value !== 'idle'
  ) {
    return;
  }

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

    if (
      active &&
      selectedId.value === id &&
      draft.value === text
    ) {
      draft.value = '';
    }

    if (active) {
      void loadConversations(false);
    }
  } catch (error: unknown) {
    if (active && selectedId.value === id) {
      sendError.value = getErrorMessage(
        error,
        'Message could not be sent. Please try again.',
      );
    }
  } finally {
    sending.value = false;
  }
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing
  ) {
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
    const people = await listMessageablePeople(
      peopleSearch.value,
    );

    if (
      !active ||
      !showNewPicker.value ||
      request !== peopleRequest
    ) {
      return;
    }

    peopleList.value = people;
  } catch (error: unknown) {
    if (
      !active ||
      !showNewPicker.value ||
      request !== peopleRequest
    ) {
      return;
    }

    peopleError.value = getErrorMessage(
      error,
      'Unable to load people.',
    );
  } finally {
    if (request === peopleRequest) {
      loadingPeople.value = false;
    }
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

    if (active) {
      await selectConversation(id);
    }
  } catch (error: unknown) {
    if (active) {
      peopleError.value = getErrorMessage(
        error,
        'Unable to start the conversation.',
      );
    }
  } finally {
    startingDirect.value = false;
    startingPersonId.value = null;
  }
}

function queryConversationId(): string | null {
  const value =
    route.query.c ?? route.query.conversation;

  return typeof value === 'string' ? value : null;
}

async function openQueryConversation(): Promise<void> {
  const id = queryConversationId();

  if (
    id &&
    conversations.value.some(
      (conversation) => conversation.id === id,
    )
  ) {
    await selectConversation(id);
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConversationDate(value: string): string {
  const date = new Date(value);

  if (date.toDateString() === new Date().toDateString()) {
    return formatTime(value);
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatMessageDate(value: string): string {
  const date = new Date(value);

  if (date.toDateString() === new Date().toDateString()) {
    return 'Today';
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function showDateSeparator(index: number): boolean {
  const current = messages.value[index];
  const previous = messages.value[index - 1];

  if (!current) return false;
  if (!previous) return true;

  return (
    new Date(current.created_at).toDateString() !==
    new Date(previous.created_at).toDateString()
  );
}

function handleFocus(): void {
  if (
    active &&
    selectedId.value &&
    !document.hidden &&
    isNearBottom()
  ) {
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
  document.removeEventListener(
    'visibilitychange',
    handleFocus,
  );
}

watch(peopleSearch, () => {
  clearTimeout(searchTimer);
  peopleRequest++;

  if (!showNewPicker.value) return;

  loadingPeople.value = true;

  searchTimer = setTimeout(() => {
    void loadPeople();
  }, 300);
});

watch(
  () => [route.query.c, route.query.conversation],
  () => {
    if (active) {
      void openQueryConversation();
    }
  },
);

watch(
  () => messages.value.length,
  async () => {
    await nextTick();

    if (active) {
      handleMessagesScroll();
    }
  },
);

onIonViewDidEnter(async () => {
  active = true;

  window.addEventListener('focus', handleFocus);
  document.addEventListener(
    'visibilitychange',
    handleFocus,
  );

  await loadConversations();

  if (!active) return;

  if (queryConversationId()) {
    await openQueryConversation();
  } else if (
    selectedId.value &&
    conversations.value.some(
      (conversation) =>
        conversation.id === selectedId.value,
    )
  ) {
    await reopen();
  }
});

onIonViewWillLeave(deactivate);
onBeforeUnmount(deactivate);
</script>

<style scoped>
.messages-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1440px;
  height: 100%;
  min-height: 0;
  margin-inline: auto;
  padding: var(--plumi-page-padding, 24px);
  color: var(--plumi-ink, #202336);
}

.messages-page :deep(.page-header) {
  flex-shrink: 0;
  margin-bottom: 20px;
}

.new-message-button {
  --border-radius: 12px;
  --box-shadow: none;
  text-transform: none;
  font-weight: 600;
}

.messenger {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 20px;
  background: var(--plumi-surface, #fff);
  box-shadow: 0 8px 32px rgb(20 25 55 / 4%);
}

.conversation-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--plumi-border, #e5e7ef);
}

.conversation-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 18px 16px;
}

.conversation-panel__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.conversation-panel__header p {
  margin: 5px 0 0;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 12px;
}

.icon-button {
  display: inline-grid;
  flex: 0 0 36px;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 10px;
  background: var(--plumi-surface, #fff);
  color: var(--plumi-text-muted, #767b8d);
  cursor: pointer;
}

.icon-button ion-icon {
  font-size: 18px;
}

.icon-button:hover {
  color: var(--plumi-primary, #6d5dfc);
  background: var(--plumi-primary-soft, #f0edff);
}

.conversation-search {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 14px 14px;
  padding: 0 12px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 12px;
  background: var(--plumi-surface-muted, #f7f8fc);
  color: var(--plumi-text-muted, #767b8d);
}

.conversation-search input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--plumi-ink, #202336);
  font: inherit;
  font-size: 13px;
}

.conversation-search:focus-within {
  border-color: var(--plumi-primary, #6d5dfc);
}

.conversation-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.conversation {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 14px 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.conversation:hover {
  background: var(--plumi-surface-muted, #f7f8fc);
}

.conversation--active {
  background: var(--plumi-primary-soft, #f0edff);
}

.avatar {
  display: grid;
  flex: 0 0 42px;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--plumi-primary-soft, #f0edff);
  color: var(--plumi-primary, #6d5dfc);
  font-size: 13px;
  font-weight: 700;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conversation__body {
  flex: 1;
  min-width: 0;
}

.conversation__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conversation__heading strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation__heading time {
  flex-shrink: 0;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 10px;
}

.conversation__type {
  display: block;
  margin-top: 6px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 11px;
}

.conversation__arrow {
  flex-shrink: 0;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 14px;
}

.panel-hint {
  margin: 0;
  padding: 28px 18px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}

.chat-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.chat-placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.chat-placeholder__icon {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  margin-bottom: 22px;
  border-radius: 28px;
  background: var(--plumi-primary-soft, #f0edff);
  color: var(--plumi-primary, #6d5dfc);
}

.chat-placeholder__icon ion-icon {
  font-size: 38px;
}

.chat-placeholder h2 {
  margin: 0;
  font-size: 21px;
}

.chat-placeholder p {
  max-width: 350px;
  margin: 12px 0 22px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 14px;
  line-height: 1.7;
}

.chat-placeholder ion-button {
  --border-radius: 12px;
  --box-shadow: none;
  text-transform: none;
}

.chat-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  min-height: 82px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--plumi-border, #e5e7ef);
}

.chat-header__back {
  display: none;
}

.chat-header__details {
  flex: 1;
  min-width: 0;
}

.chat-header__details h2 {
  overflow: hidden;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 11px;
}

.connection-status > span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a3a7b5;
}

.connection-status--live > span {
  background: #2bb783;
}

.chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 22px;
  background: var(--plumi-bg, #f8f9fd);
}

.empty-chat {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--plumi-text-muted, #767b8d);
  text-align: center;
}

.empty-chat > ion-icon {
  font-size: 36px;
}

.empty-chat h3 {
  margin: 14px 0 0;
  color: var(--plumi-ink, #202336);
  font-size: 16px;
}

.empty-chat p {
  margin-top: 8px;
  font-size: 13px;
}

.date-separator {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.date-separator span {
  padding: 6px 12px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 999px;
  background: var(--plumi-surface, #fff);
  color: var(--plumi-text-muted, #767b8d);
  font-size: 10px;
}

.message {
  display: flex;
  align-items: flex-end;
  align-self: flex-start;
  gap: 9px;
  max-width: 80%;
}

.message--mine {
  align-self: flex-end;
}

.message__avatar {
  display: grid;
  flex: 0 0 28px;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 20px;
  border-radius: 10px;
  background: var(--plumi-primary-soft, #f0edff);
  color: var(--plumi-primary, #6d5dfc);
  font-size: 9px;
  font-weight: 700;
}

.message__body {
  min-width: 0;
}

.message__author {
  display: block;
  margin: 0 0 6px 2px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 10px;
  font-weight: 600;
}

.message__bubble {
  padding: 12px 15px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 16px 16px 16px 4px;
  background: var(--plumi-surface, #fff);
}

.message--mine .message__bubble {
  border-color: transparent;
  border-radius: 16px 16px 4px 16px;
  background: var(--plumi-primary, #6d5dfc);
  color: #fff;
}

.message__bubble p {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.message__meta {
  display: flex;
  gap: 7px;
  margin-top: 5px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 9px;
}

.message--mine .message__meta {
  justify-content: flex-end;
}

.typing-status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 22px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 11px;
}

.typing-dots {
  display: inline-flex;
  gap: 3px;
}

.typing-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--plumi-primary, #6d5dfc);
}

.composer {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  gap: 10px;
  margin: 0 18px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 14px;
  background: var(--plumi-surface-muted, #f7f8fc);
}

.composer:focus-within {
  border-color: var(--plumi-primary, #6d5dfc);
}

.composer__input {
  display: block;
  flex: 1;
  min-width: 0;
  max-height: 150px;
  padding: 6px 0;
  border: 0;
  outline: 0;
  resize: vertical;
  background: transparent;
  color: var(--plumi-ink, #202336);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
}

.composer__send {
  --border-radius: 10px;
  --box-shadow: none;
  width: 42px;
  height: 42px;
  margin: 0;
}

.composer__send ion-spinner {
  width: 18px;
  height: 18px;
}

.composer-hint {
  flex-shrink: 0;
  margin: 9px 18px 14px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 10px;
  text-align: center;
}

.send-error {
  margin: 0;
  padding: 10px 20px;
  color: var(--plumi-danger, #c83f56);
  font-size: 12px;
  line-height: 1.5;
}

.latest-button {
  position: absolute;
  right: 20px;
  bottom: 160px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 999px;
  background: var(--plumi-surface, #fff);
  color: var(--plumi-primary, #6d5dfc);
  box-shadow: 0 4px 16px rgb(20 25 55 / 10%);
  cursor: pointer;
  font-size: 11px;
}

.people-modal {
  --width: 520px;
  --height: 620px;
  --max-height: 90%;
  --border-radius: 20px;
}

.people-modal ion-toolbar {
  --background: var(--plumi-surface, #fff);
  --color: var(--plumi-ink, #202336);
  --padding-top: 8px;
  --padding-bottom: 8px;
}

.people-modal ion-content {
  --background: var(--plumi-surface, #fff);
}

.people-picker {
  padding: 8px 16px 24px;
}

.people-picker__description {
  margin: 4px 0 18px;
  color: var(--plumi-text-muted, #767b8d);
  font-size: 13px;
  line-height: 1.6;
}

.people-picker .conversation-search {
  margin-inline: 0;
}

.people-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.person {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--plumi-ink, #202336);
  text-align: left;
  cursor: pointer;
}

.person:hover {
  background: var(--plumi-surface-muted, #f7f8fc);
}

.person:disabled {
  cursor: wait;
  opacity: 0.65;
}

.person__details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.person__details strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person__details > span {
  color: var(--plumi-text-muted, #767b8d);
  font-size: 11px;
}

.person > ion-icon {
  color: var(--plumi-text-muted, #767b8d);
}

.person > ion-spinner {
  width: 20px;
  height: 20px;
}

button:focus-visible {
  outline: 2px solid var(--plumi-primary, #6d5dfc);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .messages-page {
    padding: 14px;
  }

  .messages-page :deep(.page-header) {
    gap: 10px;
    margin-bottom: 14px;
  }

  .messages-page :deep(.page-header__title) {
    font-size: 24px;
  }

  .messages-page :deep(.page-header__subtitle) {
    max-width: 190px;
    font-size: 11px;
    line-height: 1.5;
  }

  .new-message-button {
    font-size: 11px;
  }

  .messenger {
    display: flex;
    flex-direction: column;
    border-radius: 16px;
  }

  .conversation-panel {
    flex: 1;
    border-right: 0;
  }

  .chat-panel {
    display: none;
  }

  .messenger--chat-open .conversation-panel {
    display: none;
  }

  .messenger--chat-open .chat-panel {
    display: flex;
    flex: 1;
  }

  .chat-header {
    gap: 9px;
    min-height: 72px;
    padding: 12px;
  }

  .chat-header__back {
    display: inline-grid;
  }

  .chat-header .avatar {
    flex-basis: 34px;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    font-size: 11px;
  }

  .chat-header__details h2 {
    font-size: 13px;
  }

  .connection-status {
    font-size: 9px;
  }

  .chat-messages {
    gap: 12px;
    padding: 14px;
  }

  .message {
    max-width: 92%;
  }

  .message__bubble {
    padding: 10px 12px;
  }

  .composer {
    margin-inline: 10px;
  }

  .composer__input {
    font-size: 16px;
  }

  .composer-hint {
    margin-bottom: max(
      12px,
      env(safe-area-inset-bottom)
    );
    font-size: 9px;
  }

  .typing-status {
    padding-inline: 14px;
  }

  .people-modal {
    --width: 100%;
    --height: 100%;
    --max-height: 100%;
    --border-radius: 0;
  }
}

.messages-page { padding:var(--plumi-page-padding); }
.messages-page :deep(.page-header) { margin-bottom:16px; }
.messenger { border-radius:24px; box-shadow:var(--plumi-shadow-card); }
.conversation-panel__header { padding:24px 20px 20px; }
.conversation { min-height:82px; padding:16px 12px; border-radius:16px; }
.chat-header { min-height:86px; padding:18px 24px; }
.chat-messages { padding:24px; }
.message__bubble { padding:12px 16px; }
.composer { margin-inline:20px; border-radius:16px; }
.composer__send { min-height:44px; }
@media(max-width:767px) {
 .messages-page { padding:16px 12px 10px; }
 .messages-page :deep(.page-header) { flex-direction:row; gap:10px; align-items:center; margin-bottom:14px; padding-bottom:0; }
 .messages-page :deep(.page-header__actions) { width:auto; flex-shrink:0; }
 .messages-page :deep(.page-header__subtitle) { display:none; }
 .messages-page :deep(.page-header__title) { font-size:22px; }
 .messenger { border-radius:18px; }
 .chat-header { min-height:70px; padding:12px; }
 .chat-messages { padding:16px 12px; }
 .composer { margin-inline:10px; }
 .composer__input { resize:none; }
 .composer-hint { display:none; }
 .composer { margin-bottom:max(10px,env(safe-area-inset-bottom)); }
}
</style>