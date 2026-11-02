<!-- src/views/shared/meetings/MeetingRoomPage.vue -->
<template>
  <ion-page>
    <ion-content :scroll-y="false" :fullscreen="true">
      <div class="meeting-room">
        <div class="meeting-room__header">
          <ion-button fill="clear" size="small" @click="leaveMeeting">
            <ion-icon slot="start" :icon="arrowBackOutline" /> Leave
          </ion-button>
          <span class="meeting-room__room">{{ roomName }}</span>
        </div>
        <div ref="jitsiContainer" class="meeting-room__frame" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => {
      dispose: () => void;
      executeCommand: (cmd: string, ...args: unknown[]) => void;
    };
  }
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const roomName = route.query.room as string;
const jitsiContainer = ref<HTMLDivElement | null>(null);
let api: { dispose: () => void; executeCommand: (cmd: string, ...args: unknown[]) => void } | null = null;

function loadJitsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi'));
    document.head.appendChild(script);
  });
}

async function init() {
  if (!roomName) { router.replace({ name: 'meetings' }); return; }
  await loadJitsiScript();
  if (!window.JitsiMeetExternalAPI || !jitsiContainer.value) return;

  api = new window.JitsiMeetExternalAPI('meet.jit.si', {
    roomName,
    parentNode: jitsiContainer.value,
    width: '100%',
    height: '100%',
    userInfo: { displayName: auth.displayName || auth.user?.email || 'Plumi User' },
    configOverwrite: { prejoinPageEnabled: false, startWithAudioMuted: true },
    interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false },
  });
}

function leaveMeeting() {
  try { api?.executeCommand('hangup'); } catch { /* noop */ }
  api?.dispose();
  router.push({ name: 'meetings' });
}

onMounted(() => { void init(); });
onBeforeUnmount(() => { api?.dispose(); });
</script>

<style scoped>
.meeting-room {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;             /* fills ion-content, no calc() */
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
  font-family: var(--plumi-font-mono);
  font-size: var(--plumi-text-xs);
  color: var(--plumi-text-muted);
}
.meeting-room__frame {
  flex: 1 1 auto;
  min-height: 0;
  background: black;
}
</style>