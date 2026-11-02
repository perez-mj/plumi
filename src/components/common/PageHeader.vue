<!-- src/components/common/PageHeader.vue -->
<template>
  <header class="page-header">
    <div class="page-header__text">
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--size-4);
  margin-bottom: var(--size-6);
}
.page-header__title {
  margin: 0;
  font-family: var(--plumi-font-heading);
  font-size: var(--plumi-text-2xl);
  font-weight: var(--plumi-weight-bold);
  color: var(--plumi-ink);
  letter-spacing: -0.03em;
}
.page-header__subtitle {
  margin: var(--size-1) 0 0;
  color: var(--plumi-text-muted);
  font-size: var(--plumi-text-sm);
}
.page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--size-2);
  flex-wrap: wrap;
}
</style>