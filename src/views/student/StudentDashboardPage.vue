<!-- src/views/student/StudentDashboardPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <div class="dashboard-welcome"><span class="dashboard-welcome__eyebrow">YOUR LEARNING WORKSPACE</span><PageHeader :title="`Welcome, ${auth.displayName || 'Student'}`" subtitle="Keep up with your learning" /></div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <section class="std-dash__stats">
            <StatCard icon="bookOutline" label="Enrolled Courses" :value="stats.courses" tone="primary" />
            <StatCard icon="documentTextOutline" label="Upcoming" :value="upcoming.length" tone="warning" />
            <StatCard icon="checkmarkDoneOutline" label="Completed" :value="stats.completed" tone="success" />
            <StatCard icon="trophyOutline" label="Average Grade" :value="stats.avgGrade" tone="info" />
          </section>

          <div class="std-dash__grid">
            <section class="std-dash__panel">
              <div class="std-dash__panel-head">
                <h2>My Courses</h2>
                <ion-button size="small" fill="clear" @click="$router.push({ name: 'student-courses' })">View all</ion-button>
              </div>
              <ul v-if="enrolledCourses.length" class="std-dash__list">
                <li v-for="c in enrolledCourses" :key="c.id" class="std-dash__item"
                  @click="$router.push({ name: 'student-course-home', params: { id: c.id } })">
                  <span class="std-dash__avatar">{{ c.title.charAt(0) }}</span>
                  <div class="std-dash__item-body">
                    <p class="std-dash__item-title">{{ c.title }}</p>
                    <p class="std-dash__item-meta">{{ c.code || 'Course' }}</p>
                  </div>
                </li>
              </ul>
              <p v-else class="std-dash__empty">Not enrolled in any courses yet.</p>
            </section>

            <section class="std-dash__panel">
              <div class="std-dash__panel-head">
                <h2>Upcoming Deadlines</h2>
                <ion-button size="small" fill="clear" @click="$router.push({ name: 'student-assignments' })">View all</ion-button>
              </div>
              <ul v-if="upcoming.length" class="std-dash__list">
                <li v-for="a in upcoming" :key="a.id" class="std-dash__item"
                  @click="$router.push({ name: 'student-assignment-submit', params: { id: a.id } })">
                  <span class="std-dash__avatar std-dash__avatar--warn">
                    <ion-icon :icon="documentTextOutline" />
                  </span>
                  <div class="std-dash__item-body">
                    <p class="std-dash__item-title">{{ a.title }}</p>
                    <p class="std-dash__item-meta">{{ formatDate(a.due_at) }}</p>
                  </div>
                </li>
              </ul>
              <p v-else class="std-dash__empty">No upcoming deadlines.</p>
            </section>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
} from '@ionic/vue';
import { bookOutline, documentTextOutline, checkmarkDoneOutline, trophyOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useAuthStore } from '@/stores/authStore';
import { listMyEnrollments } from '@/services/enrollments';
import { listCourses } from '@/services/courses';
import { listMyUpcomingAssignments } from '@/services/assignments';
import type { CourseWithMeta, Assignment } from '@/types/app';

const auth = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);
const enrolledCourses = ref<CourseWithMeta[]>([]);
const upcoming = ref<Assignment[]>([]);
const stats = ref({ courses: 0, completed: 0, avgGrade: '—' });

function formatDate(iso: string | null) {
  if (!iso) return 'No deadline';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function load() {
  error.value = null;
  try {
    const [enrollments, upcomingList] = await Promise.all([
      listMyEnrollments(),
      listMyUpcomingAssignments(),
    ]);
    upcoming.value = upcomingList;
    stats.value.courses = enrollments.length;

    if (enrollments.length) {
      const ids = new Set(enrollments.map((e) => e.course_id));
      const all = await listCourses();
      enrolledCourses.value = all.filter((c) => ids.has(c.id)).slice(0, 5);
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

onMounted(load);
</script>

<style scoped>
.std-dash__stats { display: grid; gap: var(--size-3, 0.75rem); grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); }
.std-dash__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.std-dash__panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.std-dash__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--size-3, 0.75rem); }
.std-dash__panel-head h2 { margin: 0; font-size: var(--plumi-text-md); }
.std-dash__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.std-dash__item { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-2, 0.5rem); border-radius: var(--plumi-radius-md); cursor: pointer; }
.std-dash__item:hover { background: var(--plumi-surface-muted); }
.std-dash__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--plumi-radius-md); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); }
.std-dash__avatar--warn { background: var(--plumi-warning-soft); color: var(--plumi-warning); }
.std-dash__item-body { flex: 1; min-width: 0; }
.std-dash__item-title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.std-dash__item-meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.std-dash__empty { color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); text-align: center; padding: var(--size-3, 0.75rem); }

.std-dash__panel { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.std-dash__panel-head { gap:14px; flex-wrap:wrap; }
.std-dash__item { padding:14px 12px; min-height:70px; border-bottom:1px solid var(--plumi-border); border-radius:10px; }
.std-dash__stats { gap:16px; }
@media(max-width:600px) { .std-dash__stats { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } }

.dashboard-welcome { position:relative; padding:28px 30px 22px; overflow:hidden; border:1px solid var(--plumi-border); border-radius:24px; background:var(--plumi-primary-subtle); }
.dashboard-welcome::after { content:''; position:absolute; width:180px; height:180px; right:-60px; top:-70px; border:30px solid var(--plumi-primary-soft); border-radius:50%; pointer-events:none; }
.dashboard-welcome__eyebrow { display:block; position:relative; z-index:1; margin-bottom:12px; color:var(--plumi-primary); font-size:10px; font-weight:700; letter-spacing:.15em; }
.dashboard-welcome :deep(.page-header) { position:relative; z-index:1; padding:0; margin:0; }
@media(max-width:600px) { .dashboard-welcome { padding:22px 20px; } }
</style>