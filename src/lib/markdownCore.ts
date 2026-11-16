// src/lib/markdownCore.ts
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

export const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

md.use(taskLists, { enabled: true, label: true });