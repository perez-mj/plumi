<!-- src/views/admin/AnnouncementsPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Announcements" subtitle="System and course announcements">
          <template #actions>
            <ion-button size="small" @click="showCreate = true">
              <ion-icon slot="start" :icon="addOutline" /> New
            </ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!items.length" title="No announcements" message="Post a system or course announcement." :icon="megaphoneOutline" />

        <ul v-else class="ann-list">
          <li v-for="a in items" :key="a.id" class="ann-row">
            <div class="ann-row__head">
              <h3>{{ a.title }}</h3>
              <span class="ann-row__scope">{{ a.scope }}</span>
            </div>
            <p class="ann-row__content">{{ a.content }}</p>
            <div class="ann-row__foot">
              <p class="ann-row__meta">{{ new Date(a.created_at).toLocaleString() }}</p>
              <ion-button size="small" fill="clear" color="danger" @click="remove(a.id)">Delete</ion-button>
            </div>
          </li>
        </ul>
      </div>

      <ion-modal :is-open="showCreate" @didDismiss="showCreate = false">
        <ion-content class="modal-content">
          <div class="modal-inner">
            <h2>New announcement</h2>
            <input v-model="draft.title" placeholder="Title" class="modal-input" />
            <textarea v-model="draft.content" placeholder="Content" rows="4" class="modal-input" />
            <div class="modal-actions">
              <ion-button fill="clear" @click="showCreate = false">Cancel</ion-button>
              <ion-button :disabled="posting" @click="post">{{ posting ? 'Posting…' : 'Post' }}</ion-button>
            </div>
            <p v-if="postError" class="modal-error">{{ postError }}</p>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon, IonModal,
} from '@ionic/vue';
import { addOutline, megaphoneOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '@/services/announcements';
import type { Announcement } from '@/types/app';

const items = ref<Announcement[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showCreate = ref(false);
const posting = ref(false);
const postError = ref<string | null>(null);
const draft = ref({ title: '', content: '' });

async function load() {
  error.value = null;
  try { items.value = await listAnnouncements(null); }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Failed to load.'; }
  finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function post() {
  posting.value = true;
  postError.value = null;
  try {
    await createAnnouncement({
      title: draft.value.title.trim(),
      content: draft.value.content.trim(),
      scope: 'SYSTEM',
    });
    showCreate.value = false;
    draft.value = { title: '', content: '' };
    await load();
  } catch (e: unknown) {
    postError.value = e instanceof Error ? e.message : 'Failed to post.';
  } finally { posting.value = false; }
}

async function remove(id: string) {
  if (!confirm('Delete this announcement?')) return;
  await deleteAnnouncement(id);
  await load();
}

onMounted(load);
</script>

<style scoped>
.ann-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.ann-row { padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.ann-row__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--size-2, 0.5rem); }
.ann-row__head h3 { margin: 0; font-size: var(--plumi-text-md); }
.ann-row__scope { font-size: var(--plumi-text-xs); padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-primary-soft); color: var(--plumi-primary); }
.ann-row__content { margin: 0 0 var(--size-2, 0.5rem); font-size: var(--plumi-text-sm); white-space: pre-line; }
.ann-row__foot { display: flex; justify-content: space-between; align-items: center; }
.ann-row__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.modal-content { --background: var(--plumi-surface); }
.modal-inner { padding: var(--size-5, 1.25rem); max-width: 520px; margin-inline: auto; display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.modal-inner h2 { margin: 0; }
.modal-input { width: 100%; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
.modal-error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }

.ann-row { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.ann-row__foot, .ann-row__head { gap:14px; flex-wrap:wrap; }
.modal-actions { gap:10px; flex-wrap:wrap; }
.ann-row__content, .ann-row__meta { min-width:0; overflow-wrap:anywhere; line-height:1.65; }
@media(max-width:600px) { .modal-actions > ion-button { flex:1 1 auto; min-height:44px; } }
</style>