// src/services/enrollments.ts
import { supabase } from '@/lib/supabase';
import type { Enrollment, EnrollmentStatus } from '@/types/app';

export async function listMyEnrollments(): Promise<Enrollment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', user.id);
  if (error) throw error;
  return data ?? [];
}

export async function enrollInCourse(
  courseId: string,
  enrollmentKey?: string,
): Promise<Enrollment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // If course requires a key, verify it (course row is readable if PUBLISHED).
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('id, status, enrollment_key')
    .eq('id', courseId)
    .single();
  if (courseErr) throw courseErr;
  if (course.status !== 'PUBLISHED') {
    throw new Error('This course is not open for enrollment.');
  }
  if (course.enrollment_key && course.enrollment_key !== enrollmentKey) {
    throw new Error('Invalid enrollment key.');
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert({ course_id: courseId, student_id: user.id, status: 'ACTIVE' })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You are already enrolled.');
    throw error;
  }
  return data;
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
): Promise<void> {
  const patch: { status: EnrollmentStatus; completed_at?: string | null } = { status };
  if (status === 'COMPLETED') patch.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from('enrollments')
    .update(patch)
    .eq('id', enrollmentId);
  if (error) throw error;
}

export async function listCourseRoster(courseId: string) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      student:profiles!enrollments_student_id_fkey (
        id, first_name, last_name, email, avatar_url
      )
    `)
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}