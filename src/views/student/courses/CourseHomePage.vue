<!-- src/views/student/courses/CourseHomePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="reload" />

        <template v-else-if="course">
          <ion-button fill="clear" size="small" @click="$router.back()">
            <ion-icon slot="start" :icon="arrowBackOutline" /> Back
          </ion-button>

          <header class="course-home__hero">
            <div class="course-home__cover">
              <span v-if="!course.cover_image_url" class="course-home__initials">{{ course.title.charAt(0) }}</span>
            </div>
            <div class="course-home__body">
              <p v-if="course.code" class="course-home__code">{{ course.code }}</p>
              <h1 class="course-home__title">{{ course.title }}</h1>
              <p v-if="course.description" class="course-home__desc">{{ course.description }}</p>
              <div v-if="isEnrolled" class="course-home__progress">
                <div class="progress"><div class="progress__bar" :style="{ width: progress.percent + '%' }" /></div>
                <span>{{ progress.percent }}% complete ({{ progress.completed }}/{{ progress.total }})</span>
              </div>
              <ion-button v-if="!isEnrolled" @click="showEnroll = true">Enroll</ion-button>
            </div>
          </header>

          <ion-segment v-model="tab" class="course-home__tabs">
            <ion-segment-button value="content"><ion-label>Content</ion-label></ion-segment-button>
            <ion-segment-button value="assignments"><ion-label>Assignments</ion-label></ion-segment-button>
            <ion-segment-button value="announcements"><ion-label>Announcements</ion-label></ion-segment-button>
          </ion-segment>

          <section v-if="tab === 'content'" class="panel">
            <EmptyState v-if="!modules.length" title="No content yet" message="Lessons will appear here." :icon="albumsOutline" />
            <div v-else class="modules">
              <article v-for="m in modules" :key="m.id" class="module">
                <header class="module__header"><h3 class="module__title">{{ m.title }}</h3></header>
                <ul v-if="m.lessons.length" class="lessons">
                  <li v-for="l in m.lessons" :key="l.id" class="lesson"
                    @click="$router.push({ name: 'student-lesson-view', params: { courseId: course.id, lessonId: l.id } })">
                    <ion-icon :icon="playCircleOutline" class="lesson__icon" />
                    <div class="lesson__body">
                      <p class="lesson__title">{{ l.title }}</p>
                      <p v-if="l.video_url" class="lesson__meta">Video lesson</p>
                    </div>
                  </li>
                </ul>
                <p v-else class="module__empty">No lessons in this module.</p>
              </article>
            </div>
            <div v-if="materials.length" class="materials">
              <h3>Course Materials</h3>
              <ul class="materials__list">
                <li v-for="mat in materials" :key="mat.id" class="material" @click="openMaterial(mat)">
                  <ion-icon :icon="documentOutline" />
                  <div class="material__body">
                    <p class="material__title">{{ mat.title }}</p>
                    <p class="material__meta">{{ mat.type }} · {{ formatSize(mat.size) }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section v-if="tab === 'assignments'" class="panel">
            <EmptyState v-if="!assignments.length" title="No assignments yet" message="Assignments will appear here." :icon="documentTextOutline" />
            <ul v-else class="assignments">
              <li v-for="a in assignments" :key="a.id" class="assignment"
                @click="$router.push({ name: 'student-assignment-submit', params: { id: a.id } })">
                <ion-icon :icon="documentTextOutline" />
                <div class="assignment__body">
                  <p class="assignment__title">{{ a.title }}</p>
                  <p class="assignment__meta">{{ a.due_at ? `Due ${formatDate(a.due_at)}` : 'No deadline' }} · {{ a.max_score }} pts</p>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="tab === 'announcements'" class="panel">
            <EmptyState v-if="!announcements.length" title="No announcements" message="Course announcements will appear here." :icon="megaphoneOutline" />
            <ul v-else class="announcements">
              <li v-for="a in announcements" :key="a.id" class="announcement">
                <p class="announcement__title">{{ a.title }}</p>
                <p class="announcement__content">{{ a.content }}</p>
                <p class="announcement__meta">{{ formatDate(a.created_at) }}</p>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <ion-modal :is-open="showEnroll" @didDismiss="showEnroll = false">
        <ion-content class="modal-content"><div class="modal-inner">
          <h2>Enroll in {{ course?.title }}</h2>
          <input v-model="enrollKey" placeholder="Enrollment key (if required)" class="modal-input" />
          <p v-if="enrollError" class="modal-error">{{ enrollError }}</p>
          <div class="modal-actions">
            <ion-button fill="clear" @click="showEnroll = false">Cancel</ion-button>
            <ion-button :disabled="enrolling" @click="doEnroll">{{ enrolling ? 'Enrolling…' : 'Enroll' }}</ion-button>
          </div>
        </div></ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonModal,
} from '@ionic/vue';
import {
  arrowBackOutline, playCircleOutline, documentOutline,
  documentTextOutline, megaphoneOutline, albumsOutline,
} from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useCourse } from '@/composables/useCourse';
import { useAuthStore } from '@/stores/authStore';
import { enrollInCourse } from '@/services/enrollments';
import { getMaterialDownloadUrl } from '@/services/content';
import type { Material } from '@/types/app';

const route = useRoute();
const auth = useAuthStore();
const courseId = computed(() => (route.params.id as string) || null);
const { course, modules, materials, assignments, announcements, progress, loading, error, reload } = useCourse(courseId);

const tab = ref<'content' | 'assignments' | 'announcements'>('content');
const showEnroll = ref(false);
const enrollKey = ref('');
const enrolling = ref(false);
const enrollError = ref<string | null>(null);

const isEnrolled = computed(() => !!auth.user);

async function onRefresh(ev: CustomEvent) {
  await reload();
  (ev.target as HTMLIonRefresherElement).complete();
}

async function doEnroll() {
  if (!courseId.value) return;
  enrolling.value = true;
  enrollError.value = null;
  try {
    await enrollInCourse(courseId.value, enrollKey.value || undefined);
    showEnroll.value = false;
    await reload();
  } catch (e: unknown) {
    enrollError.value = e instanceof Error ? e.message : 'Failed to enroll.';
  } finally { enrolling.value = false; }
}

async function openMaterial(mat: Material) {
  if (mat.external_url) { window.open(mat.external_url, '_blank'); return; }
  if (mat.storage_path) {
    const url = await getMaterialDownloadUrl(mat.storage_path);
    window.open(url, '_blank');
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<style scoped>
.course-home__hero { display: grid; gap: var(--size-4, 1rem); grid-template-columns: minmax(0, 280px) minmax(0, 1fr); align-items: start; }
@media (max-width: 767px) { .course-home__hero { grid-template-columns: 1fr; } }
.course-home__cover { aspect-ratio: 16 / 9; border-radius: var(--plumi-radius-lg); background: var(--plumi-primary-soft); display: grid; place-items: center; }
.course-home__initials { font-size: 64px; font-weight: var(--plumi-weight-bold); color: var(--plumi-primary); }
.course-home__code { margin: 0; font-family: var(--plumi-font-mono); font-size: var(--plumi-text-xs); color: var(--plumi-text-subtle); }
.course-home__title { margin: 4px 0; font-size: var(--plumi-text-2xl); letter-spacing: -0.03em; }
.course-home__desc { margin: 0 0 var(--size-2, 0.5rem); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
.course-home__progress { display: flex; align-items: center; gap: var(--size-2, 0.5rem); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); margin-bottom: var(--size-2, 0.5rem); }
.progress { flex: 1; height: 8px; background: var(--plumi-surface-muted); border-radius: var(--radius-round); overflow: hidden; }
.progress__bar { height: 100%; background: var(--plumi-primary); transition: width 300ms ease; }
.panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.modules { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.module { border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); overflow: hidden; }
.module__header { padding: var(--size-3, 0.75rem); background: var(--plumi-surface-muted); }
.module__title { margin: 0; font-size: var(--plumi-text-md); }
.module__empty { margin: 0; padding: var(--size-3, 0.75rem); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.lessons { list-style: none; padding: 0; margin: 0; }
.lesson { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-3, 0.75rem); cursor: pointer; border-top: 1px solid var(--plumi-border); }
.lesson:hover { background: var(--plumi-surface-muted); }
.lesson__icon { font-size: 20px; color: var(--plumi-primary); }
.lesson__title { margin: 0; font-size: var(--plumi-text-sm); }
.lesson__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.materials { margin-top: var(--size-4, 1rem); }
.materials h3 { margin: 0 0 var(--size-2, 0.5rem); font-size: var(--plumi-text-md); }
.materials__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.material { display: flex; align-items: center; gap: var(--size-2, 0.5rem); padding: var(--size-2, 0.5rem); border-radius: var(--plumi-radius-sm); cursor: pointer; }
.material:hover { background: var(--plumi-surface-muted); }
.material__body { flex: 1; }
.material__title { margin: 0; font-size: var(--plumi-text-sm); }
.material__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.assignments, .announcements { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.assignment { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); cursor: pointer; }
.assignment:hover { background: var(--plumi-surface-muted); }
.assignment__title { margin: 0; font-size: var(--plumi-text-sm); }
.assignment__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.announcement { padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); }
.announcement__title { margin: 0 0 var(--size-1, 0.25rem); font-weight: var(--plumi-weight-semibold); }
.announcement__content { margin: 0 0 var(--size-1, 0.25rem); font-size: var(--plumi-text-sm); white-space: pre-line; }
.announcement__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.modal-content { --background: var(--plumi-surface); }
.modal-inner { padding: var(--size-5, 1.25rem); max-width: 520px; margin-inline: auto; display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.modal-inner h2 { margin: 0; }
.modal-input { width: 100%; padding: var(--size-2, 0.5rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); color: var(--plumi-ink); font: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--size-2, 0.5rem); }
.modal-error { color: var(--plumi-danger); font-size: var(--plumi-text-sm); margin: 0; }
</style>