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

          <div v-if="embedUrl" class="lesson-view__video">
            <iframe :src="embedUrl" referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowfullscreen loading="lazy" frameborder="0" />
          </div>

          <div class="lesson-view__content">
            <MarkdownContent :source="lesson.content" empty-text="No written content for this lesson." />
          </div>

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
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import {
  arrowBackOutline,
  checkmarkOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import MarkdownContent from '@/components/common/MarkdownContent.vue';
import { supabase } from '@/lib/supabase';
import { getMyEnrollmentForCourse } from '@/services/enrollments';
import { getLessonProgress, markLessonProgress } from '@/services/progress';
import { isSafeEmbedUrl, normalizeEmbedUrl } from '@/lib/safeUrl';
import type { Lesson } from '@/types/app';

const route = useRoute();
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
  loading.value = true;
  try {
    const [lessonRes, enr, prog] = await Promise.all([
      supabase.from('lessons').select('*').eq('id', lessonId).single(),
      getMyEnrollmentForCourse(courseId),
      getLessonProgress(courseId, lessonId),
    ]);
    if (lessonRes.error) throw lessonRes.error;
    lesson.value = lessonRes.data;
    enrollmentId.value = enr?.status === 'ACTIVE' ? enr.id : null;
    completed.value = prog?.status === 'COMPLETED';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
}

async function toggleComplete() {
  if (!enrollmentId.value) return;
  marking.value = true;
  try {
    await markLessonProgress({
      courseId,
      lessonId,
      enrollmentId: enrollmentId.value,
      status: completed.value ? 'IN_PROGRESS' : 'COMPLETED',
    });
    completed.value = !completed.value;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to update progress.';
  } finally {
    marking.value = false;
  }
}

const embedUrl = computed(() => {
  const raw = lesson.value?.video_url;
  if (!raw) return null;
  const normalized = normalizeEmbedUrl(raw);
  return normalized && isSafeEmbedUrl(normalized) ? normalized : null;
});

onMounted(load);
</script>

<style scoped>
.page-shell--narrow {
  max-width: 820px;
}

.lesson-view__title {
  margin: 0 0 var(--size-3, 0.75rem);
  font-size: var(--plumi-text-2xl);
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.lesson-view__video {
  aspect-ratio: 16 / 9;
  border-radius: var(--plumi-radius-lg);
  overflow: hidden;
  background: black;
  margin: var(--size-4, 1rem) 0;
}

.lesson-view__video iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.lesson-view__content {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.65;
  padding: var(--plumi-panel-padding);
  border: 1px solid var(--plumi-border);
  border-radius: 20px;
  background: var(--plumi-surface);
  margin: var(--size-4, 1rem) 0;
}

.lesson-view__complete {
  display: flex;
  justify-content: center;
  padding: var(--size-4, 1rem) 0;
}
</style>