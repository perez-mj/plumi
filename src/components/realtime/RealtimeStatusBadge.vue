<!-- src/components/realtime/RealtimeStatusBadge.vue -->
<template>
  <span
    class="rt-status"
    :class="`rt-status--${status}`"
    :title="label"
    role="status"
    :aria-label="label"
  >
    <span class="rt-status__dot" />
    <span v-if="showLabel" class="rt-status__text">{{ shortLabel }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RealtimeStatus } from '@/composables/useRealtimeChannel';

const props = withDefaults(
  defineProps<{ status: RealtimeStatus; showLabel?: boolean }>(),
  { showLabel: false },
);

const label = computed(() => ({
  idle: 'Not connected',
  connecting: 'Connecting…',
  live: 'Connected — receiving updates',
  error: 'Disconnected — retrying…',
}[props.status]));

const shortLabel = computed(() => ({
  idle: 'Offline',
  connecting: 'Connecting',
  live: 'Live',
  error: 'Reconnecting',
}[props.status]));
</script>

<style scoped>
.rt-status {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  padding: 4px 10px;
  border-radius: var(--radius-round);
  background: var(--plumi-surface-muted);
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-xs);
  font-weight: var(--plumi-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}
.rt-status__dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}
.rt-status--live { color: var(--plumi-success); background: var(--plumi-success-soft); }
.rt-status--live .rt-status__dot { box-shadow: 0 0 0 0 var(--plumi-success); animation: pulse 2.4s ease-out infinite; }
.rt-status--connecting { color: var(--plumi-warning); background: var(--plumi-warning-soft); }
.rt-status--error { color: var(--plumi-danger); background: var(--plumi-danger-soft); }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgb(22 132 91 / 55%); }
  100% { box-shadow: 0 0 0 8px rgb(22 132 91 / 0%); }
}
@media (prefers-reduced-motion: reduce) {
  .rt-status--live .rt-status__dot { animation: none; }
}
</style>