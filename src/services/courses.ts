// src/services/courses.ts
import { supabase } from '@/lib/supabase';
import type { Course, CourseWithMeta, CourseStatus, Category } from '@/types/app';

const COURSE_SELECT = `
  *,
  category:categories ( id, name, slug ),
  instructor:profiles!courses_instructor_id_fkey ( id, first_name, last_name, avatar_url )
`;

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  code?: string | null;
  category_id?: string | null;
  cover_image_url?: string | null;
  learning_objectives?: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: CourseStatus;
  enrollment_key?: string | null;
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Courses visible to the current user (RLS enforces what's returned). */
export async function listCourses(params: {
  search?: string;
  categoryId?: string | null;
  status?: CourseStatus | 'ALL';
  instructorId?: string | null;
} = {}): Promise<CourseWithMeta[]> {
  let query = supabase
    .from('courses')
    .select(COURSE_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }
  if (params.categoryId) query = query.eq('category_id', params.categoryId);
  if (params.instructorId) query = query.eq('instructor_id', params.instructorId);
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`title.ilike.${term},code.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CourseWithMeta[];
}

export async function getCourse(courseId: string): Promise<CourseWithMeta> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('id', courseId)
    .single();
  if (error) throw error;
  return data as unknown as CourseWithMeta;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('courses')
    .insert({
      ...input,
      instructor_id: user.id,
      status: input.status ?? 'DRAFT',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(
  courseId: string,
  input: Partial<CreateCourseInput>,
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update(input)
    .eq('id', courseId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function archiveCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ status: 'ARCHIVED' })
    .eq('id', courseId);
  if (error) throw error;
}

export async function softDeleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', courseId);
  if (error) throw error;
}