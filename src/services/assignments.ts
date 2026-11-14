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

export interface SubmissionWithFiles extends Submission {
  submission_files: SubmissionFile[];
}

export async function getMySubmission(
  assignmentId: string,
): Promise<SubmissionWithFiles | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('submissions')
    .select('*, submission_files(*)')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SubmissionWithFiles) ?? null;
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

interface SubmitContext {
  courseId: string;
  submissionId: string | null; // existing submission id, null if first submit
  existingFiles: string[];      // storage paths of files to delete on replace
}

async function loadSubmitContext(
  assignmentId: string,
): Promise<{ courseId: string; allowLate: boolean; dueAt: string | null; existing: SubmissionWithFiles | null }> {
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, course_id, allow_late, due_at')
    .eq('id', assignmentId)
    .single();
  if (aErr) throw aErr;

  const existing = await getMySubmission(assignmentId);
  return {
    courseId: assignment.course_id,
    allowLate: assignment.allow_late,
    dueAt: assignment.due_at,
    existing,
  };
}

async function deleteStorageObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  // Best-effort: a failed cleanup must not abort the new submission.
  const { error } = await supabase.storage.from(SUBMISSIONS_BUCKET).remove(paths);
  if (error) {
    // Surface in the console for diagnostics; do not re-throw.
    console.warn('[submissions] failed to remove stale files', error.message);
  }
}

export async function submitAssignment(params: {
  assignmentId: string;
  content?: string | null;
  files?: File[];
}): Promise<Submission> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { courseId, allowLate, dueAt, existing } = await loadSubmitContext(params.assignmentId);

  // Guard: a graded submission cannot be edited. RLS/trigger would reject
  // the write anyway, but the message would be cryptic.
  if (existing?.status === 'GRADED') {
    throw new Error('This submission has been graded and can no longer be edited.');
  }

  const now = new Date();
  const isLate = dueAt ? now > new Date(dueAt) : false;
  if (isLate && !allowLate) {
    throw new Error('The deadline has passed and late submissions are not allowed.');
  }

  const newStatus = isLate ? 'LATE' : 'SUBMITTED';

  // Upsert the submission row first so we have an id for the storage path.
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .upsert(
      {
        assignment_id: params.assignmentId,
        student_id: user.id,
        content: params.content ?? null,
        status: newStatus,
        submitted_at: now.toISOString(),
      },
      { onConflict: 'assignment_id,student_id' },
    )
    .select('*')
    .single();
  if (subErr) throw subErr;

  const uploadedPaths: string[] = [];
  const insertedFileIds: string[] = [];
  const replacedPaths = params.files?.length
    ? (existing?.submission_files ?? []).map((f) => f.storage_path)
    : [];

  try {
    // Replace-on-resubmit: if the student is sending a new set of files,
    // remove the previous DB rows and storage objects first.
    if (replacedPaths.length) {
      const oldFileIds = (existing?.submission_files ?? []).map((f) => f.id);
      if (oldFileIds.length) {
        const { error: delErr } = await supabase
          .from('submission_files')
          .delete()
          .in('id', oldFileIds);
        if (delErr) throw delErr;
      }
      await deleteStorageObjects(replacedPaths);
    }

    if (params.files?.length) {
      for (const file of params.files) {
        const storagePath =
          `${courseId}/${submission.id}/${crypto.randomUUID()}-${file.name}`;

        const { error: upErr } = await supabase.storage
          .from(SUBMISSIONS_BUCKET)
          .upload(storagePath, file, { 
            contentType: file.type ,
            upsert: false,
          });
        if (upErr) throw upErr;
        uploadedPaths.push(storagePath);

        const { data: fileRow, error: metaErr } = await supabase
          .from('submission_files')
          .insert({
            submission_id: submission.id,
            filename: file.name,
            mime_type: file.type,
            size: file.size,
            storage_path: storagePath,
          })
          .select('id')
          .single();
        if (metaErr) throw metaErr;
        insertedFileIds.push(fileRow.id);
      }
    }
  } catch (err) {
    // Rollback: drop anything we created this attempt, and re-create the
    // old file rows we removed if we had to swap. Storage removal is
    // best-effort — the DB is the source of truth for the UI.
    if (insertedFileIds.length) {
      await supabase.from('submission_files').delete().in('id', insertedFileIds);
    }
    await deleteStorageObjects(uploadedPaths);
    if (replacedPaths.length) {
      const oldRows = (existing?.submission_files ?? []).map((f) => ({
        submission_id: submission.id,
        filename: f.filename,
        mime_type: f.mime_type,
        size: f.size,
        storage_path: f.storage_path,
      }));
      if (oldRows.length) {
        // Best-effort restore. If this fails, the student can resubmit.
        await supabase.from('submission_files').insert(oldRows);
      }
    }
    throw err;
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

export async function deleteSubmissionFile(fileId: string, storagePath: string): Promise<void> {
  const { error: dbErr } = await supabase
    .from('submission_files')
    .delete()
    .eq('id', fileId);
  if (dbErr) throw dbErr;
  await deleteStorageObjects([storagePath]);
}