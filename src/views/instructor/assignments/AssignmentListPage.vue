<!-- src/views/instructor/assignments/AssignmentListPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Assignments" subtitle="All assignments across your courses">
          <template #actions>
            <ion-button size="small" @click="$router.push({ name: 'instructor-courses' })">
              <ion-icon slot="start" :icon="addOutline" /> New
            </ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!items.length" title="No assignments"
          message="Create assignments from a course page." :icon="documentTextOutline" />

        <ul v-else class="asg-rows">
          <li v-for="a in items" :key="a.id" class="asg-row">
            <div class="asg-row__body" @click="$router.push({ name: 'instructor-submissions', params: { id: a.id } })">
              <p class="asg-row__title">{{ a.title }}</p>
              <p class="asg-row__meta">{{ a.course_title }} · {{ formatDate(a.due_at) }} · {{ a.max_score }} pts</p>
            </div>
            <ion-button size="small" fill="outline"
              @click="$router.push({ name: 'instructor-assignment-edit', params: { courseId: a.course_id, id: a.id } })">
              Edit
            </ion-button>
            <ion-button size="small" @click="$router.push({ name: 'instructor-submissions', params: { id: a.id } })">
              Submissions
            </ion-button>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon,
} from '@ionic/vue';
import { documentTextOutline, addOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

interface Row {
  id: string; title: string; due_at: string | null; max_score: number;
  course_id: string; course_title: string;
}

const auth = useAuthStore();
const items = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  error.value = null;
  try {
    if (!auth.user) return;
    // Query only assignments belonging to courses owned by this instructor.
    // RLS should also enforce this; scoping the query avoids relying on RLS alone.
    const { data, error: err } = await supabase
      .from('assignments')
      .select(`
        id, title, due_at, max_score, course_id,
        courses!inner ( title, instructor_id )
      `)
      .is('deleted_at', null)
      .eq('courses.instructor_id', auth.user.id)
      .order('due_at', { ascending: true, nullsFirst: false });
    if (err) throw err;

    items.value = (data ?? []).map((a) => {
      const course = (a as { courses: { title: string } | { title: string }[] }).courses;
      const c = Array.isArray(course) ? course[0] : course;
      return {
        id: a.id, title: a.title, due_at: a.due_at,
        max_score: a.max_score, course_id: a.course_id,
        course_title: c?.title ?? 'Course',
      };
    });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
}

async function onRefresh(ev: CustomEvent) {
  await load();
  (ev.target as HTMLIonRefresherElement).complete();
}

function formatDate(iso: string | null) {
  if (!iso) return 'No deadline';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

onMounted(load);
</script>

<style scoped>
.asg-rows { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.asg-row { display: flex; align-items: center; gap: var(--size-2, 0.5rem); padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.asg-row__body { flex: 1; min-width: 0; cursor: pointer; }
.asg-row__title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.asg-row__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }

.asg-row { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.asg-row__body, .asg-row__meta { min-width:0; overflow-wrap:anywhere; line-height:1.65; }
</style>