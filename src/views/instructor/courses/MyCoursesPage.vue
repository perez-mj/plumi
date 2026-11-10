<!-- src/views/instructor/courses/MyCoursesPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <!-- Replaced PageHeader with a responsive Toolbar -->
        <div class="courses-toolbar">
          <div class="courses-toolbar__tabs">
            <button
              v-for="tab in tabs"
              :key="tab"
              class="courses-tab"
              :class="{ 'courses-tab--active': activeTab === tab }"
              @click="selectTab(tab)"
            >
              {{ tab }}
            </button>
          </div>
          
          <div class="courses-toolbar__actions">
            <ion-button size="small" @click="createCourse">
              <ion-icon slot="start" :icon="addOutline" /> New Course
            </ion-button>
          </div>
        </div>

        <div class="courses-filters">
          <div class="conversation-search">
            <ion-icon :icon="searchOutline" />
            <input
              v-model="search"
              type="search"
              aria-label="Search courses"
              placeholder="Search courses…"
            />
          </div>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState 
          v-else-if="!courses.length" 
          title="No courses found" 
          :message="search ? 'Try adjusting your search terms.' : 'Create your first course to get started.'" 
          :icon="bookOutline" 
        />

        <div v-else class="courses-grid">
          <CourseCard v-for="c in courses" :key="c.id" :course="c" @open="goToCourse" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
} from '@ionic/vue';
import { addOutline, bookOutline, searchOutline } from 'ionicons/icons';
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

let searchTimer: ReturnType<typeof setTimeout> | undefined;

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
  } finally { 
    loading.value = false; 
  }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

// Separated tab logic to ensure the data reloads properly
function selectTab(tab: typeof activeTab.value) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  loading.value = true;
  load();
}

// Dedicated function for the New Course button
function createCourse() {
  router.push({ name: 'instructor-course-new' });
}

function goToCourse(id: string) {
  router.push({ name: 'instructor-course-content', params: { id } });
}

// Debounced search — mirrors the messages page pattern
watch(search, () => {
  clearTimeout(searchTimer);
  loading.value = true;
  searchTimer = setTimeout(() => {
    void load();
  }, 300);
});

onMounted(load);
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<style scoped>
/* Toolbar Layout */
.courses-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--plumi-space-3);
  margin-bottom: var(--plumi-space-2);
}

.courses-toolbar__tabs {
  display: flex;
  gap: var(--plumi-space-1);
  flex-wrap: wrap;
}

.courses-toolbar__actions {
  display: flex;
  gap: var(--plumi-space-2);
}

/* Filter / Search Bar */
.courses-filters {
  display: flex;
  flex-direction: column;
  gap: var(--plumi-space-3);
}

/* Search input — matches the messages page design */
.conversation-search {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--plumi-border, #e5e7ef);
  border-radius: 12px;
  background: var(--plumi-surface-muted, #f7f8fc);
  color: var(--plumi-text-muted, #767b8d);
}

.conversation-search input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--plumi-ink, #202336);
  font: inherit;
  font-size: 13px;
}

.conversation-search:focus-within {
  border-color: var(--plumi-primary, #6d5dfc);
}

/* Tabs - Using strict design tokens */
.courses-tab {
  padding: var(--plumi-space-2) var(--plumi-space-4);
  min-height: 42px;
  border-radius: var(--plumi-radius-md);
  border: var(--plumi-border-width) var(--plumi-border-style) var(--plumi-border);
  background: var(--plumi-surface);
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
  font-weight: var(--plumi-weight-semibold);
  cursor: pointer;
  transition: all var(--plumi-duration-fast) var(--plumi-easing);
}

.courses-tab:hover {
  background: var(--plumi-surface-muted);
  color: var(--plumi-ink);
}

.courses-tab--active {
  background: var(--plumi-primary);
  border-color: var(--plumi-primary);
  color: var(--plumi-brand-contrast); /* Uses strict token for white text */
}

.courses-tab--active:hover {
  background: var(--plumi-primary-hover);
  border-color: var(--plumi-primary-hover);
  color: var(--plumi-brand-contrast);
}

/* Grid */
.courses-grid {
  display: grid;
  gap: var(--plumi-space-4);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
}

/* Mobile Responsive Adjustments */
@media (max-width: 600px) {
  .courses-toolbar {
    flex-direction: column-reverse;
    align-items: stretch;
  }
  
  .courses-toolbar__actions ion-button {
    width: 100%;
  }
  
  .courses-toolbar__tabs {
    overflow-x: auto;
    padding-bottom: var(--plumi-space-1);
    /* Hide scrollbar */
    scrollbar-width: none;
  }
  .courses-toolbar__tabs::-webkit-scrollbar {
    display: none;
  }
  
  .courses-tab {
    flex-shrink: 0;
  }
}
</style>