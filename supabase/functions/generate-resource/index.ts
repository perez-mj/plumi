// supabase/functions/generate-resource/index.ts
import { GoogleGenAI, Type } from 'npm:@google/genai';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js';

const ai = new GoogleGenAI({
  apiKey: Deno.env.get('GEMINI_API_KEY')!,
  apiVersion: 'v1beta',
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');

type GenerationType = 'SUMMARY' | 'REVIEWER' | 'FLASHCARDS' | 'QUESTIONS' | 'STUDY_GUIDE';
type DetailLevel = 'SHORT' | 'STANDARD' | 'COMPREHENSIVE';

const ALLOWED_TYPES: GenerationType[] = ['SUMMARY', 'REVIEWER', 'FLASHCARDS', 'QUESTIONS', 'STUDY_GUIDE'];
const ALLOWED_DETAILS: DetailLevel[] = ['SHORT', 'STANDARD', 'COMPREHENSIVE'];

const MODEL = 'gemini-3.5-flash-lite';
const SOURCE_TEXT_LIMIT = 14_000;

/* ---------------- Gemini response schemas ---------------- */

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question:    { type: Type.STRING },
          choices:     { type: Type.ARRAY, items: { type: Type.STRING } },
          answer:      { type: Type.STRING },
          explanation: { type: Type.STRING },
          difficulty:  { type: Type.STRING, enum: ['EASY', 'MEDIUM', 'HARD'] },
        },
        required: ['question', 'choices', 'answer', 'difficulty'],
      },
    },
  },
  required: ['questions'],
};

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    summary:    { type: Type.STRING },
    key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'key_points'],
};

const reviewerSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['heading', 'bullets'],
      },
    },
  },
  required: ['title', 'sections'],
};

const studyGuideSchema = {
  type: Type.OBJECT,
  properties: {
    title:      { type: Type.STRING },
    objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body:    { type: Type.STRING },
        },
        required: ['heading', 'body'],
      },
    },
  },
  required: ['title', 'objectives', 'sections'],
};

const flashcardSchema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back:  { type: Type.STRING },
        },
        required: ['front', 'back'],
      },
    },
  },
  required: ['cards'],
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* ---------------- Handler ---------------- */

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

  let body: {
    type?: string;
    materialId?: string;
    detailLevel?: string;
    options?: Record<string, unknown>;
  };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const type = (body.type ?? '').toUpperCase() as GenerationType;
  if (!ALLOWED_TYPES.includes(type)) return json({ error: 'Invalid type' }, 400);

  const materialId = body.materialId;
  if (!materialId) return json({ error: 'materialId is required' }, 400);

  const detailLevel = (body.detailLevel ?? 'STANDARD').toUpperCase() as DetailLevel;
  if (!ALLOWED_DETAILS.includes(detailLevel)) return json({ error: 'Invalid detailLevel' }, 400);

  const options = normalizeOptions(type, body.options);

  // 1. Read material via user client — RLS enforces course access.
  const { data: material, error: mErr } = await userClient
    .from('materials')
    .select('id, title, extracted_text, course_id')
    .eq('id', materialId)
    .single();

  if (mErr || !material) return json({ error: 'Material not found or not accessible' }, 403);
  if (!material.extracted_text || material.extracted_text.trim().length < 50) {
    return json({ error: 'Material has no extracted text to generate from' }, 422);
  }

  // 2. Create ai_requests row via service role.
  const { data: aiReq, error: reqErr } = await adminClient
    .from('ai_requests')
    .insert({
      user_id: user.id,
      course_id: material.course_id,
      material_id: material.id,
      type,
      detail_level: detailLevel,
      status: 'PROCESSING',
      model: MODEL,
      options: options as unknown as never,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (reqErr || !aiReq) return json({ error: reqErr?.message ?? 'Failed to create ai_request' }, 500);

  try {
    const result = await runGeneration(type, detailLevel, material, options);

    // 3. Persist generation.
    const { data: gen, error: genErr } = await adminClient
      .from('material_generations')
      .insert({
        ai_request_id: aiReq.id,
        material_id: material.id,
        course_id: material.course_id,
        created_by: user.id,
        type,
        detail_level: detailLevel,
        title: result.title,
        content: result.content as unknown as never,
        is_shared: true,
      })
      .select('id')
      .single();
    if (genErr || !gen) throw genErr ?? new Error('Failed to insert generation');

    // 4. Per-type child rows + terminal status + notification.
    if (type === 'QUESTIONS') {
      const rows = (result as QuestionsResult).rows.map((r, i) => ({
        generation_id: gen.id,
        type: 'MULTIPLE_CHOICE' as const,
        question: r.question,
        choices: { options: r.choices, difficulty: r.difficulty },
        answer: r.answer,
        explanation: r.explanation ?? null,
        position: i,
      }));
      const { error: qErr } = await adminClient.from('generated_questions').insert(rows);
      if (qErr) throw qErr;
      await markCompleted(adminClient, aiReq.id, result.usage);
      await notify(adminClient, {
        user_id: user.id,
        kind: 'COMPLETED',
        type,
        materialTitle: material.title,
        courseId: material.course_id,
        generationId: gen.id,
        aiRequestId: aiReq.id,
      });
      return json({ generationId: gen.id, type, count: rows.length }, 200);
    }

    if (type === 'FLASHCARDS') {
      const rows = (result as FlashcardsResult).rows.map((r, i) => ({
        generation_id: gen.id,
        question: r.front,
        answer: r.back,
        position: i,
      }));
      const { error: fErr } = await adminClient.from('flashcards').insert(rows);
      if (fErr) throw fErr;
      await markCompleted(adminClient, aiReq.id, result.usage);
      await notify(adminClient, {
        user_id: user.id,
        kind: 'COMPLETED',
        type,
        materialTitle: material.title,
        courseId: material.course_id,
        generationId: gen.id,
        aiRequestId: aiReq.id,
      });
      return json({ generationId: gen.id, type, count: rows.length }, 200);
    }

    // SUMMARY / REVIEWER / STUDY_GUIDE — content is enough.
    await markCompleted(adminClient, aiReq.id, result.usage);
    await notify(adminClient, {
      user_id: user.id,
      kind: 'COMPLETED',
      type,
      materialTitle: material.title,
      courseId: material.course_id,
      generationId: gen.id,
      aiRequestId: aiReq.id,
    });
    return json({ generationId: gen.id, type }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Generation failed';
    await adminClient
      .from('ai_requests')
      .update({ status: 'FAILED', error_message: msg, completed_at: new Date().toISOString() })
      .eq('id', aiReq.id);
    await notify(adminClient, {
      user_id: user.id,
      kind: 'FAILED',
      type,
      materialTitle: material.title,
      courseId: material.course_id,
      generationId: null,
      aiRequestId: aiReq.id,
    });
    return json({ error: msg }, 502);
  }
});

/* ---------------- Per-type dispatch ---------------- */

type MaterialRef = { id: string; title: string; extracted_text: string; course_id: string };
type Usage = { promptTokenCount?: number; candidatesTokenCount?: number };

interface QuestionsResult {
  title: string;
  content: { questions: unknown[] };
  rows: Array<{
    question: string; choices: string[]; answer: string;
    explanation?: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  }>;
  usage: Usage;
}
interface FlashcardsResult {
  title: string;
  content: { card_count: number };
  rows: Array<{ front: string; back: string }>;
  usage: Usage;
}
interface DocResult { title: string; content: unknown; usage: Usage; }

async function runGeneration(
  type: GenerationType,
  detail: DetailLevel,
  material: MaterialRef,
  options: Record<string, unknown>,
): Promise<QuestionsResult | FlashcardsResult | DocResult> {
  const source = material.extracted_text.slice(0, SOURCE_TEXT_LIMIT);

  switch (type) {
    case 'QUESTIONS': {
      const count = Number(options.question_count ?? 10);
      const prompt = questionsPrompt(material.title, source, count, detail);
      const res = await callGemini(prompt, questionSchema, 0.7);
      const parsed = safeJson<{ questions?: QuestionsResult['rows'] }>(res.text);
      if (!parsed.questions?.length) throw new Error('Gemini returned no questions');
      return {
        title: `Practice: ${material.title}`,
        content: { questions: parsed.questions },
        rows: parsed.questions,
        usage: res.usage,
      };
    }
    case 'FLASHCARDS': {
      const count = Number(options.card_count ?? 15);
      const prompt = flashcardsPrompt(material.title, source, count, detail);
      const res = await callGemini(prompt, flashcardSchema, 0.6);
      const parsed = safeJson<{ cards?: FlashcardsResult['rows'] }>(res.text);
      if (!parsed.cards?.length) throw new Error('Gemini returned no flashcards');
      return {
        title: `Flashcards: ${material.title}`,
        content: { card_count: parsed.cards.length },
        rows: parsed.cards,
        usage: res.usage,
      };
    }
    case 'SUMMARY': {
      const prompt = summaryPrompt(material.title, source, detail);
      const res = await callGemini(prompt, summarySchema, 0.4);
      const parsed = safeJson<{ summary?: string; key_points?: string[] }>(res.text);
      if (!parsed.summary) throw new Error('Gemini returned no summary');
      return {
        title: `Summary: ${material.title}`,
        content: { summary: parsed.summary, key_points: parsed.key_points ?? [] },
        usage: res.usage,
      };
    }
    case 'REVIEWER': {
      const prompt = reviewerPrompt(material.title, source, detail);
      const res = await callGemini(prompt, reviewerSchema, 0.5);
      const parsed = safeJson<{ title?: string; sections?: unknown[] }>(res.text);
      if (!parsed.sections?.length) throw new Error('Gemini returned no reviewer sections');
      return {
        title: parsed.title ?? `Reviewer: ${material.title}`,
        content: { title: parsed.title, sections: parsed.sections },
        usage: res.usage,
      };
    }
    case 'STUDY_GUIDE': {
      const prompt = studyGuidePrompt(material.title, source, detail);
      const res = await callGemini(prompt, studyGuideSchema, 0.5);
      const parsed = safeJson<{ title?: string; objectives?: string[]; sections?: unknown[] }>(res.text);
      if (!parsed.sections?.length) throw new Error('Gemini returned no study guide sections');
      return {
        title: parsed.title ?? `Study guide: ${material.title}`,
        content: {
          title: parsed.title,
          objectives: parsed.objectives ?? [],
          sections: parsed.sections,
        },
        usage: res.usage,
      };
    }
  }
}

/* ---------------- Gemini call ---------------- */

async function callGemini(prompt: string, schema: unknown, temperature: number) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
    },
  });
  return {
    text: res.text ?? '',
    usage: {
      promptTokenCount: res.usageMetadata?.promptTokenCount,
      candidatesTokenCount: res.usageMetadata?.candidatesTokenCount,
    },
  };
}

/* ---------------- Status / notification helpers ---------------- */

async function markCompleted(admin: SupabaseClient, reqId: string, usage: Usage) {
  await admin
    .from('ai_requests')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      prompt_tokens: usage.promptTokenCount ?? null,
      output_tokens: usage.candidatesTokenCount ?? null,
    })
    .eq('id', reqId);
}

interface NotifyArgs {
  user_id: string;
  kind: 'COMPLETED' | 'FAILED';
  type: GenerationType;
  materialTitle: string;
  courseId: string;
  generationId: string | null;
  aiRequestId: string;
}

async function notify(admin: SupabaseClient, args: NotifyArgs): Promise<void> {
  // Best-effort: a notification failure must not fail the generation.
  try {
    const humanType = args.type.replace(/_/g, ' ').toLowerCase();
    const isCompleted = args.kind === 'COMPLETED';
    await admin.from('notifications').insert({
      user_id: args.user_id,
      type: isCompleted ? 'AI_GENERATION_COMPLETED' : 'AI_GENERATION_FAILED',
      title: isCompleted ? 'AI generation completed' : 'AI generation failed',
      body: isCompleted
        ? `${humanType} is ready for "${args.materialTitle}"`
        : `Could not generate ${humanType} for "${args.materialTitle}"`,
      entity_type: isCompleted ? 'material_generation' : 'ai_request',
      entity_id: isCompleted ? args.generationId : args.aiRequestId,
      link: isCompleted && args.generationId
        ? `/student/courses/${args.courseId}/ai/${args.generationId}`
        : null,
    });
  } catch {
    // Swallow — the ai_requests row already records the outcome.
  }
}

/* ---------------- JSON parsing ---------------- */

function safeJson<T>(text: string): T {
  try { return JSON.parse(text || '{}') as T; }
  catch { throw new Error('Gemini returned invalid JSON'); }
}

/* ---------------- Prompt builders ---------------- */

function questionsPrompt(title: string, text: string, count: number, detail: DetailLevel): string {
  return `Generate ${count} multiple-choice practice questions from the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Each question has exactly 4 options and exactly one correct answer.
- Include a short explanation for the correct answer.
- Assign a difficulty: EASY, MEDIUM, or HARD. Aim for a mix.
- Do not reference "the material" or "the passage" in the question text.

Content:
${text}`;
}

function flashcardsPrompt(title: string, text: string, count: number, detail: DetailLevel): string {
  return `Generate ${count} flashcards from the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Each flashcard has a concise "front" (question, term, or prompt) and a "back" (answer or definition).
- Front must be answerable from the source alone.
- Keep each side short: front <= 200 chars, back <= 500 chars.
- Do not reference "the material" or "the passage".

Content:
${text}`;
}

function summaryPrompt(title: string, text: string, detail: DetailLevel): string {
  const lengthHint =
    detail === 'SHORT' ? 'about 3-5 sentences' :
    detail === 'COMPREHENSIVE' ? 'about 2-3 paragraphs' :
    'about 1 short paragraph';
  return `Summarize the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Summary should be ${lengthHint}.
- Provide 3-7 key points, each a single sentence.
- Do not reference "the material" or "the passage".

Content:
${text}`;
}

function reviewerPrompt(title: string, text: string, detail: DetailLevel): string {
  const sectionHint =
    detail === 'SHORT' ? '3-4 sections' :
    detail === 'COMPREHENSIVE' ? '6-10 sections' :
    '4-6 sections';
  return `Produce a structured reviewer (study review) from the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Return ${sectionHint}, each with a short heading and 3-8 bullet points.
- Bullets must be self-contained and factual.
- Order sections logically from foundational to advanced.
- Do not reference "the material" or "the passage".

Content:
${text}`;
}

function studyGuidePrompt(title: string, text: string, detail: DetailLevel): string {
  const sectionHint =
    detail === 'SHORT' ? '3-4 sections' :
    detail === 'COMPREHENSIVE' ? '6-10 sections' :
    '4-6 sections';
  return `Write a structured study guide from the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Return 3-6 learning objectives as short sentences.
- Return ${sectionHint}, each with a heading and 1-3 paragraphs of body.
- Include concrete examples where the source supports them.
- Do not reference "the material" or "the passage".

Content:
${text}`;
}

/* ---------------- Helpers ---------------- */

function normalizeOptions(type: GenerationType, raw: unknown): Record<string, unknown> {
  const opts = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  if (type === 'QUESTIONS') {
    const n = Number(opts.question_count ?? 10);
    return { question_count: Math.min(Math.max(Number.isFinite(n) ? n : 10, 3), 30) };
  }
  if (type === 'FLASHCARDS') {
    const n = Number(opts.card_count ?? 15);
    return { card_count: Math.min(Math.max(Number.isFinite(n) ? n : 15, 5), 50) };
  }
  return {};
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}