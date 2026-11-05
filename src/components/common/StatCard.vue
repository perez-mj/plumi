<!-- src/components/common/StatCard.vue -->
<template>
  <div class="stat">
    <div class="stat__icon" :class="`stat__icon--${tone}`">
      <ion-icon :icon="resolvedIcon" />
    </div>
    <div>
      <p class="stat__value">{{ value }}</p>
      <p class="stat__label">{{ label }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { bookOutline, peopleOutline, documentTextOutline, checkmarkDoneOutline, trophyOutline, megaphoneOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/vue';
const props = withDefaults(defineProps<{
  icon: string;
  label: string;
  value: string | number;
  tone?: 'primary' | 'success' | 'warning' | 'info';
}>(), { tone: 'primary' });
const iconMap: Record<string, string> = { bookOutline, peopleOutline, documentTextOutline, checkmarkDoneOutline, trophyOutline, megaphoneOutline };
const resolvedIcon = computed(() => iconMap[props.icon] ?? props.icon);
</script>

<style scoped>

.stat { position:relative; display:flex; align-items:center; gap:18px; min-width:0; padding:24px; border:1px solid var(--plumi-border); border-radius:20px; background:var(--plumi-surface); box-shadow:var(--plumi-shadow-card); }
.stat__icon { display:grid; flex:0 0 50px; place-items:center; width:50px; height:50px; border-radius:16px; font-size:24px; }
.stat__icon--primary { background:var(--plumi-primary-soft); color:var(--plumi-primary); }
.stat__icon--success { background:var(--plumi-success-soft); color:var(--plumi-success); }
.stat__icon--warning { background:var(--plumi-warning-soft); color:var(--plumi-warning); }
.stat__icon--info { background:var(--plumi-info-soft); color:var(--plumi-info); }
.stat__value { margin:0 0 4px; font-size:1.85rem; line-height:1.15; font-weight:750; letter-spacing:-.045em; color:var(--plumi-ink); font-variant-numeric:tabular-nums; }
.stat__label { margin:0; font-size:.78rem; line-height:1.5; color:var(--plumi-text-muted); }
@media(max-width:600px) {
 .stat { flex-direction:column; align-items:flex-start; gap:14px; padding:18px; }
 .stat__icon { flex-basis:38px; width:38px; height:38px; border-radius:12px; font-size:20px; }
 .stat__value { font-size:1.65rem; }
}

</style>