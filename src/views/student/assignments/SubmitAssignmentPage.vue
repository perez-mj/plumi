<!-- src/views/student/assignments/SubmitAssignmentPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else-if="assignment">
          <header>
            <h1 class="submit-asg__title">{{ assignment.title }}</h1>
            <p class="submit-asg__meta">
              {{ assignment.due_at ? `Due ${formatDate(assignment.due_at)}` : 'No deadline' }} · {{ assignment.max_score }} points
            </p>
          </header>

          <section v-if="assignment.instructions" class="panel">
            <h2 class="panel__title">Instructions</h2>
            <p class="instructions">{{ assignment.instructions }}</p>
          </section>

          <section v-if="mySubmission && mySubmission.score != null" class="panel">
            <h2 class="panel__title">Your Grade</h2>
            <p class="grade">{{ mySubmission.score }} / {{ assignment.max_score }}</p>
            <p v-if="mySubmission.feedback" class="feedback">{{ mySubmission.feedback }}</p>
          </section>

          <section class="panel">
            <h2 class="panel__title">Your Submission</h2>
            <p v-if="mySubmission" class="submitted-meta">
              Submitted {{ formatDate(mySubmission.submitted_at) }} · {{ mySubmission.status }}
            </p>
            <textarea v-model="content" rows="6" placeholder="Write your answer here…" class="textarea" />
            <input type="file" multiple @change="onFileChange" class="file-input" />
            <div class="actions">
              <ion-button :disabled="submitting" @click="submit">
                {{ submitting ? 'Submitting…' : mySubmission ? 'Resubmit' : 'Submit' }}
              </ion-button>
            </div>
            <p v-if="submitError" class="error">{{ submitError }}</p>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { getAssignment, getMySubmission, submitAssignment } from '@/services/assignments';
import type { Assignment, Submission } from '@/types/app';

const route = useRoute();
const assignmentId = route.params.id as string;

const assignment = ref<Assignment | null>(null);
const mySubmission = ref<Submission | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const content = ref('');
const files = ref<File[]>([]);
const submitting = ref(false);
const submitError = ref<string | null>(null);

function onFileChange(e: Event) {
  files.value = Array.from((e.target as HTMLInputElement).files ?? []);
}

async function load() {
  error.value = null;
  try {
    assignment.value = await getAssignment(assignmentId);
    mySubmission.value = await getMySubmission(assignmentId);
    if (mySubmission.value?.content) content.value = mySubmission.value.content;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function submit() {
  submitting.value = true;
  submitError.value = null;
  try {
    await submitAssignment({ assignmentId, content: content.value || null, files: files.value });
    await load();
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : 'Failed to submit.';
  } finally { submitting.value = false; }
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 820px; }
.submit-asg__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.submit-asg__meta { margin: 4px 0 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.panel__title { margin: 0 0 var(--size-3, 0.75rem); font-size: var(--plumi-text-md); }
.instructions { margin: 0; white-space: pre-line; font-size: var(--plumi-text-sm); line-height: 1.7; }
.grade { font-size: var(--plumi-text-xl); font-weight: var(--plumi-weight-bold); color: var(--plumi-success); margin: 0 0 var(--size-2, 0.5rem); }
.feedback { padding: var(--size-2, 0.5rem); background: var(--plumi-success-soft); border-radius: var(--plumi-radius-sm); margin: 0; }
.submitted-meta { margin: 0 0 var(--size-2, 0.5rem); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.textarea { width: 100%; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.file-input { display: block; margin: var(--size-2, 0.5rem) 0; }
.actions { display: flex; justify-content: flex-end; }
.error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: var(--size-2, 0.5rem) 0 0; }

.panel { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.actions { gap:10px; flex-wrap:wrap; }
.feedback, .instructions, .submit-asg__meta { min-width:0; overflow-wrap:anywhere; line-height:1.65; }
@media(max-width:600px) { .actions > ion-button { flex:1 1 auto; min-height:44px; } }
</style>