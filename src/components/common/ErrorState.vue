<!-- src/components/common/ErrorState.vue -->
<template>
  <div class="err">
    <ion-icon :icon="alertCircleOutline" class="err__icon" />
    <div class="err__body">
      <h3 class="err__title">{{ title }}</h3>
      <p class="err__msg">{{ message }}</p>
    </div>
    <ion-button fill="outline" size="small" @click="$emit('retry')">Retry</ion-button>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonButton } from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
withDefaults(defineProps<{ title?: string; message: string }>(), { title: 'Something went wrong' });
defineEmits<{ (e: 'retry'): void }>();
</script>

<style scoped>
.err {
  display: flex;
  align-items: center;
  gap: var(--size-3);
  padding: var(--size-4);
  border: 1px solid var(--plumi-danger-soft);
  border-radius: var(--plumi-radius-md);
  background: var(--plumi-danger-soft);
}
.err__icon { font-size: 24px; color: var(--plumi-danger); flex: 0 0 auto; }
.err__body { flex: 1; min-width: 0; }
.err__title { margin: 0 0 2px; font-size: var(--plumi-text-sm); color: var(--plumi-danger); }
.err__msg { margin: 0; font-size: var(--plumi-text-xs); color: var(--plumi-text-muted); }
</style>