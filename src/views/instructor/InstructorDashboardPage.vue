<!-- src/views/instructor/InstructorDashboardPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader :title="`Hello, ${auth.displayName || 'Instructor'}`" subtitle="Manage your courses and students" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />

        <template v-else>
          <section class="instr-dash__stats">
            <StatCard icon="bookOutline" label="My Courses" :value="stats.courses" tone="primary" />
            <StatCard icon="peopleOutline" label="Total Students" :value="stats.students" tone="info" />
            <StatCard icon="documentTextOutline" label="Assignments" :value="stats.assignments" tone="warning" />
            <StatCard icon="checkmarkDoneOutline" label="Pending Grades" :value="stats.pendingGrades" tone="success" />
          </section>

          <div class="instr-dash__grid">
            <section class="instr-dash__panel">
              <div class="instr-dash__panel-head">
                <h2>My Courses</h2>
                <ion-button size="small" @click="$router.push({ name: 'instructor-course-new' })">
                  <ion-icon slot="start" :icon="addOutline" /> New
                </ion-button>
              </div>
              <ul v-if="courses.length" class="instr-dash__list">
                <li v-for="c in courses" :key="c.id" class="instr-dash__item"
                  @click="$router.push({ name: 'instructor-course-content', params: { id: c.id } })">
                  <span class="instr-dash__avatar">{{ c.title.charAt(0) }}</span>
                  <div class="instr-dash__item-body">
                    <p class="instr-dash__item-title">{{ c.title }}</p>
                    <p class="instr-dash__item-meta">{{ c.code || 'Course' }} · {{ c.status }}</p>
                  </div>
                </li>
              </ul>
              <p v-else class="instr-dash__empty">You don't have any courses yet.</p>
            </section>

            <section class="instr-dash__panel">
              <div class="instr-dash__panel-head"><h2>Upcoming Deadlines</h2></div>
              <ul v-if="upcoming.length" class="instr-dash__list">
                <li v-for="a in upcoming" :key="a.id" class="instr-dash__item"
                  @click="$router.push({ name: 'instructor-assignment-edit', params: { courseId: a.course_id, id: a.id } })">
                  <span class="instr-dash__avatar instr-dash__avatar--warn">
                    <ion-icon :icon="documentTextOutline" />
                  </span>
                  <div class="instr-dash__item-body">
                    <p class="instr-dash__item-title">{{ a.title }}</p>
                    <p class="instr-dash__item-meta">{{ formatDate(a.due_at) }}</p>
                  </div>
                </li>
              </ul>
              <p v-else class="instr-dash__empty">No upcoming deadlines.</p>
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
import { addOutline, bookOutline, peopleOutline, documentTextOutline, checkmarkDoneOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import StatCard from '@/components/common/StatCard.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useAuthStore } from '@/stores/authStore';
import { listCourses } from '@/services/courses';
import { listAssignmentsForCourse } from '@/services/assignments';
import type { CourseWithMeta, Assignment } from '@/types/app';

const auth = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);
const courses = ref<CourseWithMeta[]>([]);
const upcoming = ref<Assignment[]>([]);
const stats = ref({ courses: 0, students: 0, assignments: 0, pendingGrades: 0 });

function formatDate(iso: string | null) {
  if (!iso) return 'No deadline';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function load() {
  error.value = null;
  try {
    const myCourses = await listCourses({ instructorId: auth.user?.id });
    courses.value = myCourses;
    stats.value.courses = myCourses.length;

    if (myCourses.length) {
      const allAssignments = await Promise.all(myCourses.map((c) => listAssignmentsForCourse(c.id)));
      const flat = allAssignments.flat();
      stats.value.assignments = flat.length;
      upcoming.value = flat
        .filter((a) => a.due_at && new Date(a.due_at) >= new Date())
        .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
        .slice(0, 5);
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard.';
  } finally { loading.value = false; }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

onMounted(load);
</script>

<style scoped>
.instr-dash__stats { display: grid; gap: var(--size-3, 0.75rem); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.instr-dash__grid { display: grid; gap: var(--size-4, 1rem); grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.instr-dash__panel { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); }
.instr-dash__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--size-3, 0.75rem); }
.instr-dash__panel-head h2 { margin: 0; font-size: var(--plumi-text-md); }
.instr-dash__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.instr-dash__item { display: flex; align-items: center; gap: var(--size-3, 0.75rem); padding: var(--size-2, 0.5rem); border-radius: var(--plumi-radius-md); cursor: pointer; }
.instr-dash__item:hover { background: var(--plumi-surface-muted); }
.instr-dash__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--plumi-radius-md); background: var(--plumi-primary-soft); color: var(--plumi-primary); font-weight: var(--plumi-weight-bold); }
.instr-dash__avatar--warn { background: var(--plumi-warning-soft); color: var(--plumi-warning); }
.instr-dash__item-body { flex: 1; min-width: 0; }
.instr-dash__item-title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.instr-dash__item-meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.instr-dash__empty { color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); text-align: center; padding: var(--size-3, 0.75rem); }
</style>