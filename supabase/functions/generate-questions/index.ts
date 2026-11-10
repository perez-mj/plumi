// supabase/functions/generate-questions/index.ts
import { GoogleGenAI, Type } from 'npm:@google/genai';
import { createClient } from 'npm:@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY')! });

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // 1. Verify caller
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // 2. Parse + validate body
  let body: { materialId?: string; questionCount?: number; detailLevel?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const materialId = body.materialId;
  const questionCount = Math.min(Math.max(body.questionCount ?? 10, 3), 30);
  const detailLevel = body.detailLevel ?? 'STANDARD';
  if (!materialId) return json({ error: 'materialId is required' }, 400);

  // 3. Fetch material via the caller's session — RLS enforces course access.
  const { data: material, error: mErr } = await supabase
    .from('materials')
    .select('id, title, extracted_text, course_id')
    .eq('id', materialId)
    .single();

  if (mErr || !material) return json({ error: 'Material not found or not accessible' }, 403);
  if (!material.extracted_text || material.extracted_text.trim().length < 50) {
    return json({ error: 'Material has no extracted text to generate from' }, 422);
  }

  // 4. Create the ai_requests row up front (PROCESSING) so failures are traceable.
  const { data: aiReq, error: reqErr } = await supabase
    .from('ai_requests')
    .insert({
      user_id: user.id,
      course_id: material.course_id,
      material_id: material.id,
      type: 'QUESTIONS',
      detail_level: detailLevel,
      status: 'PROCESSING',
      model: 'gemini-2.5-flash',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (reqErr || !aiReq) return json({ error: reqErr?.message ?? 'Failed to create ai_request' }, 500);

  try {
    const prompt = buildPrompt(material.title, material.extracted_text, questionCount, detailLevel);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: questionSchema,
        temperature: 0.7,
      },
    });

    const parsed = JSON.parse(response.text || '{}') as {
      questions?: Array<{
        question: string; choices: string[]; answer: string;
        explanation?: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      }>;
    };

    if (!parsed.questions?.length) throw new Error('Gemini returned no questions');

    // 5. Persist generation
    const { data: gen, error: genErr } = await supabase
      .from('material_generations')
      .insert({
        ai_request_id: aiReq.id,
        material_id: material.id,
        course_id: material.course_id,
        created_by: user.id,
        type: 'QUESTIONS',
        detail_level: detailLevel,
        title: `Practice: ${material.title}`,
        content: parsed as unknown as never,
        is_shared: true,
      })
      .select('id')
      .single();

    if (genErr || !gen) throw genErr ?? new Error('Failed to insert generation');

    const rows = parsed.questions.map((q, i) => ({
      generation_id: gen.id,
      type: 'MULTIPLE_CHOICE' as const,
      question: q.question,
      // Embed difficulty alongside options in the existing JSON column.
      choices: { options: q.choices, difficulty: q.difficulty ?? 'MEDIUM' },
      answer: q.answer,
      explanation: q.explanation ?? null,
      position: i,
    }));

    const { error: qErr } = await supabase.from('generated_questions').insert(rows);
    if (qErr) throw qErr;

    // 6. Mark request COMPLETED
    await supabase
      .from('ai_requests')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        prompt_tokens: response.usageMetadata?.promptTokenCount ?? null,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? null,
      })
      .eq('id', aiReq.id);

    return json({ generationId: gen.id, questionCount: rows.length }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Generation failed';
    await supabase
      .from('ai_requests')
      .update({ status: 'FAILED', error_message: msg, completed_at: new Date().toISOString() })
      .eq('id', aiReq.id);
    return json({ error: msg }, 502);
  }
});

function buildPrompt(title: string, text: string, count: number, detail: string): string {
  return `Generate ${count} multiple-choice practice questions from the material below.
Title: ${title}
Detail level: ${detail}

Rules:
- Each question has exactly 4 options and exactly one correct answer.
- Include a short explanation for the correct answer.
- Assign a difficulty: EASY, MEDIUM, or HARD. Aim for a mix.
- Do not reference "the material" or "the passage" in the question text.

Content:
${text.slice(0, 14000)}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}