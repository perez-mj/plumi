<!-- src/components/common/LoadingState.vue -->
<template>
  <div class="loading">
    <ion-spinner name="crescent" />
    <span>{{ label }}</span>
  </div>
</template>
<script setup lang="ts">
import { IonSpinner } from '@ionic/vue';
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' });
</script>
<style scoped>
.loading { display: flex; align-items: center; justify-content: center; gap: var(--size-2);
  padding: var(--size-7); color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
</style>