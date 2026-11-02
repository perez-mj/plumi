<!-- src/views/student/grades/MyGradesPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="My Grades" subtitle="Scores and feedback from your assignments" />

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!items.length" title="No grades yet" message="Your graded submissions will appear here." :icon="trophyOutline" />

        <ul v-else class="grade-list">
          <li v-for="g in items" :key="g.id" class="grade-row">
            <div class="grade-row__head">
              <p class="grade-row__title">{{ g.title }}</p>
              <span class="grade-row__score">{{ g.score }} / {{ g.max_score }}</span>
            </div>
            <p class="grade-row__meta">{{ g.course_title }} · {{ g.status }}</p>
            <p v-if="g.feedback" class="grade-row__feedback">{{ g.feedback }}</p>
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
import { trophyOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

interface Row { id: string; title: string; score: number; max_score: number; course_title: string; feedback: string | null; status: string; }

const auth = useAuthStore();
const items = ref<Row[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  error.value = null;
  try {
    const { data, error: err } = await supabase
      .from('submissions')
      .select(`
        id, score, feedback, status,
        assignments!inner ( title, max_score, courses!inner ( title ) )
      `)
      .eq('student_id', auth.user!.id)
      .not('score', 'is', null)
      .order('graded_at', { ascending: false });
    if (err) throw err;
    items.value = (data ?? []).map((s) => {
      const a = (s as { assignments: { title: string; max_score: number; courses: { title: string } | { title: string }[] } }).assignments;
      const course = Array.isArray(a.courses) ? a.courses[0] : a.courses;
      return {
        id: s.id, title: a.title, score: s.score ?? 0, max_score: a.max_score,
        course_title: course?.title ?? 'Course', feedback: s.feedback, status: s.status,
      };
    });
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
.grade-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.grade-row { padding: var(--size-3, 0.75rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-md); background: var(--plumi-surface); }
.grade-row__head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.grade-row__title { margin: 0; font-size: var(--plumi-text-sm); font-weight: var(--plumi-weight-semibold); }
.grade-row__score { font-weight: var(--plumi-weight-bold); color: var(--plumi-success); }
.grade-row__meta { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.grade-row__feedback { padding: var(--size-2, 0.5rem); background: var(--plumi-success-soft); border-radius: var(--plumi-radius-sm); margin: var(--size-2, 0.5rem) 0 0; font-size: var(--plumi-text-sm); }
</style>