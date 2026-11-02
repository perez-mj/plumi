<!-- src/views/student/assignments/MyAssignmentsPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Assignments" subtitle="Your assignments and submissions" />

        <div class="my-asg__tabs">
          <button v-for="tab in tabs" :key="tab.value" class="my-asg__tab"
            :class="{ 'my-asg__tab--active': activeTab === tab.value }" @click="activeTab = tab.value; load()">
            {{ tab.label }}
          </button>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!items.length" title="No assignments" message="Assignments will appear here." :icon="documentTextOutline" />

        <ul v-else class="asg-rows">
          <li v-for="a in items" :key="a.id" class="asg-row"
            @click="$router.push({ name: 'student-assignment-submit', params: { id: a.id } })">
            <div class="asg-row__head">
              <p class="asg-row__title">{{ a.title }}</p>
              <span v-if="a.submission_status" class="asg-row__status">{{ a.submission_status }}</span>
            </div>
            <p class="asg-row__meta">{{ a.course_title }} · {{ formatDate(a.due_at) }} · {{ a.max_score }} pts</p>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
} from '@ionic/vue';
import { documentTextOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

interface Row {
  id: string; title: string; due_at: string | null; max_score: number;
  course_title: string; submission_status?: string | null;
}

const auth = useAuthStore();
const items = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref<'all' | 'upcoming' | 'submitted' | 'graded'>('all');
const tabs = [
  { value: 'all' as const, label: 'All' },
  { value: 'upcoming' as const, label: 'Upcoming' },
  { value: 'submitted' as const, label: 'Submitted' },
  { value: 'graded' as const, label: 'Graded' },
];

async function load() {
  error.value = null;
  try {
    const { data, error: err } = await supabase
      .from('assignments')
      .select(`
        id, title, due_at, max_score,
        courses!inner ( title ),
        submissions!left ( id, status, student_id )
      `)
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('due_at', { ascending: true, nullsFirst: false });
    if (err) throw err;

    const rows = (data ?? []).map((a) => {
      const course = (a as { courses: { title: string } | { title: string }[] }).courses;
      const c = Array.isArray(course) ? course[0] : course;
      const subs = (a as { submissions: Array<{ status: string; student_id: string }> }).submissions ?? [];
      const mine = subs.find((s) => s.student_id === auth.user?.id);
      return {
        id: a.id, title: a.title, due_at: a.due_at, max_score: a.max_score,
        course_title: c?.title ?? 'Course', submission_status: mine?.status ?? null,
      } as Row;
    });

    let filtered = rows;
    if (activeTab.value === 'upcoming') filtered = rows.filter((r) => !r.submission_status && r.due_at && new Date(r.due_at) >= new Date());
    if (activeTab.value === 'submitted') filtered = rows.filter((r) => r.submission_status === 'SUBMITTED' || r.submission_status === 'LATE');
    if (activeTab.value === 'graded') filtered = rows.filter((r) => r.submission_status === 'GRADED');

    items.value = filtered;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally { loading.value = false; }
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
.my-asg__tabs { display: flex; gap: var(--size-1, 0.25rem); flex-wrap: wrap; }
.my-asg__tab { padding: var(--size-1, 0.25rem) var(--size-3, 0.75rem); border-radius: var(--radius-round); border: 1px solid var(--plumi-border); background: var(--plumi-surface); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); cursor: pointer; }
.my-asg__tab--active { background: var(--plumi-primary); border-color: var(--plumi-primary); color: white; }
.asg-rows { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.asg-row { padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); cursor: pointer; }
.asg-row:hover { background: var(--plumi-surface-muted); }
.asg-row__head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.asg-row__title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.asg-row__status { padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-info-soft); color: var(--plumi-info); font-size: var(--plumi-text-xs); }
.asg-row__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
</style>