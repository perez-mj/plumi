<!-- src/views/shared/meetings/MeetingsListPage.vue -->
<template>
  <ion-page>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-text="Refreshing…" />
      </ion-refresher>

      <div class="page-shell">
        <PageHeader title="Meetings" subtitle="Virtual classes and meetings">
          <template #actions>
            <ion-button
              v-if="auth.role === 'instructor' && instructorCourses.length"
              size="small"
              @click="scheduleMeeting"
            >
              <ion-icon slot="start" :icon="addOutline" /> Schedule
            </ion-button>
          </template>
        </PageHeader>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState v-else-if="!meetings.length" title="No meetings"
          message="Scheduled meetings will appear here." :icon="videocamOutline" />

        <div v-else class="meetings__grid">
          <article v-for="m in meetings" :key="m.id" class="meeting">
            <div class="meeting__header">
              <ion-icon :icon="videocamOutline" class="meeting__icon" />
              <span class="meeting__status" :class="`status--${m.status.toLowerCase()}`">{{ m.status }}</span>
            </div>
            <h3 class="meeting__title">{{ m.title }}</h3>
            <p v-if="m.description" class="meeting__desc">{{ m.description }}</p>
            <p class="meeting__time">{{ formatDate(m.scheduled_at) }} · {{ m.duration }} min</p>
            <ion-button size="small"
              :disabled="m.status === 'ENDED' || m.status === 'CANCELLED' || joiningId === m.id"
              @click="join(m)">
              {{ joiningId === m.id ? 'Joining…' : (m.status === 'LIVE' ? 'Join now' : 'Join') }}
            </ion-button>
          </article>
        </div>
      </div>

      <ion-action-sheet
        :is-open="showCoursePicker"
        header="Schedule a meeting for…"
        :buttons="coursePickerButtons"
        @didDismiss="showCoursePicker = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonRefresher, IonRefresherContent,
  IonButton, IonIcon, IonActionSheet,
} from '@ionic/vue';
import { videocamOutline, addOutline } from 'ionicons/icons';
import PageHeader from '@/components/common/PageHeader.vue';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useAuthStore } from '@/stores/authStore';
import { listCourses, type CourseWithMeta } from '@/services/courses';
import { listMyMeetings, joinMeeting, type MeetingRow } from '@/services/meetings';

const router = useRouter();
const auth = useAuthStore();

const meetings = ref<MeetingRow[]>([]);
const instructorCourses = ref<CourseWithMeta[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const joiningId = ref<string | null>(null);
const showCoursePicker = ref(false);

const coursePickerButtons = computed(() => [
  ...instructorCourses.value.map((c) => ({
    text: c.title,
    handler: () => {
      router.push({ name: 'instructor-meeting-new', params: { id: c.id } });
    },
  })),
  { text: 'Cancel', role: 'cancel' },
]);

async function load() {
  error.value = null;
  try {
    meetings.value = await listMyMeetings();
    if (auth.role === 'instructor' && auth.user?.id) {
      const mine = await listCourses({ instructorId: auth.user.id });
      instructorCourses.value = mine.filter((c) => c.status !== 'ARCHIVED');
    } else {
      instructorCourses.value = [];
    }
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

function scheduleMeeting() {
  if (instructorCourses.value.length === 1) {
    router.push({ name: 'instructor-meeting-new', params: { id: instructorCourses.value[0].id } });
    return;
  }
  showCoursePicker.value = true;
}

async function join(m: MeetingRow) {
  joiningId.value = m.id;
  try {
    const { room_name } = await joinMeeting(m.id);
    router.push({ name: 'meeting-room', params: { id: m.id }, query: { room: room_name } });
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not join meeting.';
  } finally {
    joiningId.value = null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

onMounted(load);
</script>

<style scoped>
.meetings__grid { display: grid; gap: var(--size-3, 0.75rem); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.meeting { padding: var(--size-4, 1rem); border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg); background: var(--plumi-surface); display: flex; flex-direction: column; gap: var(--size-2, 0.5rem); }
.meeting__header { display: flex; align-items: center; justify-content: space-between; }
.meeting__icon { font-size: 22px; color: var(--plumi-primary); }
.meeting__status { font-size: 11px; font-weight: var(--plumi-weight-semibold); padding: 2px 8px; border-radius: var(--radius-round); background: var(--plumi-surface-muted); color: var(--plumi-text-muted); }
.status--live { background: var(--plumi-success-soft); color: var(--plumi-success); }
.status--scheduled { background: var(--plumi-info-soft); color: var(--plumi-info); }
.status--ended, .status--cancelled { background: var(--plumi-surface-muted); color: var(--plumi-text-muted); }
.meeting__title { margin: 0; font-size: var(--plumi-text-md); }
.meeting__desc { margin: 0; font-size: var(--plumi-text-sm); color: var(--plumi-text-muted); }
.meeting__time { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
</style>