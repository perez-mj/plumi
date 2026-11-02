<!-- src/views/instructor/assignments/SubmissionReviewPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else-if="assignment">
          <PageHeader :title="assignment.title" :subtitle="`${submissions.length} submissions · ${assignment.max_score} pts`" />

          <EmptyState v-if="!submissions.length" title="No submissions" message="Students haven't submitted anything yet." :icon="documentTextOutline" />
          <ul v-else class="sub-list">
            <li v-for="s in submissions" :key="s.id" class="sub-card">
              <header class="sub-card__head">
                <div>
                  <p class="sub-card__name">{{ s.student.first_name }} {{ s.student.last_name }}</p>
                  <p class="sub-card__email">{{ s.student.email }}</p>
                </div>
                <span class="sub-card__status">{{ s.status }}</span>
              </header>
              <p v-if="s.content" class="sub-card__content">{{ s.content }}</p>
              <div v-if="s.score != null" class="sub-card__grade">
                <strong>Score:</strong> {{ s.score }} / {{ assignment.max_score }}
                <span v-if="s.feedback">— {{ s.feedback }}</span>
              </div>
              <div v-else class="sub-card__form">
                <input v-model.number="drafts[s.id].score" type="number" min="0" :max="assignment.max_score" placeholder="Score" />
                <input v-model="drafts[s.id].feedback" placeholder="Feedback" />
                <ion-button size="small" @click="grade(s.id)">Grade</ion-button>
              </div>
            </li>
          </ul>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
} from '@ionic/vue';
import { arrowBackOutline, documentTextOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { getAssignment, listSubmissionsForAssignment, gradeSubmission } from '@/services/assignments';
import type { Assignment, Submission } from '@/types/app';

interface SubWithStudent extends Submission {
  student: { id: string; first_name: string; last_name: string; email: string; avatar_url: string | null };
}

const route = useRoute();
const assignmentId = route.params.id as string;

const assignment = ref<Assignment | null>(null);
const submissions = ref<SubWithStudent[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const drafts = reactive<Record<string, { score: number | null; feedback: string }>>({});

async function load() {
  error.value = null;
  try {
    const [a, subs] = await Promise.all([
      getAssignment(assignmentId),
      listSubmissionsForAssignment(assignmentId),
    ]);
    assignment.value = a;
    submissions.value = subs as SubWithStudent[];
    subs.forEach((s: { id: string; score: number | null; feedback: string | null }) => {
      drafts[s.id] = { score: s.score, feedback: s.feedback ?? '' };
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function grade(id: string) {
  const d = drafts[id];
  if (d.score == null) return;
  await gradeSubmission({ submissionId: id, score: d.score, feedback: d.feedback || null });
  await load();
}

onMounted(load);
</script>

<style scoped>
.sub-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.sub-card { padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.sub-card__head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--size-2, 0.5rem); }
.sub-card__name { margin: 0; font-weight: var(--plumi-weight-semibold); font-size: var(--plumi-text-sm); }
.sub-card__email { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.sub-card__status { padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-info-soft); color: var(--plumi-info); font-size: var(--plumi-text-xs); }
.sub-card__content { padding: var(--size-2, 0.5rem); background: var(--plumi-surface-muted); border-radius: var(--plumi-radius-sm); margin: 0 0 var(--size-2, 0.5rem); font-size: var(--plumi-text-sm); white-space: pre-line; }
.sub-card__grade { font-size: var(--plumi-text-sm); color: var(--plumi-success); }
.sub-card__form { display: flex; gap: var(--size-2, 0.5rem); flex-wrap: wrap; align-items: center; }
.sub-card__form input { padding: var(--size-1, 0.25rem) var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-sm); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
</style>