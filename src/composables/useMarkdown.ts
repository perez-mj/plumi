// src/composables/useMarkdown.ts
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

type MarkdownItInstance = InstanceType<typeof MarkdownIt>;

const md: MarkdownItInstance = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    const safeLang = md.utils.escapeHtml(lang || '');
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre class="hljs"><code class="language-${safeLang}">${out}</code></pre>`;
      } catch {
        /* fall through to escaped plain text */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

md.use(taskLists, { enabled: true, label: true });

// Fallback renderer for link_open when no prior rule exists.
const proxyRule = (
  tokens: any[],
  idx: number,
  options: any,
  _env: any,
  self: any,
): string => self.renderToken(tokens, idx, options);

const defaultLinkOpen = md.renderer.rules.link_open ?? proxyRule;

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet('href') ?? '';
  if (/^https?:\/\//i.test(String(href))) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export interface RenderOptions {
  /**
   * `true`  → content is authored by trusted users (instructors/admins).
   *           Allows task-list checkboxes, code-language classes, etc.
   * `false` → untrusted content (student submissions).
   *           Strips `class` and checkbox interactive attributes.
   */
  trusted?: boolean;
}

export function renderMarkdown(
  source: string | null | undefined,
  { trusted = true }: RenderOptions = {},
): string {
  if (!source || !source.trim()) return '';
  const raw = md.render(source);
  return trusted
    ? DOMPurify.sanitize(raw, {
        ADD_ATTR: ['target', 'rel', 'class', 'disabled', 'checked', 'type'],
      })
    : DOMPurify.sanitize(raw, {
        ADD_ATTR: ['target', 'rel'],
      });
}

export { markdownExcerpt } from '@/lib/markdownExcerpt';