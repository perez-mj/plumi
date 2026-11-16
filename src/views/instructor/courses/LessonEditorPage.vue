<!-- src/views/instructor/courses/LessonEditorPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="goBack">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back to content
        </ion-button>

        <PageHeader :title="isEdit ? 'Edit Lesson' : 'New Lesson'" :subtitle="courseTitle">
          <template #actions>
            <ion-button fill="outline" :disabled="saving" @click="goBack">Cancel</ion-button>
            <ion-button :disabled="saving || !canSave" @click="save">
              {{ saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Lesson' }}
            </ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <div class="lesson-editor__meta">
            <label class="lesson-editor__field">
              <span>Title</span>
              <input v-model="form.title" placeholder="Lesson title" />
            </label>
            <label class="lesson-editor__field">
              <span>Video URL (optional)</span>
              <input v-model="form.video_url" placeholder="https://…" />
            </label>
            <label class="lesson-editor__field lesson-editor__field--inline">
              <input v-model="form.is_published" type="checkbox" />
              <span>Published</span>
            </label>
          </div>

          <MarkdownEditor v-model="form.content" />
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
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import MarkdownEditor from '@/components/instructor/MarkdownEditor.vue';
import { getLesson, createLesson, updateLesson } from '@/services/content';
import { getCourse } from '@/services/courses';

const route = useRoute();
const router = useRouter();

const courseId = route.params.id as string;
const lessonId = (route.params.lessonId as string | undefined) || null;
const moduleId = (route.query.moduleId as string | undefined) || null;
const isEdit = computed(() => Boolean(lessonId));

const courseTitle = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const form = ref({
  title: '',
  content: '',
  video_url: '',
  is_published: false,
});

const canSave = computed(() => form.value.title.trim().length > 0);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const c = await getCourse(courseId);
    courseTitle.value = c.title;

    if (lessonId) {
      const lesson = await getLesson(lessonId);
      form.value = {
        title: lesson.title,
        content: lesson.content ?? '',
        video_url: lesson.video_url ?? '',
        is_published: lesson.is_published,
      };
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load lesson.';
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      title: form.value.title.trim(),
      content: form.value.content.trim() || null,
      video_url: form.value.video_url.trim() || null,
      is_published: form.value.is_published,
    };
    if (isEdit.value && lessonId) {
      await updateLesson(lessonId, payload);
    } else {
      if (!moduleId) throw new Error('Missing module for new lesson.');
      await createLesson({ course_id: courseId, module_id: moduleId, ...payload, position: 0 });
    }
    router.push({ name: 'instructor-course-content', params: { id: courseId } });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: 'instructor-course-content', params: { id: courseId } });
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 1100px; }
.lesson-editor__meta { display: grid; gap: 16px; grid-template-columns: 1fr; }
.lesson-editor__field { display: flex; flex-direction: column; gap: 6px; font-size: var(--plumi-text-sm); font-weight: 600; }
.lesson-editor__field input { min-height: 46px; padding: 12px 14px; border: 1px solid var(--plumi-border-strong); border-radius: 12px; background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.lesson-editor__field--inline { flex-direction: row; align-items: center; gap: 8px; }
.lesson-editor__field--inline input { min-height: 0; width: 18px; height: 18px; padding: 0; }
@media (min-width: 720px) {
  .lesson-editor__meta { grid-template-columns: 2fr 2fr auto; align-items: end; }
}
</style>