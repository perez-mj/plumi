<!-- src/views/shared/meetings/MeetingRoomPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false" :fullscreen="true">
      <div class="meeting-room">
        <div class="meeting-room__header">
  <ion-button fill="clear" size="small" @click="handleLeave">
    <ion-icon slot="start" :icon="arrowBackOutline" /> Leave
  </ion-button>
  <span class="meeting-room__room">{{ roomName || '—' }}</span>
  <ion-button
    v-if="auth.role === 'instructor' || auth.role === 'admin'"
    fill="clear"
    size="small"
    class="meeting-room__attendance-btn"
    @click="goToAttendance"
  >
    <ion-icon slot="start" :icon="peopleOutline" /> Attendance
  </ion-button>
</div>
        <div class="meeting-room__frame">
          <div v-if="status === 'checking'" class="meeting-room__status">Checking access…</div>
          <div v-else-if="status === 'denied'" class="meeting-room__status meeting-room__status--error">
            {{ errorMessage || 'You are not allowed to join this meeting.' }}
          </div>
          <JitsiFrame
            v-else-if="status === 'ready' && roomName"
            :room-name="roomName"
            :display-name="auth.displayName || auth.user?.email || 'Plumi User'"
            :email="auth.user?.email"
            :is-moderator="auth.role === 'instructor'"
            @joined="onJitsiJoined"
            @left="handleLeave"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline, peopleOutline } from 'ionicons/icons';
import JitsiFrame from '@/components/ui/JitsiFrame.vue';
import { useAuthStore } from '@/stores/authStore';
import {
  joinMeeting,
  leaveMeeting as recordLeave,
  endMeeting,
} from '@/services/meetings';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meetingId = route.params.id as string;

const status = ref<'checking' | 'ready' | 'denied'>('checking');
const errorMessage = ref<string | null>(null);
const roomName = ref('');

let leaveRecorded = false;
let joinedOnce = false;

async function init() {
  if (!meetingId) {
    router.replace({ name: 'meetings' });
    return;
  }
  try {
    const { room_name } = await joinMeeting(meetingId);
    roomName.value = room_name;
    status.value = 'ready';
  } catch (e: unknown) {
    status.value = 'denied';
    errorMessage.value =
      e instanceof Error ? e.message : 'Unable to join meeting.';
  }
}

// Fires once when the Jitsi conference is actually joined. Attendance
// is already recorded by joinMeeting(); this hook is where richer
// presence tracking would go if added later.
function onJitsiJoined() {
  if (joinedOnce) return;
  joinedOnce = true;
}

async function handleLeave() {
  if (leaveRecorded) return;
  leaveRecorded = true;

  try {
    // Host leaving also ends the meeting for everyone (closes all open rows).
    if (auth.role === 'instructor') {
      await endMeeting(meetingId);
    } else {
      await recordLeave(meetingId);
    }
  } catch {
    // Best-effort — never block navigation on attendance logging.
  }

  router.push({ name: 'meetings' });
}

function goToAttendance() {
  router.push({ name: 'meeting-attendance', params: { id: meetingId } });
}

onMounted(init);

onBeforeUnmount(() => {
  // Best-effort safety net only. Not reliable on mobile when the app
  // is backgrounded or killed; the Leave button and Jitsi 'left' event
  // are the primary paths.
  if (!leaveRecorded) {
    leaveRecorded = true;
    void recordLeave(meetingId);
  }
});
</script>

<style scoped>
.meeting-room {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.meeting-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  padding: var(--size-2, 0.5rem) var(--size-4, 1rem);
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-surface);
}
.meeting-room__room {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-family: var(--plumi-font-mono);
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meeting-room__attendance-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  font-size: var(--plumi-text-xs);
  text-transform: none;
}
.meeting-room__frame {
  flex: 1 1 auto;
  min-height: 0;
  background: black;
  display: flex;
}
.meeting-room__status {
  margin: auto;
  color: white;
  font-size: var(--plumi-text-sm);
  text-align: center;
  padding: var(--size-4, 1rem);
}
.meeting-room__status--error {
  color: #ffb4b4;
}
.meeting-room__header {
  min-height: 64px;
  gap: 12px;
  padding: 10px 18px;
}
.meeting-room__room {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 600px) {
  .meeting-room__header {
    padding: 8px 10px;
  }
}
</style>