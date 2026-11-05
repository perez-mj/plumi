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

.page-header { display:flex; align-items:center; justify-content:space-between; gap:24px; margin:0 0 4px; padding:4px 0 16px; }
.page-header__text { min-width:0; }
.page-header__title { margin:0; font-size:var(--plumi-text-2xl); font-weight:750; letter-spacing:-.045em; line-height:1.2; color:var(--plumi-ink); overflow-wrap:anywhere; }
.page-header__subtitle { margin:10px 0 0; max-width:62ch; font-size:.875rem; line-height:1.65; color:var(--plumi-text-muted); }
.page-header__actions { display:flex; flex-shrink:0; align-items:center; gap:8px; flex-wrap:wrap; }
.page-header__actions:empty { display:none; }
@media(max-width:600px) {
 .page-header { align-items:flex-start; flex-direction:column; gap:16px; padding-bottom:8px; }
 .page-header__actions { width:100%; }
 .page-header__actions :deep(ion-button) { margin:0; min-height:44px; }
 .page-header__subtitle { margin-top:7px; font-size:.8125rem; }
}

</style>