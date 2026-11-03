<!-- src/views/instructor/meetings/MeetingSchedulerPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>
        <h1 class="scheduler__title">Schedule Meeting</h1>

        <LoadingState v-if="loadingCourse" />
        <ErrorState v-else-if="loadError" :message="loadError" @retry="verifyAccess" />

        <form v-else class="scheduler__form" @submit.prevent="save">
          <ion-input v-model="form.title" label="Title *" label-placement="stacked"
            required maxlength="200" :counter="true" />
          <ion-textarea v-model="form.description" label="Description"
            label-placement="stacked" :rows="3" :auto-grow="true" maxlength="1000" />
          <ion-input v-model="form.scheduledAt" type="datetime-local"
            label="Scheduled at *" label-placement="stacked" required />
          <ion-input v-model.number="form.duration" type="number"
            label="Duration (minutes)" label-placement="stacked" :min="15" :step="15" required />

          <div class="scheduler__actions">
            <ion-button fill="clear" type="button" @click="$router.back()">Cancel</ion-button>
            <ion-button type="submit" :disabled="saving">{{ saving ? 'Scheduling…' : 'Schedule' }}</ion-button>
          </div>
          <p v-if="saveError" class="scheduler__error">{{ saveError }}</p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonButton, IonIcon, IonInput, IonTextarea,
} from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { getCourse } from '@/services/courses';
import { createMeeting } from '@/services/meetings';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const courseId = route.params.id as string;

const loadingCourse = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);

const form = ref({ title: '', description: '', scheduledAt: '', duration: 60 });

async function verifyAccess() {
  loadingCourse.value = true;
  loadError.value = null;
  try {
    const course = await getCourse(courseId);
    if (course.instructor_id !== auth.user?.id) {
      throw new Error('You do not have permission to schedule meetings for this course.');
    }
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load course.';
  } finally {
    loadingCourse.value = false;
  }
}

async function save() {
  if (!form.value.title.trim() || !form.value.scheduledAt) return;
  saving.value = true;
  saveError.value = null;
  try {
    await createMeeting({
      course_id: courseId,
      title: form.value.title.trim(),
      description: form.value.description.trim() || null,
      scheduled_at: new Date(form.value.scheduledAt).toISOString(),
      duration: form.value.duration,
    });
    router.push({ name: 'meetings' });
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to schedule.';
  } finally {
    saving.value = false;
  }
}

onMounted(verifyAccess);
</script>

<style scoped>
.page-shell--narrow { max-width: 560px; }
.scheduler__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.scheduler__form { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.scheduler__actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
.scheduler__error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }
</style>