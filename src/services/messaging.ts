import { supabase } from '@/lib/supabase';
import { messagingClient } from '@/lib/messagingClient';
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
  const me = useAuthStore().user?.id;

  if (!me) return [];

  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      conversations!inner (
        id,
        title,
        type,
        course_id,
        updated_at
      )
    `)
    .eq('user_id', me);

  if (error) throw error;

  const conversations: ConversationSummary[] = (data ?? []).flatMap((row) => {
    const conversation = row.conversations;

    if (!conversation) return [];

    return Array.isArray(conversation)
      ? conversation
      : [conversation];
  });

  const directIds = conversations
    .filter((conversation) => conversation.type === 'DIRECT')
    .map((conversation) => conversation.id);

  if (directIds.length) {
    const { data: members, error: membersError } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', directIds)
      .neq('user_id', me);

    if (membersError) throw membersError;

    const userIds = [
      ...new Set((members ?? []).map((member) => member.user_id)),
    ];

    if (userIds.length) {
      const { data: people, error: peopleError } = await supabase.rpc(
        'get_display_names',
        { p_ids: userIds },
      );

      if (peopleError) throw peopleError;

      const names = new Map(
        (people ?? []).map((person) => [
          person.id,
          `${person.first_name} ${person.last_name}`.trim() || 'Member',
        ]),
      );

      for (const conversation of conversations) {
        if (conversation.type !== 'DIRECT') continue;

        const member = members?.find(
          (item) => item.conversation_id === conversation.id,
        );

        conversation.title = member
          ? names.get(member.user_id) ?? 'Direct message'
          : 'Direct message';
      }
    }
  }

  return conversations.sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) ||
      a.id.localeCompare(b.id),
  );
}

export async function openDirectConversation(
  otherUserId: string,
): Promise<string> {
  const { data, error } = await messagingClient.rpc(
    'messaging_open_direct',
    { p_other: otherUserId },
  );

  if (error) throw error;

  return data;
}

export async function openCourseConversation(
  courseId: string,
): Promise<string> {
  const { data, error } = await messagingClient.rpc(
    'messaging_open_course',
    { p_course: courseId },
  );

  if (error) throw error;

  return data;
}

export async function listMessageablePeople(
  search = '',
): Promise<PersonSummary[]> {
  const { data, error } = await messagingClient.rpc('messaging_people');

  if (error) throw error;

  const term = search.trim().toLocaleLowerCase();

  return (data ?? []).filter((person) => {
    const name =
      `${person.first_name} ${person.last_name}`.toLocaleLowerCase();

    return !term || name.includes(term);
  });
}