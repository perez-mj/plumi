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
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="my-asg__tab"
            :class="{ 'my-asg__tab--active': activeTab === tab.value }"
            @click="activeTab = tab.value; load()"
          >
            {{ tab.label }}
          </button>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState
          v-else-if="!items.length"
          :title="emptyTitle"
          :message="emptyMessage"
          :icon="documentTextOutline"
        />

        <ul v-else class="asg-rows">
          <li
            v-for="a in items"
            :key="a.id"
            class="asg-row"
            @click="$router.push({ name: 'student-assignment-submit', params: { id: a.id } })"
          >
            <div class="asg-row__head">
              <p class="asg-row__title">{{ a.title }}</p>
              <span v-if="a.submission_status" class="asg-row__status">{{ a.submission_status }}</span>
            </div>
            <p class="asg-row__meta">
              {{ a.course_title }} · {{ formatDate(a.due_at) }} · {{ a.max_score }} pts
            </p>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
} from '@ionic/vue';
import { documentTextOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { supabase } from '@/lib/supabase';

interface Row {
  id: string;
  title: string;
  due_at: string | null;
  max_score: number;
  course_id: string;
  course_title: string;
  submission_status: string | null;
}

type Tab = 'all' | 'upcoming' | 'submitted' | 'graded';

const items = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref<Tab>('all');
const tabs: Array<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
];

const emptyTitle = computed(() => {
  switch (activeTab.value) {
    case 'upcoming': return 'Nothing upcoming';
    case 'submitted': return 'No submissions yet';
    case 'graded': return 'No graded work yet';
    default: return 'No assignments';
  }
});

const emptyMessage = computed(() => {
  switch (activeTab.value) {
    case 'upcoming': return 'You have no unsubmitted assignments with a future deadline.';
    case 'submitted': return 'Assignments you have submitted will appear here.';
    case 'graded': return 'Graded assignments will appear here once your instructor reviews them.';
    default: return 'Enroll in a course to see its assignments here.';
  }
});

async function load() {
  error.value = null;
  loading.value = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated.');

    // 1. Find the courses the student is actively enrolled in.
    //    This is the same authorization boundary the storage/upload
    //    policies enforce — if a course isn't here, the student cannot
    //    submit to it, so it should not appear in the list.
    const { data: enrollments, error: enrErr } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', user.id)
      .eq('status', 'ACTIVE');
    if (enrErr) throw enrErr;

    const courseIds = (enrollments ?? []).map((e) => e.course_id);
    if (!courseIds.length) {
      items.value = [];
      return;
    }

    // 2. Fetch published assignments in those courses only.
    const { data, error: err } = await supabase
      .from('assignments')
      .select(`
        id, title, due_at, max_score, course_id,
        courses!inner ( title ),
        submissions!left ( id, status, student_id )
      `)
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('course_id', courseIds)
      .order('due_at', { ascending: true, nullsFirst: false });
    if (err) throw err;

    const rows: Row[] = (data ?? []).map((a) => {
      const course = (a as { courses: { title: string } | { title: string }[] }).courses;
      const c = Array.isArray(course) ? course[0] : course;
      const subs = (a as { submissions: Array<{ status: string; student_id: string }> }).submissions ?? [];
      const mine = subs.find((s) => s.student_id === user.id);
      return {
        id: a.id,
        title: a.title,
        due_at: a.due_at,
        max_score: a.max_score,
        course_id: a.course_id,
        course_title: c?.title ?? 'Course',
        submission_status: mine?.status ?? null,
      };
    });

    const now = new Date();
    let filtered = rows;
    if (activeTab.value === 'upcoming') {
      filtered = rows.filter(
        (r) => !r.submission_status && r.due_at && new Date(r.due_at) >= now,
      );
    }
    if (activeTab.value === 'submitted') {
      filtered = rows.filter(
        (r) => r.submission_status === 'SUBMITTED' || r.submission_status === 'LATE',
      );
    }
    if (activeTab.value === 'graded') {
      filtered = rows.filter((r) => r.submission_status === 'GRADED');
    }

    items.value = filtered;
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

// Refetch when the page becomes active (e.g. returning from the submit page).
// Avoids showing stale "not submitted" rows after a submission succeeds.
onIonViewWillEnter(() => { load(); });

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

.asg-row { min-width:0; padding:var(--plumi-panel-padding); border-radius:20px; box-shadow:var(--plumi-shadow-card); }
.asg-row__head { gap:14px; flex-wrap:wrap; }
.asg-row__meta { min-width:0; overflow-wrap:anywhere; line-height:1.65; }
.my-asg__tab { min-height:42px; padding:9px 18px; font-weight:600; border-radius:12px; }
</style>