// src/services/announcements.ts
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/app';

export async function listAnnouncements(courseId?: string | null): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select(`*, author:profiles!announcements_author_id_fkey ( id, first_name, last_name, avatar_url )`)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (courseId) {
    query = query.or(`course_id.eq.${courseId},scope.eq.SYSTEM`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Announcement[];
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
  course_id?: string | null;
  scope?: 'SYSTEM' | 'COURSE';
  is_pinned?: boolean;
}): Promise<Announcement> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      ...input,
      author_id: user.id,
      scope: input.scope ?? (input.course_id ? 'COURSE' : 'SYSTEM'),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(
  announcementId: string,
  input: Partial<Pick<Announcement, 'title' | 'content' | 'is_pinned'>>,
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', announcementId);
  if (error) throw error;
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', announcementId);
  if (error) throw error;
}