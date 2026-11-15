// src/services/meetings.ts
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/types/database.types';

type MeetingRow = Database['public']['Tables']['meetings']['Row'];
export type { MeetingRow };

export interface CreateMeetingInput {
  course_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration: number;
}

export interface MeetingAttendanceRow {
  user_id: string;
  first_name: string;
  last_name: string;
  joined_at: string;
  left_at: string | null;
  duration_sec: number | null;
}

/** Meetings visible to the current user: taught courses + active enrollments. */
export async function listMyMeetings(): Promise<MeetingRow[]> {
  const auth = useAuthStore();
  const uid = auth.user?.id;
  if (!uid) return [];

  const { data: taught, error: e1 } = await supabase
    .from('courses')
    .select('id')
    .eq('instructor_id', uid)
    .is('deleted_at', null);
  if (e1) throw e1;

  const { data: enrolled, error: e2 } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', uid)
    .eq('status', 'ACTIVE');
  if (e2) throw e2;

  const courseIds = [
    ...(taught ?? []).map((c) => c.id),
    ...(enrolled ?? []).map((e) => e.course_id),
  ];
  if (!courseIds.length) return [];

  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .in('course_id', courseIds)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMeeting(id: string): Promise<MeetingRow> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMeeting(input: CreateMeetingInput): Promise<MeetingRow> {
  const auth = useAuthStore();
  if (!auth.user) throw new Error('Not authenticated.');

  // Room name is hard to guess. Authorization for JOIN is enforced below and in RLS.
  const roomName = `plumi-${crypto.randomUUID()}`;

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      ...input,
      room_name: roomName,
      host_id: auth.user.id,
      status: 'SCHEDULED',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verifies the current user can join, then records attendance idempotently:
 *  - If the user already has an OPEN attendance row for this meeting, reuse it.
 *  - Otherwise insert a new row.
 * Relies on the partial unique index (meeting_id, user_id) WHERE left_at IS NULL
 * to make concurrent double-calls safe.
 */
export async function joinMeeting(meetingId: string): Promise<{ room_name: string }> {
  const auth = useAuthStore();
  if (!auth.user) throw new Error('Not authenticated.');

  const meeting = await getMeeting(meetingId);
  if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
    throw new Error('This meeting is no longer available.');
  }

  // Server-side check duplicated here only for a friendly message;
  // RLS is the real boundary.
  const { data: course, error: cErr } = await supabase
    .from('courses')
    .select('id, instructor_id')
    .eq('id', meeting.course_id)
    .single();
  if (cErr) throw cErr;

  let authorized = course.instructor_id === auth.user.id;
  if (!authorized) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', meeting.course_id)
      .eq('student_id', auth.user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    authorized = !!enrollment;
  }
  if (!authorized) throw new Error('You are not enrolled in this course.');

  // Idempotent attendance: try insert; on unique violation, reuse open row.
  const { error: insErr } = await supabase
    .from('meeting_attendances')
    .insert({ meeting_id: meetingId, user_id: auth.user.id });

  if (insErr) {
    // 23505 = unique_violation → an open row already exists. That's fine.
    if ((insErr as { code?: string }).code !== '23505') {
      // Best-effort: don't block the meeting if logging fails.
      console.warn('[meetings] attendance insert failed', insErr);
    }
  }

  // Host starting the room implicitly marks it LIVE.
  if (course.instructor_id === auth.user.id && meeting.status === 'SCHEDULED') {
    await supabase.rpc('meeting_start', { p_meeting_id: meetingId });
  }

  return { room_name: meeting.room_name };
}

/** Closes ALL open attendance rows for the current user in this meeting. */
export async function leaveMeeting(meetingId: string): Promise<void> {
  const auth = useAuthStore();
  if (!auth.user) return;
  await supabase
    .from('meeting_attendances')
    .update({ left_at: new Date().toISOString() })
    .eq('meeting_id', meetingId)
    .eq('user_id', auth.user.id)
    .is('left_at', null);
}

/** Host/instructor: end meeting and close everyone's open rows. */
export async function endMeeting(meetingId: string): Promise<void> {
  await supabase.rpc('meeting_end', { p_meeting_id: meetingId });
}

/**
 * Instructor/admin: list attendance for a meeting.
 *
 * Note: the RPC's return shape is validated structurally rather than cast
 * blindly, so regenerated types that drop or rename a column fail loudly here
 * instead of silently producing `undefined` fields in the UI.
 */
export async function listMeetingAttendance(
  meetingId: string,
): Promise<MeetingAttendanceRow[]> {
  const { data, error } = await supabase.rpc('meeting_attendance_list', {
    p_meeting_id: meetingId,
  });
  if (error) throw error;
  if (!data) return [];

  return (data as unknown[]).map((row): MeetingAttendanceRow => {
    const r = row as Record<string, unknown>;
    return {
      user_id: String(r.user_id),
      first_name: String(r.first_name ?? ''),
      last_name: String(r.last_name ?? ''),
      joined_at: String(r.joined_at),
      left_at: r.left_at == null ? null : String(r.left_at),
      duration_sec:
        r.duration_sec == null ? null : Number(r.duration_sec),
    };
  });
}