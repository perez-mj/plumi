// src/types/app.ts
import type { Database, Enums } from '@/types/database.types';

export type Course = Database['public']['Tables']['courses']['Row'];
export type Module = Database['public']['Tables']['modules']['Row'];
export type Lesson = Database['public']['Tables']['lessons']['Row'];
export type Material = Database['public']['Tables']['materials']['Row'];
export type Assignment = Database['public']['Tables']['assignments']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type SubmissionFile = Database['public']['Tables']['submission_files']['Row'];
export type Announcement = Database['public']['Tables']['announcements']['Row'];
export type Enrollment = Database['public']['Tables']['enrollments']['Row'];
export type Progress = Database['public']['Tables']['progress']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export type CourseStatus = Enums<'CourseStatus'>;
export type MaterialType = Enums<'MaterialType'>;
export type ProgressStatus = Enums<'ProgressStatus'>;
export type SubmissionStatus = Enums<'SubmissionStatus'>;
export type EnrollmentStatus = Enums<'EnrollmentStatus'>;

export interface CourseWithMeta extends Course {
  category?: Pick<Category, 'id' | 'name' | 'slug'> | null;
  instructor?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'avatar_url'> | null;
  enrollment?: Enrollment | null;
  module_count?: number;
  lesson_count?: number;
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}