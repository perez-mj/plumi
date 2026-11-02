<!-- src/components/common/StatCard.vue -->
<template>
  <div class="stat">
    <div class="stat__icon" :class="`stat__icon--${tone}`">
      <ion-icon :icon="icon" />
    </div>
    <div>
      <p class="stat__value">{{ value }}</p>
      <p class="stat__label">{{ label }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
withDefaults(defineProps<{
  icon: string;
  label: string;
  value: string | number;
  tone?: 'primary' | 'success' | 'warning' | 'info';
}>(), { tone: 'primary' });
</script>

<style scoped>
.stat {
  display: flex; align-items: center; gap: var(--size-3);
  padding: var(--size-4);
  border: 1px solid var(--plumi-border); border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
}
.stat__icon {
  display: grid; place-items: center;
  width: 44px; height: 44px; border-radius: var(--plumi-radius-md);
  font-size: 22px;
}
.stat__icon--primary { background: var(--plumi-primary-soft); color: var(--plumi-primary); }
.stat__icon--success { background: var(--plumi-success-soft); color: var(--plumi-success); }
.stat__icon--warning { background: var(--plumi-warning-soft); color: var(--plumi-warning); }
.stat__icon--info { background: var(--plumi-info-soft); color: var(--plumi-info); }
.stat__value { margin: 0; font-size: var(--plumi-text-xl); font-weight: var(--plumi-weight-bold); color: var(--plumi-ink); }
.stat__label { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
</style>