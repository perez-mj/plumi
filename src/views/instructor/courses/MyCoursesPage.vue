<!-- src/views/instructor/courses/MyCoursesPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="My Courses" subtitle="Manage the courses you teach">
          <template #actions>
            <ion-button size="small" @click="$router.push({ name: 'instructor-course-new' })">
              <ion-icon slot="start" :icon="addOutline" /> New Course
            </ion-button>
          </template>
        </PageHeader>

        <div class="my-courses__filters">
          <ion-searchbar v-model="search" placeholder="Search courses…" :debounce="300" @ionInput="load" />
          <div class="my-courses__tabs">
            <button v-for="tab in tabs" :key="tab" class="my-courses__tab"
              :class="{ 'my-courses__tab--active': activeTab === tab }" @click="activeTab = tab; load()">
              {{ tab }}
            </button>
          </div>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!courses.length" title="No courses" message="Create your first course to get started." :icon="bookOutline" />

        <div v-else class="my-courses__grid">
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
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon, IonSearchbar,
} from '@ionic/vue';
import { addOutline, bookOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import CourseCard from '@/components/courses/CourseCard.vue';
import { useAuthStore } from '@/stores/authStore';
import { listCourses } from '@/services/courses';
import type { CourseWithMeta } from '@/types/app';

const router = useRouter();
const auth = useAuthStore();
const courses = ref<CourseWithMeta[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref('');
const activeTab = ref<'All' | 'Published' | 'Draft' | 'Archived'>('All');
const tabs: Array<typeof activeTab.value> = ['All', 'Published', 'Draft', 'Archived'];

async function load() {
  error.value = null;
  try {
    courses.value = await listCourses({
      search: search.value,
      status: activeTab.value === 'All' ? 'ALL' : (activeTab.value.toUpperCase() as never),
      instructorId: auth.user?.id,
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load courses.';
  } finally { loading.value = false; }
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
.my-courses__filters { display: flex; flex-direction: column; gap: var(--size-3, 0.75rem); }
.my-courses__tabs { display: flex; gap: var(--size-1, 0.25rem); flex-wrap: wrap; }
.my-courses__tab { padding: var(--size-1, 0.25rem) var(--size-3, 0.75rem); border-radius: var(--radius-round); border: 1px solid var(--plumi-border); background: var(--plumi-surface); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); cursor: pointer; }
.my-courses__tab--active { background: var(--plumi-primary); border-color: var(--plumi-primary); color: white; }
.my-courses__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }

.my-courses__tab { min-height:42px; padding:9px 18px; font-weight:600; border-radius:12px; }
</style>