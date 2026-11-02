// src/services/progress.ts
import { supabase } from '@/lib/supabase';
import type { Progress, ProgressStatus } from '@/types/app';

export async function getCourseProgress(
  courseId: string,
): Promise<{ completed: number; total: number; percent: number; rows: Progress[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { completed: 0, total: 0, percent: 0, rows: [] };

  // Count published lessons in course
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

export async function markLessonProgress(params: {
  courseId: string;
  lessonId: string;
  enrollmentId: string;
  status: ProgressStatus;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const completedAt = params.status === 'COMPLETED' ? new Date().toISOString() : null;

  const { error } = await supabase.from('progress').upsert(
    {
      course_id: params.courseId,
      lesson_id: params.lessonId,
      enrollment_id: params.enrollmentId,
      student_id: user.id,
      status: params.status,
      completed_at: completedAt,
    },
    { onConflict: 'course_id,lesson_id,student_id' },
  );
  if (error) throw error;
}