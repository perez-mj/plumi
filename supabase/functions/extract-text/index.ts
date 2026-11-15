// supabase/functions/extract-text/index.ts
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js';
import { extractText as extractPdfText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import mammoth from 'npm:mammoth@1.8.0';
import JSZip from 'npm:jszip@3.10.1';
import { XMLParser } from 'npm:fast-xml-parser@4.5.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
}

const MATERIAL_BUCKET = 'course-materials';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const userClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { materialId?: string; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const materialId = body.materialId;
  const force = body.force === true;
  if (!materialId) return json({ error: 'materialId is required' }, 400);

  // 1. Read via user client — RLS enforces course access.
  //    Only instructors/admins or uploader get past this for unpublished materials.
  const { data: material, error: mErr } = await userClient
    .from('materials')
    .select('id, type, title, course_id, storage_path, external_url, mime_type, extracted_text, extracted_at')
    .eq('id', materialId)
    .single();

  if (mErr || !material) return json({ error: 'Material not found or not accessible' }, 403);

  // 2. Authorization: only uploader or course instructor/admin can trigger extraction.
  //    RLS already limits reads, but a student enrolled in a course can read published
  //    materials — we must not let a student trigger costly re-extraction.
  const { data: roleRow } = await userClient
    .from('profiles')
    .select('role:roles(name)')
    .eq('id', user.id)
    .single();

  const roleName = (roleRow as { role?: { name?: string } } | null)?.role?.name?.toUpperCase();
  const isAdmin = roleName === 'ADMIN';

  const { data: course } = await userClient
    .from('courses')
    .select('instructor_id')
    .eq('id', material.course_id)
    .single();

  const isInstructorOfCourse = course?.instructor_id === user.id;

  if (!isAdmin && !isInstructorOfCourse) {
    return json({ error: 'Only the course instructor or an admin can extract this material' }, 403);
  }

  // 3. Idempotency: skip if already extracted unless forced.
  if (!force && material.extracted_text && material.extracted_text.trim().length > 0) {
    return json({
      materialId,
      skipped: true,
      reason: 'already_extracted',
      charCount: material.extracted_text.length,
    }, 200);
  }

  // 4. Dispatch by type. Unsupported types return a well-formed "not extractable"
  //    response so the client can display an honest state.
  let extracted: string | null = null;

  try {
    switch (material.type) {
      case 'TEXT':
        extracted = await readPlainText(adminClient, material);
        break;
      case 'PDF':
        extracted = await readPdf(adminClient, material);
        break;
      case 'DOCX':
        extracted = await readDocx(adminClient, material);
        break;
      case 'PPTX':
        extracted = await readPptx(adminClient, material);
        break;
      case 'LINK':
      case 'YOUTUBE':
      case 'IMAGE':
      case 'VIDEO':
        return json({
          materialId,
          skipped: true,
          reason: 'unsupported_type',
          type: material.type,
        }, 200);
      default:
        return json({ materialId, skipped: true, reason: 'unknown_type' }, 200);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Extraction failed';
    return json({ error: `Extraction failed: ${msg}` }, 502);
  }

  const cleaned = normalize(extracted);
  if (!cleaned || cleaned.length < 10) {
    return json({
      materialId,
      skipped: true,
      reason: 'empty_or_too_short',
      charCount: cleaned?.length ?? 0,
    }, 200);
  }

  // 5. Persist via service role. updated_at trigger handles itself.
  const { error: updErr } = await adminClient
    .from('materials')
    .update({
      extracted_text: cleaned,
      extracted_at: new Date().toISOString(),
    })
    .eq('id', materialId);

  if (updErr) return json({ error: updErr.message }, 500);

  return json({
    materialId,
    skipped: false,
    charCount: cleaned.length,
    type: material.type,
  }, 200);
});

/* ---------------- Format handlers ---------------- */

type MaterialRow = {
  id: string;
  type: string;
  title: string;
  course_id: string;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
};

async function downloadObject(admin: SupabaseClient, storagePath: string): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from(MATERIAL_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? 'Failed to download object');
  return new Uint8Array(await data.arrayBuffer());
}

async function readPlainText(admin: SupabaseClient, m: MaterialRow): Promise<string> {
  // TEXT materials may be stored as a file OR (in future) as raw content.
  // Today the schema has no `content` column on materials, so we always
  // read the file. If storage_path is null but external_url is a data:
  // or blob: URL, refuse — those are not text we can trust.
  if (!m.storage_path) {
    throw new Error('TEXT material has no storage_path');
  }
  const bytes = await downloadObject(admin, m.storage_path);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

async function readPdf(admin: SupabaseClient, m: MaterialRow): Promise<string> {
  if (!m.storage_path) throw new Error('PDF material has no storage_path');
  const bytes = await downloadObject(admin, m.storage_path);
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return text;
}

async function readDocx(admin: SupabaseClient, m: MaterialRow): Promise<string> {
  if (!m.storage_path) throw new Error('DOCX material has no storage_path');
  const bytes = await downloadObject(admin, m.storage_path);
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
  return htmlToText(result.value);
}

async function readPptx(admin: SupabaseClient, m: MaterialRow): Promise<string> {
  if (!m.storage_path) throw new Error('PPTX material has no storage_path');
  const bytes = await downloadObject(admin, m.storage_path);
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });

  const parser = new XMLParser({
    ignoreAttributes: true,
    preserveOrder: false,
    textNodeName: '#text',
  });

  const chunks: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async('string');
    const parsed = parser.parse(xml);
    const texts = collectAText(parsed);
    if (texts.length) chunks.push(texts.join(' '));
  }
  return chunks.join('\n\n');
}

/**
 * PPTX slide XML nests text runs as <a:t>…</a:t>.
 * The XML parser flattens elements; we walk the tree looking for that key.
 */
function collectAText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectAText(child, out);
    return out;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'a:t') {
        if (typeof value === 'string') out.push(value);
        else if (value && typeof value === 'object' && '#text' in value) {
          const t = (value as { '#text'?: unknown })['#text'];
          if (typeof t === 'string') out.push(t);
        }
      } else {
        collectAText(value, out);
      }
    }
  }
  return out;
}

/* ---------------- Helpers ---------------- */

function htmlToText(html: string): string {
  // Strip tags, decode a few common entities, collapse whitespace.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalize(text: string | null): string | null {
  if (!text) return null;
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}