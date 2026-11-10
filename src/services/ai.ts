// src/services/ai.ts
import { supabase } from '@/lib/supabase';
import type {
  Difficulty,
  GamificationSettings,
  GeneratedQuestion,
  Material,
  MaterialGeneration,
  QuestionChoices,
  QuestionSessionAnswer,
  QuestionSessionResult,
  SessionDraftAnswer,
} from '@/types/app';

/* ---------------- Materials eligible for AI ---------------- */

export async function listGeneratableMaterials(courseId: string): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .not('extracted_text', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ---------------- Generation ---------------- */

export interface GenerateQuestionsParams {
  materialId: string;
  questionCount?: number;
  detailLevel?: 'SHORT' | 'STANDARD' | 'COMPREHENSIVE';
}

export async function generateQuestions(
  params: GenerateQuestionsParams,
): Promise<{ generationId: string; questionCount: number }> {
  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: params,
  });
  if (error) throw error;
  if (!data?.generationId) throw new Error(data?.error ?? 'Generation failed');
  return data;
}

export async function listMyGenerations(courseId?: string): Promise<MaterialGeneration[]> {
  let q = supabase
    .from('material_generations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getGeneration(generationId: string): Promise<MaterialGeneration> {
  const { data, error } = await supabase
    .from('material_generations')
    .select('*')
    .eq('id', generationId)
    .single();
  if (error) throw error;
  return data;
}

/* ---------------- Questions ---------------- */

export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string | null;
  difficulty: Difficulty;
  position: number;
}

export async function listGenerationQuestions(
  generationId: string,
): Promise<PracticeQuestion[]> {
  const { data, error } = await supabase
    .from('generated_questions')
    .select('*')
    .eq('generation_id', generationId)
    .order('position', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row): PracticeQuestion => {
    const parsed = parseChoices(row.choices);
    return {
      id: row.id,
      question: row.question,
      options: parsed.options,
      difficulty: parsed.difficulty,
      answer: row.answer,
      explanation: row.explanation,
      position: row.position,
    };
  });
}

function parseChoices(raw: unknown): { options: string[]; difficulty: Difficulty } {
  // New shape: { options: string[], difficulty: Difficulty }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Partial<QuestionChoices>;
    if (Array.isArray(obj.options)) {
      return {
        options: obj.options.map(String),
        difficulty: (obj.difficulty ?? 'MEDIUM') as Difficulty,
      };
    }
  }
  // Legacy shape: plain string[]
  if (Array.isArray(raw)) {
    return { options: raw.map(String), difficulty: 'MEDIUM' };
  }
  return { options: [], difficulty: 'MEDIUM' };
}

/* ---------------- Gamification settings ---------------- */

const FALLBACK_GAMIFICATION: GamificationSettings = {
  enabled: true,
  base_points: { EASY: 10, MEDIUM: 20, HARD: 30 },
  combo_thresholds: { '2': 5, '3': 10 },
  combo_cap: 3,
  completion_bonus: 5,
  time_bonus_enabled: false,
};

export async function getGamificationSettings(): Promise<GamificationSettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gamification.defaults')
    .maybeSingle();
  if (error || !data?.value) return FALLBACK_GAMIFICATION;
  return { ...FALLBACK_GAMIFICATION, ...(data.value as Partial<GamificationSettings>) };
}

/* ---------------- Session persistence ---------------- */

export interface CompleteSessionParams {
  generationId: string;
  score: number;
  accuracy: number;
  longestStreak: number;
  durationSeconds: number;
  answers: SessionDraftAnswer[];
}

export async function completeQuestionSession(
  params: CompleteSessionParams,
): Promise<QuestionSessionResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: session, error: sErr } = await supabase
    .from('question_session_results')
    .insert({
      user_id: user.id,
      generation_id: params.generationId,
      score: params.score,
      accuracy: params.accuracy,
      longest_streak: params.longestStreak,
      duration_seconds: params.durationSeconds,
    })
    .select('*')
    .single();
  if (sErr) throw sErr;

  if (params.answers.length) {
    const rows = params.answers.map((a) => ({
      session_id: session.id,
      question_id: a.questionId,
      is_correct: a.isCorrect,
      time_taken_seconds: a.timeTaken,
    }));
    const { error: aErr } = await supabase.from('question_session_answers').insert(rows);
    if (aErr) throw aErr;
  }

  return session;
}

export async function listMySessionResults(
  generationId: string,
): Promise<QuestionSessionResult[]> {
  const { data, error } = await supabase
    .from('question_session_results')
    .select('*')
    .eq('generation_id', generationId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSessionAnswers(
  sessionId: string,
): Promise<QuestionSessionAnswer[]> {
  const { data, error } = await supabase
    .from('question_session_answers')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data ?? [];
}