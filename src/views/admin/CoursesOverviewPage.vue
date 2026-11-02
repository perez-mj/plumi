<!-- src/views/admin/CoursesOverviewPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="All Courses" subtitle="View and manage every course on the platform" />

        <ion-searchbar v-model="search" placeholder="Search courses…" :debounce="300" @ionInput="load" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!courses.length" title="No courses" message="No courses found." :icon="bookOutline" />

        <div v-else class="courses-ov__grid">
          <CourseCard v-for="c in courses" :key="c.id" :course="c" @open="goToCourse" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonSearchbar,
} from '@ionic/vue';
import { bookOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import CourseCard from '@/components/courses/CourseCard.vue';
import { listCourses } from '@/services/courses';
import type { CourseWithMeta } from '@/types/app';

const router = useRouter();
const courses = ref<CourseWithMeta[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref('');

async function load() {
  error.value = null;
  try { courses.value = await listCourses({ search: search.value }); }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Failed to load courses.'; }
  finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

function goToCourse(id: string) {
  router.push({ name: 'instructor-course-content', params: { id } });
}

onMounted(load);
</script>

<style scoped>
.courses-ov__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
</style>