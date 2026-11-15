<!-- src/views/instructor/meetings/MeetingAttendancePage.vue -->
<template>
  <ion-page>
    <ion-content>
      <div class="page-shell page-shell--narrow">
        <ion-button fill="clear" size="small" @click="$router.back()">
          <ion-icon slot="start" :icon="arrowBackOutline" /> Back
        </ion-button>

        <h1 class="attendance__title">Attendance</h1>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState
          v-else-if="!rows.length"
          title="No one joined yet"
          message="Attendance will appear here once participants join."
          :icon="peopleOutline"
        />
        <div v-else class="attendance-list">
          <div
            v-for="r in rows"
            :key="`${r.user_id}-${r.joined_at}`"
            class="attendance-row"
          >
            <div class="attendance-row__name">
              {{ r.first_name }} {{ r.last_name }}
            </div>
            <div class="attendance-row__meta">
              <span>Joined {{ formatTime(r.joined_at) }}</span>
              <span v-if="r.left_at">· Left {{ formatTime(r.left_at) }}</span>
              <span v-else class="attendance-row__live">· Still in room</span>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline, peopleOutline } from 'ionicons/icons';
import LoadingState from '@/components/common/LoadingState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import {
  listMeetingAttendance,
  type MeetingAttendanceRow,
} from '@/services/meetings';

const route = useRoute();
const meetingId = route.params.id as string;

const rows = ref<MeetingAttendanceRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await listMeetingAttendance(meetingId);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load attendance.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page-shell--narrow { max-width: 560px; }
.attendance__title {
  margin: 0 0 var(--size-4, 1rem);
  font-size: var(--plumi-text-2xl);
  letter-spacing: -0.03em;
}
.attendance-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.attendance-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--plumi-border);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-surface);
}
.attendance-row__name {
  font-weight: var(--plumi-weight-semibold);
  color: var(--plumi-ink);
}
.attendance-row__meta {
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-muted);
}
.attendance-row__live {
  color: var(--plumi-success);
  font-weight: var(--plumi-weight-semibold);
}
</style>