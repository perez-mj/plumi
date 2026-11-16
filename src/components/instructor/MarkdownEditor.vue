<!-- src/components/instructor/MarkdownEditor.vue -->
<template>
  <div class="md-editor">
    <div class="md-editor__toolbar" role="toolbar" aria-label="Markdown formatting">
      <button type="button" class="md-tool" title="Heading 1" @click="wrap('# ', '')">
        <strong>H1</strong>
      </button>
      <button type="button" class="md-tool" title="Heading 2" @click="wrap('## ', '')">
        <strong>H2</strong>
      </button>
      <button type="button" class="md-tool" title="Heading 3" @click="wrap('### ', '')">
        <strong>H3</strong>
      </button>
      <span class="md-sep" />
      <button type="button" class="md-tool" title="Bold" @click="wrap('**', '**', 'bold')">
        <strong>B</strong>
      </button>
      <button type="button" class="md-tool" title="Italic" @click="wrap('*', '*', 'italic')">
        <em>I</em>
      </button>
      <button type="button" class="md-tool" title="Strikethrough" @click="wrap('~~', '~~', 'text')">
        <s>S</s>
      </button>
      <button type="button" class="md-tool" title="Inline code" @click="wrap('`', '`', 'code')">
        &lt;/&gt;
      </button>
      <span class="md-sep" />
      <button type="button" class="md-tool" title="Bullet list" @click="insert('* ')">•</button>
      <button type="button" class="md-tool" title="Numbered list" @click="insert('1. ')">1.</button>
      <button type="button" class="md-tool" title="Blockquote" @click="insert('> ')">"</button>
      <span class="md-sep" />
      <button type="button" class="md-tool" title="Link" @click="insertLink">🔗</button>
      <button type="button" class="md-tool" title="Code block" @click="insertBlock">```</button>
      <button type="button" class="md-tool" title="Table" @click="insertTable">▦</button>
      <button type="button" class="md-tool" title="Horizontal rule" @click="insertBlockText('\n---\n')">—</button>
      <span class="md-sep" />
      <div class="md-mode">
        <button
          type="button"
          class="md-tool"
          :class="{ 'is-active': mode === 'edit' }"
          title="Edit only"
          @click="mode = 'edit'"
        >✎</button>
        <button
          type="button"
          class="md-tool"
          :class="{ 'is-active': mode === 'split' }"
          title="Split view"
          @click="mode = 'split'"
        >◫</button>
        <button
          type="button"
          class="md-tool"
          :class="{ 'is-active': mode === 'preview' }"
          title="Preview only"
          @click="mode = 'preview'"
        >👁</button>
      </div>
    </div>

    <div class="md-editor__body" :class="`is-${effectiveMode}`">
      <div v-show="effectiveMode !== 'preview'" class="md-editor__pane md-editor__pane--edit">
        <Codemirror
          ref="cmRef"
          v-model="safeModel"
          :extensions="extensions"
          :style="{ height: '100%' }"
          :indent-with-tab="false"
          :tab-size="2"
          placeholder="Write your lesson content in Markdown…"
          @ready="onReady"
        />
      </div>
      <div v-show="effectiveMode !== 'edit'" class="md-editor__pane md-editor__pane--preview">
        <MarkdownContent :source="debouncedSource" empty-text="Preview will appear here." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import Codemirror from 'vue-codemirror6';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { keymap, EditorView } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import MarkdownContent from '@/components/common/MarkdownContent.vue';

const model = defineModel<string>({ default: '' });

// Coerce null/undefined from parent into '' so Codemirror never gets null.
const safeModel = computed<string>({
  get: () => model.value ?? '',
  set: (v) => (model.value = v),
});

// Debounced mirror of safeModel used only by the preview pane.
const debouncedSource = ref(safeModel.value);
let debounceTimer: number | undefined;
watch(safeModel, (v) => {
  if (typeof window === 'undefined') {
    debouncedSource.value = v;
    return;
  }
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debouncedSource.value = v;
  }, 250);
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.clearTimeout(debounceTimer);
});

type Mode = 'edit' | 'split' | 'preview';
const mode = ref<Mode>('split');

const isNarrow = ref(typeof window !== 'undefined' && window.innerWidth < 900);
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(max-width: 900px)');
  mq.addEventListener('change', (e) => (isNarrow.value = e.matches));
}
const effectiveMode = computed<Mode>(() =>
  isNarrow.value && mode.value === 'split' ? 'edit' : mode.value,
);

const cmRef = shallowRef<InstanceType<typeof Codemirror> | null>(null);
let view: EditorView | null = null;

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  EditorView.lineWrapping,
  EditorView.theme({
    '&': { fontSize: '14px', backgroundColor: 'transparent' },
    '.cm-content': { fontFamily: 'var(--plumi-font-mono)', padding: '12px' },
    '.cm-gutters': {
      backgroundColor: 'var(--plumi-surface-muted)',
      borderRight: '1px solid var(--plumi-border)',
    },
    '&.cm-focused': { outline: 'none' },
  }),
];

function onReady(payload: { view: EditorView }) {
  view = payload.view;
}

function getView(): EditorView | null {
  return view;
}

function wrap(before: string, after: string, placeholder = 'text') {
  const v = getView();
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const selected = v.state.sliceDoc(from, to) || placeholder;
  const text = `${before}${selected}${after}`;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  });
  v.focus();
}

function insert(prefix: string) {
  const v = getView();
  if (!v) return;
  const { from } = v.state.selection.main;
  const line = v.state.doc.lineAt(from);
  v.dispatch({
    changes: { from: line.from, insert: prefix },
    selection: { anchor: from + prefix.length },
  });
  v.focus();
}

function insertLink() {
  const v = getView();
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const label = v.state.sliceDoc(from, to) || 'link text';
  const text = `[${label}](https://)`;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: {
      anchor: from + label.length + 3,
      head: from + label.length + 11,
    },
  });
  v.focus();
}

function insertBlock() {
  const v = getView();
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const selected = v.state.sliceDoc(from, to) || 'code';
  const text = `\n\`\`\`\n${selected}\n\`\`\`\n`;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  v.focus();
}

function insertTable() {
  const table =
    '\n| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |\n';
  insertBlockText(table);
}

function insertBlockText(text: string) {
  const v = getView();
  if (!v) return;
  const { from, to } = v.state.selection.main;
  v.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  v.focus();
}
</script>

<style scoped>
.md-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--plumi-border-strong);
  border-radius: var(--plumi-radius-lg);
  background: var(--plumi-surface);
  overflow: hidden;
  min-height: 480px;
}

.md-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--plumi-border);
  background: var(--plumi-surface-muted);
}

.md-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--plumi-ink);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}
.md-tool:hover {
  background: var(--plumi-primary-soft);
  border-color: var(--plumi-border);
}
.md-tool.is-active {
  background: var(--plumi-primary-soft);
  color: var(--plumi-primary);
  border-color: var(--plumi-primary);
}

.md-sep {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--plumi-border-strong);
}

.md-mode {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.md-editor__body {
  display: grid;
  grid-template-columns: 1fr;
  flex: 1;
  min-height: 0;
}
.md-editor__body.is-split {
  grid-template-columns: 1fr 1fr;
}

.md-editor__pane {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  max-height: 70vh;
}
.md-editor__pane--edit {
  border-right: 1px solid var(--plumi-border);
}
.md-editor__pane--preview {
  padding: 16px 20px;
  background: var(--plumi-surface);
}
.is-edit .md-editor__pane--edit {
  border-right: 0;
}

@media (max-width: 900px) {
  .md-editor__body.is-split {
    grid-template-columns: 1fr;
  }
  .md-editor__body.is-split .md-editor__pane--edit {
    border-right: 0;
  }
}
</style>