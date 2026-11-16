// src/types/markdown-it-task-lists.d.ts
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskLists: (
    md: InstanceType<typeof MarkdownIt>,
    options?: TaskListOptions
  ) => void

  export default taskLists
}