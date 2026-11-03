<!-- src/views/shared/meetings/MeetingRoomPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false" :fullscreen="true">
      <div class="meeting-room">
        <div class="meeting-room__header">
          <ion-button fill="clear" size="small" @click="leaveMeeting">
            <ion-icon slot="start" :icon="arrowBackOutline" /> Leave
          </ion-button>
          <span class="meeting-room__room">{{ roomName || '—' }}</span>
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
            @left="leaveMeeting"
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
import { arrowBackOutline } from 'ionicons/icons';
import JitsiFrame from '@/components/ui/JitsiFrame.vue';
import { useAuthStore } from '@/stores/authStore';
import { joinMeeting, leaveMeeting as recordLeave } from '@/services/meetings';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const meetingId = route.params.id as string;

const status = ref<'checking' | 'ready' | 'denied'>('checking');
const errorMessage = ref<string | null>(null);
const roomName = ref('');

async function init() {
  if (!meetingId) { router.replace({ name: 'meetings' }); return; }
  try {
    const { room_name } = await joinMeeting(meetingId);
    roomName.value = room_name;
    status.value = 'ready';
  } catch (e: unknown) {
    status.value = 'denied';
    errorMessage.value = e instanceof Error ? e.message : 'Unable to join meeting.';
  }
}

async function leaveMeeting() {
  try { await recordLeave(meetingId); } catch { /* best-effort */ }
  router.push({ name: 'meetings' });
}

onMounted(init);
onBeforeUnmount(() => { void recordLeave(meetingId); });
</script>

<style scoped>
.meeting-room { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; }
.meeting-room__header { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; padding: var(--size-2, 0.5rem) var(--size-4, 1rem); border-bottom: 1px solid var(--plumi-border); background: var(--plumi-surface); }
.meeting-room__room { font-family: var(--plumi-font-mono); font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
.meeting-room__frame { flex: 1 1 auto; min-height: 0; background: black; display: flex; }
.meeting-room__status { margin: auto; color: white; font-size: var(--plumi-text-sm); text-align: center; padding: var(--size-4, 1rem); }
.meeting-room__status--error { color: #ffb4b4; }
</style>