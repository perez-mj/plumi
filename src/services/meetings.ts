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
 * Verifies the current user is authorized to join a meeting, records attendance,
 * and returns the trusted room name.
 *
 * The room name is NEVER read from the client URL — only from the meeting row.
 */
export async function joinMeeting(meetingId: string): Promise<{ room_name: string }> {
  const auth = useAuthStore();
  if (!auth.user) throw new Error('Not authenticated.');

  const meeting = await getMeeting(meetingId);
  if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
    throw new Error('This meeting is no longer available.');
  }

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

  // Attendance — best-effort. Don't block the meeting if logging fails.
  await supabase
    .from('meeting_attendances')
    .insert({ meeting_id: meetingId, user_id: auth.user.id });

  return { room_name: meeting.room_name };
}

export async function leaveMeeting(meetingId: string): Promise<void> {
  const auth = useAuthStore();
  if (!auth.user) return;
  // Update the most recent open attendance row for this user/meeting.
  const { data } = await supabase
    .from('meeting_attendances')
    .select('id')
    .eq('meeting_id', meetingId)
    .eq('user_id', auth.user.id)
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from('meeting_attendances')
    .update({ left_at: new Date().toISOString() })
    .eq('id', data.id);
}