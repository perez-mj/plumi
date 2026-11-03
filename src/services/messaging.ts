// src/services/messaging.ts
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export interface ConversationSummary {
  id: string;
  title: string | null;
  type: 'DIRECT' | 'COURSE' | 'GROUP';
  course_id: string | null;
  updated_at: string;
}

export interface PersonSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
}

export async function listMyConversations(): Promise<ConversationSummary[]> {
  const auth = useAuthStore();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      conversations!inner ( id, title, type, course_id, updated_at )
    `)
    .eq('user_id', me);
  if (error) throw error;

  const rows = (data ?? [])
    .map((row) => {
      const c = (row as { conversations: ConversationSummary | ConversationSummary[] }).conversations;
      return Array.isArray(c) ? c[0] : c;
    })
    .filter(Boolean) as ConversationSummary[];

  rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return rows;
}

export async function openDirectConversation(otherUserId: string): Promise<string> {
  const auth = useAuthStore();
  const me = auth.user?.id;
  if (!me) throw new Error('Not authenticated.');
  if (me === otherUserId) throw new Error('You cannot message yourself.');

  // 1. Reuse an existing DIRECT conversation between me and this user.
  const { data: mine, error: e1 } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner ( id, type )')
    .eq('user_id', me);
  if (e1) throw e1;

  const directIds = (mine ?? [])
    .filter((r) => {
      const c = (r as { conversations: { type: string } | { type: string }[] }).conversations;
      const conv = Array.isArray(c) ? c[0] : c;
      return conv?.type === 'DIRECT';
    })
    .map((r) => r.conversation_id);

  if (directIds.length) {
    const { data: theirs, error: e2 } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', directIds);
    if (e2) throw e2;
    if (theirs?.length) return theirs[0].conversation_id;
  }

  // 2. Create the conversation row (creator is the current user).
  const { data: conv, error: e3 } = await supabase
    .from('conversations')
    .insert({ type: 'DIRECT', created_by: me })
    .select('id')
    .single();
  if (e3) throw e3;

  // 3. Add myself first — this satisfies `is_conversation_member` for the next insert.
  const { error: e4 } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conv.id, user_id: me });
  if (e4) throw e4;

  // 4. Now add the other user. RLS check passes because
  //    `is_conversation_member(conversation_id)` is true for auth.uid().
  const { error: e5 } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conv.id, user_id: otherUserId });
  if (e5) throw e5;

  return conv.id;
}

export async function openCourseConversation(courseId: string): Promise<string> {
  const auth = useAuthStore();
  const me = auth.user?.id;
  if (!me) throw new Error('Not authenticated.');

  // 1. Reuse existing COURSE conversation for this course
  //    (unique constraint guarantees at most one).
  const { data: existing, error: e1 } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'COURSE')
    .eq('course_id', courseId)
    .maybeSingle();
  if (e1) throw e1;

  if (existing) {
    // Ensure I'm a member (idempotent). If I'm already a member this is a no-op.
    const { error: mErr } = await supabase
      .from('conversation_members')
      .upsert(
        { conversation_id: existing.id, user_id: me },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      );
    if (mErr) throw mErr;
    return existing.id;
  }

  // 2. Load the course to get its title and instructor.
  const { data: course, error: cErr } = await supabase
    .from('courses')
    .select('title, instructor_id')
    .eq('id', courseId)
    .single();
  if (cErr) throw cErr;

  // 3. Create the conversation.
  const { data: conv, error: e3 } = await supabase
    .from('conversations')
    .insert({
      type: 'COURSE',
      course_id: courseId,
      title: course.title,
      created_by: me,
    })
    .select('id')
    .single();
  if (e3) throw e3;

  // 4. Add myself first.
  const { error: e4 } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conv.id, user_id: me });
  if (e4) throw e4;

  // 5. Add the instructor if they're not already me.
  if (course.instructor_id !== me) {
    const { error: e5 } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: conv.id, user_id: course.instructor_id });
    if (e5) throw e5;
  }

  return conv.id;
}

export async function listMessageablePeople(search = ''): Promise<PersonSummary[]> {
  const auth = useAuthStore();
  const me = auth.user?.id;
  if (!me) return [];

  const { data: taught, error: e1 } = await supabase
    .from('courses')
    .select('id')
    .eq('instructor_id', me)
    .is('deleted_at', null);
  if (e1) throw e1;

  const { data: enrolled, error: e2 } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', me)
    .eq('status', 'ACTIVE');
  if (e2) throw e2;

  const courseIds = Array.from(
    new Set([
      ...(taught ?? []).map((c) => c.id),
      ...(enrolled ?? []).map((e) => e.course_id),
    ]),
  );
  if (!courseIds.length) return [];

  const { data: courseInstructors, error: e3 } = await supabase
    .from('courses')
    .select('instructor_id')
    .in('id', courseIds);
  if (e3) throw e3;

  const { data: enrollees, error: e4 } = await supabase
    .from('enrollments')
    .select('student_id')
    .in('course_id', courseIds)
    .eq('status', 'ACTIVE');
  if (e4) throw e4;

  const ids = new Set<string>();
  for (const c of courseInstructors ?? []) ids.add(c.instructor_id);
  for (const e of enrollees ?? []) ids.add(e.student_id);
  ids.delete(me);
  if (!ids.size) return [];

  let q = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, avatar_url')
    .in('id', Array.from(ids))
    .eq('is_active', true)
    .order('first_name', { ascending: true });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PersonSummary[];
}