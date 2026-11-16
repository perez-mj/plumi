<!-- src/components/common/MarkdownContent.vue -->
<template>
  <div v-if="html" class="plumi-prose" v-html="html" />
  <p v-else class="markdown-content__empty">{{ emptyText }}</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/composables/useMarkdown';

const props = withDefaults(
  defineProps<{
    source: string | null | undefined;
    emptyText?: string;
    trusted?: boolean;
  }>(),
  { emptyText: 'No written content.', trusted: true },
);

const html = computed(() =>
  renderMarkdown(props.source, { trusted: props.trusted }),
);
</script>

<style scoped>
.markdown-content__empty {
  color: var(--plumi-text-muted);
  margin: 0;
}

/* ---- Prose styles -------------------------------------------------------
   :deep() is required because v-html output is NOT touched by Vue's
   scoped-CSS attribute, so plain `.plumi-prose h2 { … }` would never apply.
------------------------------------------------------------------------- */
.plumi-prose {
  line-height: 1.7;
  color: var(--plumi-ink);
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

.plumi-prose :deep(h1),
.plumi-prose :deep(h2),
.plumi-prose :deep(h3),
.plumi-prose :deep(h4),
.plumi-prose :deep(h5),
.plumi-prose :deep(h6) {
  margin: 1.4em 0 0.5em;
  line-height: 1.25;
  letter-spacing: -0.02em;
  font-weight: 700;
  scroll-margin-top: 80px;
}
.plumi-prose :deep(h1) { font-size: 1.6em; }
.plumi-prose :deep(h2) { font-size: 1.35em; }
.plumi-prose :deep(h3) { font-size: 1.15em; }
.plumi-prose :deep(h4) { font-size: 1em; }

.plumi-prose :deep(p) {
  margin: 0.6em 0;
}

.plumi-prose :deep(a) {
  color: var(--plumi-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.plumi-prose :deep(a:hover) {
  text-decoration-thickness: 2px;
}

.plumi-prose :deep(strong) { font-weight: 700; }
.plumi-prose :deep(em) { font-style: italic; }
.plumi-prose :deep(del) { text-decoration: line-through; opacity: 0.7; }

.plumi-prose :deep(ul),
.plumi-prose :deep(ol) {
  padding-left: 1.4em;
  margin: 0.6em 0;
}
.plumi-prose :deep(li) { margin: 0.25em 0; }
.plumi-prose :deep(li > ul),
.plumi-prose :deep(li > ol) { margin: 0.2em 0; }

.plumi-prose :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.4em 1em;
  border-left: 3px solid var(--plumi-primary);
  background: var(--plumi-surface-muted);
  color: var(--plumi-ink);
  border-radius: 0 8px 8px 0;
}
.plumi-prose :deep(blockquote p:first-child) { margin-top: 0; }
.plumi-prose :deep(blockquote p:last-child)  { margin-bottom: 0; }

.plumi-prose :deep(code) {
  font-family: var(--plumi-font-mono);
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  border-radius: 6px;
  background: var(--plumi-surface-muted);
  border: 1px solid var(--plumi-border);
}

.plumi-prose :deep(pre) {
  margin: 0.8em 0;
  padding: 14px 16px;
  overflow-x: auto;
  border-radius: 12px;
  background: var(--plumi-surface-muted);
  border: 1px solid var(--plumi-border);
  line-height: 1.55;
}
.plumi-prose :deep(pre code) {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 0.875em;
  white-space: pre;
  display: block;
}
.plumi-prose :deep(pre.hljs) {
  /* highlight.js theme already paints colors; keep the shell neutral */
  background: #0d1117; /* fallback — overridden by theme CSS */
  border-color: #30363d;
  color: #e6edf3;
}

.plumi-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 0.95em;
  display: block;
  overflow-x: auto;
}
.plumi-prose :deep(th),
.plumi-prose :deep(td) {
  border: 1px solid var(--plumi-border);
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
.plumi-prose :deep(th) {
  background: var(--plumi-surface-muted);
  font-weight: 600;
}
.plumi-prose :deep(table) { display: table; }

.plumi-prose :deep(hr) {
  border: 0;
  border-top: 1px solid var(--plumi-border);
  margin: 1.4em 0;
}

.plumi-prose :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
}

/* Task lists (markdown-it-task-lists output) */
.plumi-prose :deep(.task-list-item) {
  list-style: none;
  margin-left: -1.2em;
}
.plumi-prose :deep(.task-list-item input[type='checkbox']) {
  margin-right: 0.5em;
  vertical-align: middle;
  accent-color: var(--plumi-primary);
}
.plumi-prose :deep(ul.contains-task-list) {
  padding-left: 1.2em;
}
</style>