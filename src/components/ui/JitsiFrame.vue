<!-- frontend/src/components/JitsiFrame.vue -->
<template>
  <div ref="containerRef" class="jitsi-frame" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface Props {
  roomName: string;
  displayName: string;
  email?: string;
  jwt?: string;
  isModerator?: boolean;
  startMuted?: boolean;
  domain?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isModerator: false,
  startMuted: true,
  domain: import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si',
});

const emit = defineEmits<{
  (e: 'ready'): void;
  (e: 'joined'): void;
  (e: 'left'): void;
  (e: 'participant-joined', id: string): void;
  (e: 'participant-left', id: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let api: any = null;

function loadScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-jitsi="${domain}"]`,
    );
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = `https://${domain}/external_api.js`;
    s.async = true;
    s.dataset.jitsi = domain;
    s.onload = () => {
      (s as any)._loaded = true;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function init() {
  if (!containerRef.value || !props.roomName) return;
  await loadScript(props.domain);

  const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
  if (!JitsiMeetExternalAPI) return;

  api = new JitsiMeetExternalAPI(props.domain, {
    roomName: props.roomName,
    parentNode: containerRef.value,
    width: '100%',
    height: '100%',
    userInfo: { displayName: props.displayName, email: props.email },
    ...(props.jwt ? { jwt: props.jwt } : {}),
    configOverwrite: {
      startWithAudioMuted: props.startMuted,
      startWithVideoMuted: props.startMuted,
      prejoinPageEnabled: true,
      disableDeepLinking: true,
      toolbarButtons: [
        'microphone', 'camera', 'closedcaptions', 'desktop',
        'fullscreen', 'fodeviceselection', 'hangup', 'chat',
        'raisehand', 'tileview', 'settings', 'select-background',
        'participants-pane',
        ...(props.isModerator ? ['mute-everyone'] : []),
      ],
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      MOBILE_APP_PROMO: false,
    },
  });

  api.addEventListener('videoConferenceJoined', () => emit('joined'));
  api.addEventListener('videoConferenceLeft', () => emit('left'));
  api.addEventListener('participantJoined', (e: any) =>
    emit('participant-joined', e.participantId),
  );
  api.addEventListener('participantLeft', (e: any) =>
    emit('participant-left', e.participantId),
  );
  api.addEventListener('readyToClose', () => emit('left'));

  emit('ready');
}

function destroy() {
  if (api) {
    try { api.dispose(); } catch { /* noop */ }
    api = null;
  }
}

onMounted(init);

watch(
  () => props.roomName,
  async () => {
    destroy();
    await init();
  },
);

onBeforeUnmount(destroy);

defineExpose({ api });
</script>

<style scoped>
.jitsi-frame {
  width: 100%;
  height: 100%;
  background: #000;
}
</style>