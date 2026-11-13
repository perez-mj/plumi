// src/services/enrollments.ts
import { supabase } from '@/lib/supabase';
import type { Enrollment, EnrollmentStatus, CourseWithMeta } from '@/types/app';
import type { CourseStatus } from '@/types/app';

const COURSE_SELECT = `
  *,
  category:categories ( id, name, slug ),
  instructor:profiles!courses_instructor_id_fkey (
    id, first_name, last_name, avatar_url
  )
`;

/** List the current user's enrollments. */
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

/** The current user's enrollment for a single course, or null. */
export async function getMyEnrollmentForCourse(
  courseId: string,
): Promise<Enrollment | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Enroll the current user in a course.
 * The enrollment key (when required) is verified server-side.
 */
export async function enrollInCourse(
  courseId: string,
  enrollmentKey?: string,
): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('enroll_in_course', {
    p_course_id: courseId,
    p_enrollment_key: enrollmentKey?.trim() || null,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('not_authenticated')) throw new Error('Please sign in again.');
    if (msg.includes('course_not_found')) throw new Error('Course not found.');
    if (msg.includes('course_not_published')) throw new Error('This course is not open for enrollment.');
    if (msg.includes('invalid_enrollment_key')) throw new Error('Invalid enrollment key.');
    if (msg.includes('already_enrolled')) throw new Error('You are already enrolled.');
    throw new Error(error.message || 'Failed to enroll.');
  }

  return data as Enrollment;
}

/** Withdraw the current user's enrollment from a course. */
export async function withdrawFromCourse(courseId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('enrollments')
    .update({ status: 'DROPPED' })
    .eq('student_id', user.id)
    .eq('course_id', courseId);
  if (error) throw error;
}

/** List courses the current user is enrolled in (ACTIVE by default). */
export async function listMyEnrolledCourses(
  opts: { includeDropped?: boolean } = {},
): Promise<CourseWithMeta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('enrollments')
    .select(`
      status,
      course:courses!enrollments_course_id_fkey (
        ${COURSE_SELECT}
      )
    `)
    .eq('student_id', user.id);

  if (!opts.includeDropped) {
    query = query.eq('status', 'ACTIVE');
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter out soft-deleted courses and unwrap the join.
  return (data ?? [])
    .map((row) => row.course as unknown as CourseWithMeta | null)
    .filter((c): c is CourseWithMeta => !!c && !c.deleted_at);
}

/** Instructor/admin: course roster with student profiles. */
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

/** Instructor/admin: update an arbitrary enrollment's status (e.g. mark COMPLETED). */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
): Promise<void> {
  const patch: { status: EnrollmentStatus; completed_at?: string | null } = { status };
  if (status === 'COMPLETED') patch.completed_at = new Date().toISOString();
  if (status !== 'COMPLETED') patch.completed_at = null;

  const { error } = await supabase
    .from('enrollments')
    .update(patch)
    .eq('id', enrollmentId);
  if (error) throw error;
}