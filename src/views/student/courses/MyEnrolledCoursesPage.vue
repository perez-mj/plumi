<!-- src/views/student/courses/MyEnrolledCoursesPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="My Courses" subtitle="Courses you're enrolled in">
          <template #actions>
            <ion-button size="small" @click="$router.push({ name: 'student-courses-browse' })">Browse</ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!courses.length" title="Not enrolled yet"
          message="Browse available courses to get started." :icon="bookOutline" />

        <div v-else class="my-enr__grid">
          <CourseCard v-for="c in courses" :key="c.id" :course="c" @open="open" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton,
} from '@ionic/vue';
import { bookOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import CourseCard from '@/components/courses/CourseCard.vue';
import { listMyEnrollments } from '@/services/enrollments';
import { listCourses } from '@/services/courses';
import type { CourseWithMeta } from '@/types/app';

const router = useRouter();
const courses = ref<CourseWithMeta[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  error.value = null;
  try {
    const enrollments = await listMyEnrollments();
    const ids = new Set(enrollments.map((e) => e.course_id));
    const all = await listCourses();
    courses.value = all.filter((c) => ids.has(c.id));
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

function open(id: string) {
  router.push({ name: 'student-course-home', params: { id } });
}

onMounted(load);
</script>

<style scoped>
.my-enr__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
</style>