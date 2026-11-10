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

export type GeneratedQuestion = Database['public']['Tables']['generated_questions']['Row'];
export type MaterialGeneration = Database['public']['Tables']['material_generations']['Row'];
export type QuestionSessionResult = Database['public']['Tables']['question_session_results']['Row'];
export type QuestionSessionAnswer = Database['public']['Tables']['question_session_answers']['Row'];

export type QuestionType = Enums<'QuestionType'>;
export type AiGenerationType = Enums<'AiGenerationType'>;
export type AiDetailLevel = Enums<'AiDetailLevel'>;

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * The `choices` column on generated_questions is JSON. We store an object
 * of shape { options: string[], difficulty: Difficulty } so the gamification
 * layer can score by difficulty without a schema change.
 */
export interface QuestionChoices {
  options: string[];
  difficulty: Difficulty;
}

export interface GamificationSettings {
  enabled: boolean;
  base_points: Record<Difficulty, number>;
  combo_thresholds: Record<string, number>; // "2" -> streak >= 5, "3" -> streak >= 10
  combo_cap: number;
  completion_bonus: number;
  time_bonus_enabled: boolean;
}

export interface SessionDraftAnswer {
  questionId: string;
  isCorrect: boolean;
  timeTaken: number;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string | null;
  difficulty: Difficulty;
  position: number;
}