// src/services/content.ts
import { supabase } from '@/lib/supabase';
import type { Lesson, Material, Module, ModuleWithLessons, MaterialType } from '@/types/app';

/* ---------------- Modules ---------------- */

export async function listModulesWithLessons(courseId: string): Promise<ModuleWithLessons[]> {
  const { data, error } = await supabase
    .from('modules')
    .select(`
      *,
      lessons ( * )
    `)
    .eq('course_id', courseId)
    .order('position', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((m) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a: Lesson, b: Lesson) => a.position - b.position),
  })) as ModuleWithLessons[];
}

export async function createModule(input: {
  course_id: string;
  title: string;
  description?: string | null;
  position?: number;
}): Promise<Module> {
  const { data, error } = await supabase
    .from('modules')
    .insert({ ...input, position: input.position ?? 0 })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateModule(
  moduleId: string,
  input: Partial<Pick<Module, 'title' | 'description' | 'position' | 'is_published'>>,
): Promise<void> {
  const { error } = await supabase.from('modules').update(input).eq('id', moduleId);
  if (error) throw error;
}

export async function deleteModule(moduleId: string): Promise<void> {
  const { error } = await supabase.from('modules').delete().eq('id', moduleId);
  if (error) throw error;
}

/* ---------------- Lessons ---------------- */

export async function createLesson(input: {
  course_id: string;
  module_id: string;
  title: string;
  content?: string | null;
  video_url?: string | null;
  position?: number;
}): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ ...input, position: input.position ?? 0 })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateLesson(
  lessonId: string,
  input: Partial<Pick<Lesson, 'title' | 'content' | 'video_url' | 'position' | 'is_published'>>,
): Promise<void> {
  const { error } = await supabase.from('lessons').update(input).eq('id', lessonId);
  if (error) throw error;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  if (error) throw error;
}

/* ---------------- Materials ---------------- */

export const MATERIAL_BUCKET = 'course-materials';

export async function listMaterialsForCourse(courseId: string): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadMaterial(params: {
  courseId: string;
  moduleId?: string | null;
  lessonId?: string | null;
  assignmentId?: string | null;
  title: string;
  file: File;
  type: MaterialType;
}): Promise<Material> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = params.file.name.split('.').pop() ?? 'bin';
  const storagePath = `${params.courseId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type,
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('materials')
    .insert({
      course_id: params.courseId,
      module_id: params.moduleId ?? null,
      lesson_id: params.lessonId ?? null,
      assignment_id: params.assignmentId ?? null,
      title: params.title,
      filename: params.file.name,
      mime_type: params.file.type,
      size: params.file.size,
      storage_path: storagePath,
      type: params.type,
      uploaded_by: user.id,
      is_published: true,
    })
    .select('*')
    .single();
  if (error) {
    // Best-effort cleanup of orphaned object
    await supabase.storage.from(MATERIAL_BUCKET).remove([storagePath]);
    throw error;
  }
  return data;
}

export async function addExternalMaterial(params: {
  courseId: string;
  moduleId?: string | null;
  lessonId?: string | null;
  title: string;
  url: string;
  type: MaterialType;
}): Promise<Material> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('materials')
    .insert({
      course_id: params.courseId,
      module_id: params.moduleId ?? null,
      lesson_id: params.lessonId ?? null,
      title: params.title,
      external_url: params.url,
      type: params.type,
      uploaded_by: user.id,
      is_published: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getMaterialDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(storagePath, 60 * 10); // 10 min
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const { error } = await supabase
    .from('materials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', materialId);
  if (error) throw error;
}