<!-- src/views/instructor/assignments/AssignmentEditorPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <h1 class="asg-editor__title">{{ isEdit ? 'Edit Assignment' : 'New Assignment' }}</h1>

          <form class="asg-editor__form" @submit.prevent="save">
            <label>Title * <input v-model="form.title" required maxlength="200" /></label>
            <label>Instructions <textarea v-model="form.instructions" rows="5" maxlength="5000" /></label>
            <div class="asg-editor__row">
              <label>Due date <input v-model="form.dueAt" type="datetime-local" /></label>
              <label>Max score <input v-model.number="form.maxScore" type="number" min="1" /></label>
            </div>
            <label class="asg-editor__check"><input v-model="form.allowLate" type="checkbox" /> Allow late submissions</label>
            <label class="asg-editor__check"><input v-model="form.published" type="checkbox" /> Publish immediately</label>
            <div class="asg-editor__actions">
              <ion-button fill="clear" type="button" @click="$router.back()">Cancel</ion-button>
              <ion-button type="submit" :disabled="saving">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create' }}</ion-button>
            </div>
            <p v-if="saveError" class="asg-editor__error">{{ saveError }}</p>
          </form>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { createAssignment, getAssignment, updateAssignment } from '@/services/assignments';

const route = useRoute();
const router = useRouter();
const courseId = computed(() => route.params.courseId as string);
const assignmentId = computed(() => (route.params.id as string) || null);
const isEdit = computed(() => !!assignmentId.value);

const loading = ref(isEdit.value);
const error = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);

const form = ref({
  title: '', instructions: '', dueAt: '', maxScore: 100,
  allowLate: false, published: false,
});

async function load() {
  if (!assignmentId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const a = await getAssignment(assignmentId.value);
    form.value = {
      title: a.title,
      instructions: a.instructions ?? '',
      dueAt: a.due_at ? new Date(a.due_at).toISOString().slice(0, 16) : '',
      maxScore: a.max_score,
      allowLate: a.allow_late,
      published: a.is_published,
    };
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function save() {
  saving.value = true;
  saveError.value = null;
  try {
    const payload = {
      title: form.value.title.trim(),
      instructions: form.value.instructions.trim() || null,
      due_at: form.value.dueAt ? new Date(form.value.dueAt).toISOString() : null,
      max_score: form.value.maxScore,
      allow_late: form.value.allowLate,
      is_published: form.value.published,
    };
    if (assignmentId.value) {
      await updateAssignment(assignmentId.value, payload);
    } else {
      await createAssignment({ ...payload, course_id: courseId.value });
    }
    router.push({ name: 'instructor-assignments', params: { id: courseId.value } });
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save.';
  } finally { saving.value = false; }
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 720px; }
.asg-editor__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.asg-editor__form { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.asg-editor__form label { display: flex; flex-direction: column; gap: var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.asg-editor__form input, .asg-editor__form textarea { padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.asg-editor__row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--size-3, 0.75rem); }
.asg-editor__check { flex-direction: row !important; align-items: center; gap: var(--size-2, 0.5rem) !important; }
.asg-editor__actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); margin-top: var(--size-2, 0.5rem); }
.asg-editor__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }
</style>