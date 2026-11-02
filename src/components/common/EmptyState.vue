<!-- src/components/common/EmptyState.vue -->
<template>
  <div class="empty">
    <ion-icon :icon="icon" class="empty__icon" />
    <h3 class="empty__title">{{ title }}</h3>
    <p class="empty__text">{{ message }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
defineProps<{ title: string; message: string; icon: string }>();
</script>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--size-3);
  padding: var(--size-7) var(--size-4);
  border: 1px dashed var(--plumi-border-strong);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  text-align: center;
}
.empty__icon { font-size: 42px; color: var(--plumi-text-subtle); }
.empty__title { margin: 0; font-size: var(--plumi-text-lg); color: var(--plumi-ink); }
.empty__text { margin: 0; max-width: 42ch; color: var(--plumi-text-muted); font-size: var(--plumi-text-sm); }
</style>