// src/services/progress.ts
import { supabase } from '@/lib/supabase';
import type { Progress, ProgressStatus } from '@/types/app';

export async function getCourseProgress(
  courseId: string,
): Promise<{ completed: number; total: number; percent: number; rows: Progress[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { completed: 0, total: 0, percent: 0, rows: [] };

  const { count: totalLessons, error: cErr } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('is_published', true);
  if (cErr) throw cErr;

  const { data: rows, error } = await supabase
    .from('progress')
    .select('*')
    .eq('course_id', courseId)
    .eq('student_id', user.id);
  if (error) throw error;

  const completed = (rows ?? []).filter((r) => r.status === 'COMPLETED').length;
  const total = totalLessons ?? 0;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    rows: rows ?? [],
  };
}

/** The current student's progress row for one lesson, or null. */
export async function getLessonProgress(
  courseId: string,
  lessonId: string,
): Promise<Progress | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function markLessonProgress(params: {
  courseId: string;
  lessonId: string;
  enrollmentId: string;
  status: ProgressStatus;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const completedAt = params.status === 'COMPLETED' ? new Date().toISOString() : null;

  // The unique index is progress_student_id_lesson_id_key on
  // (student_id, lesson_id) — see 02_courses.sql.
  const { error } = await supabase.from('progress').upsert(
    {
      course_id: params.courseId,
      lesson_id: params.lessonId,
      enrollment_id: params.enrollmentId,
      student_id: user.id,
      status: params.status,
      completed_at: completedAt,
    },
    { onConflict: 'student_id,lesson_id' },
  );
  if (error) throw error;
}