// src/services/assignments.ts
import { supabase } from '@/lib/supabase';
import type { Assignment, Submission, SubmissionFile } from '@/types/app';

export const SUBMISSIONS_BUCKET = 'assignment-submissions';

export interface AssignmentWithStats extends Assignment {
  submission_count?: number;
  my_submission?: Submission | null;
}

export async function listAssignmentsForCourse(courseId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyUpcomingAssignments(): Promise<Assignment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('assignments')
    .select('*, courses!inner ( id, title )')
    .eq('is_published', true)
    .is('deleted_at', null)
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as unknown as Assignment[];
}

export async function getAssignment(assignmentId: string): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();
  if (error) throw error;
  return data;
}

export async function createAssignment(input: {
  course_id: string;
  module_id?: string | null;
  title: string;
  instructions?: string | null;
  due_at?: string | null;
  max_score?: number;
  allow_late?: boolean;
  is_published?: boolean;
}): Promise<Assignment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('assignments')
    .insert({ ...input, created_by: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAssignment(
  assignmentId: string,
  input: Partial<Assignment>,
): Promise<void> {
  const { error } = await supabase.from('assignments').update(input).eq('id', assignmentId);
  if (error) throw error;
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', assignmentId);
  if (error) throw error;
}

/* ---------------- Submissions ---------------- */

export async function getMySubmission(assignmentId: string): Promise<Submission | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('submissions')
    .select('*, submission_files(*)')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Submission) ?? null;
}

export async function listSubmissionsForAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      submission_files ( * ),
      student:profiles!submissions_student_id_fkey (
        id, first_name, last_name, email, avatar_url
      )
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitAssignment(params: {
  assignmentId: string;
  content?: string | null;
  files?: File[];
}): Promise<Submission> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, course_id, allow_late, due_at')
    .eq('id', params.assignmentId)
    .single();
  if (aErr) throw aErr;

  const now = new Date();
  const isLate = assignment.due_at ? now > new Date(assignment.due_at) : false;
  if (isLate && !assignment.allow_late) {
    throw new Error('The deadline has passed and late submissions are not allowed.');
  }

  // Upsert the submission row
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .upsert(
      {
        assignment_id: params.assignmentId,
        student_id: user.id,
        content: params.content ?? null,
        status: isLate ? 'LATE' : 'SUBMITTED',
        submitted_at: now.toISOString(),
      },
      { onConflict: 'assignment_id,student_id' },
    )
    .select('*')
    .single();
  if (subErr) throw subErr;

  // Upload files
  if (params.files?.length) {
    for (const file of params.files) {
      const storagePath = `${assignment.course_id}/${submission.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(SUBMISSIONS_BUCKET)
        .upload(storagePath, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: metaErr } = await supabase.from('submission_files').insert({
        submission_id: submission.id,
        filename: file.name,
        mime_type: file.type,
        size: file.size,
        storage_path: storagePath,
      });
      if (metaErr) throw metaErr;
    }
  }

  return submission;
}

export async function gradeSubmission(params: {
  submissionId: string;
  score: number;
  feedback?: string | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('submissions')
    .update({
      score: params.score,
      feedback: params.feedback ?? null,
      status: 'GRADED',
      graded_at: new Date().toISOString(),
      graded_by: user.id,
    })
    .eq('id', params.submissionId);
  if (error) throw error;
}

export async function getSubmissionFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}