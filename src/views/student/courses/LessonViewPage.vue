<!-- src/views/student/courses/LessonViewPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else-if="lesson">
          <h1 class="lesson-view__title">{{ lesson.title }}</h1>
          <div v-if="lesson.video_url" class="lesson-view__video">
            <iframe :src="lesson.video_url" allowfullscreen frameborder="0" />
          </div>
          <div v-if="lesson.content" class="lesson-view__content" v-html="lesson.content" />
          <p v-else class="lesson-view__empty">No written content for this lesson.</p>

          <div v-if="enrollmentId" class="lesson-view__complete">
            <ion-button :color="completed ? 'success' : 'primary'" :disabled="marking" @click="toggleComplete">
              <ion-icon slot="start" :icon="completed ? checkmarkDoneOutline : checkmarkOutline" />
              {{ completed ? 'Completed' : 'Mark as complete' }}
            </ion-button>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline, checkmarkOutline, checkmarkDoneOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { markLessonProgress, getCourseProgress } from '@/services/progress';
import type { Lesson } from '@/types/app';

const route = useRoute();
const auth = useAuthStore();
const courseId = route.params.courseId as string;
const lessonId = route.params.lessonId as string;

const lesson = ref<Lesson | null>(null);
const enrollmentId = ref<string | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const completed = ref(false);
const marking = ref(false);

async function load() {
  error.value = null;
  try {
    const [lessonRes, enrollRes] = await Promise.all([
      supabase.from('lessons').select('*').eq('id', lessonId).single(),
      supabase.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', auth.user!.id).maybeSingle(),
    ]);
    if (lessonRes.error) throw lessonRes.error;
    lesson.value = lessonRes.data;
    enrollmentId.value = enrollRes.data?.id ?? null;
    if (enrollmentId.value) {
      const prog = await getCourseProgress(courseId);
      completed.value = prog.rows.find((r) => r.lesson_id === lessonId)?.status === 'COMPLETED';
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function toggleComplete() {
  if (!enrollmentId.value) return;
  marking.value = true;
  try {
    await markLessonProgress({
      courseId, lessonId, enrollmentId: enrollmentId.value,
      status: completed.value ? 'IN_PROGRESS' : 'COMPLETED',
    });
    completed.value = !completed.value;
  } finally { marking.value = false; }
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 820px; }
.lesson-view__title { margin: 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.lesson-view__video { aspect-ratio: 16 / 9; border-radius: var(--plumi-radius-lg); overflow: hidden; background: black; }
.lesson-view__video iframe { width: 100%; height: 100%; border: 0; }
.lesson-view__content { line-height: 1.7; color: var(--plumi-ink); }
.lesson-view__empty { color: var(--plumi-text-muted); }
.lesson-view__complete { display: flex; justify-content: center; padding: var(--size-4, 1rem) 0; }

.lesson-view__content { min-width:0; overflow-wrap:anywhere; line-height:1.65; }
.lesson-view__content { padding:var(--plumi-panel-padding); border:1px solid var(--plumi-border); border-radius:20px; background:var(--plumi-surface); }
.lesson-view__content :deep(img) { max-width:100%; height:auto; }
</style>