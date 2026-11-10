export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_requests: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string
          detail_level: Database["public"]["Enums"]["AiDetailLevel"]
          error_message: string | null
          id: string
          material_id: string | null
          model: string | null
          options: Json | null
          output_tokens: number | null
          prompt_tokens: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["AiRequestStatus"]
          type: Database["public"]["Enums"]["AiGenerationType"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          detail_level?: Database["public"]["Enums"]["AiDetailLevel"]
          error_message?: string | null
          id?: string
          material_id?: string | null
          model?: string | null
          options?: Json | null
          output_tokens?: number | null
          prompt_tokens?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["AiRequestStatus"]
          type: Database["public"]["Enums"]["AiGenerationType"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          detail_level?: Database["public"]["Enums"]["AiDetailLevel"]
          error_message?: string | null
          id?: string
          material_id?: string | null
          model?: string | null
          options?: Json | null
          output_tokens?: number | null
          prompt_tokens?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["AiRequestStatus"]
          type?: Database["public"]["Enums"]["AiGenerationType"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_requests_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          course_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean
          scope: Database["public"]["Enums"]["AnnouncementScope"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          course_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          scope?: Database["public"]["Enums"]["AnnouncementScope"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          course_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          scope?: Database["public"]["Enums"]["AnnouncementScope"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          course_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          due_at: string | null
          id: string
          instructions: string | null
          is_published: boolean
          max_score: number
          module_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_late?: boolean
          course_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          max_score?: number
          module_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_late?: boolean
          course_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          max_score?: number
          module_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          title: string | null
          type: Database["public"]["Enums"]["ConversationType"]
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string | null
          type: Database["public"]["Enums"]["ConversationType"]
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string | null
          type?: Database["public"]["Enums"]["ConversationType"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category_id: string | null
          code: string | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          enrollment_key: string | null
          id: string
          instructor_id: string
          learning_objectives: string[] | null
          start_date: string | null
          status: Database["public"]["Enums"]["CourseStatus"]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          enrollment_key?: string | null
          id?: string
          instructor_id: string
          learning_objectives?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["CourseStatus"]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          enrollment_key?: string | null
          id?: string
          instructor_id?: string
          learning_objectives?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["CourseStatus"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["EnrollmentStatus"]
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["EnrollmentStatus"]
          student_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["EnrollmentStatus"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_reviews: {
        Row: {
          flashcard_id: string
          id: string
          known: boolean
          reviewed_at: string
          user_id: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          known: boolean
          reviewed_at?: string
          user_id: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          known?: boolean
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          answer: string
          generation_id: string
          id: string
          position: number
          question: string
        }
        Insert: {
          answer: string
          generation_id: string
          id?: string
          position?: number
          question: string
        }
        Update: {
          answer?: string
          generation_id?: string
          id?: string
          position?: number
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "material_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_questions: {
        Row: {
          answer: string
          choices: Json | null
          explanation: string | null
          generation_id: string
          id: string
          position: number
          question: string
          type: Database["public"]["Enums"]["QuestionType"]
        }
        Insert: {
          answer: string
          choices?: Json | null
          explanation?: string | null
          generation_id: string
          id?: string
          position?: number
          question: string
          type: Database["public"]["Enums"]["QuestionType"]
        }
        Update: {
          answer?: string
          choices?: Json | null
          explanation?: string | null
          generation_id?: string
          id?: string
          position?: number
          question?: string
          type?: Database["public"]["Enums"]["QuestionType"]
        }
        Relationships: [
          {
            foreignKeyName: "generated_questions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "material_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          is_published: boolean
          module_id: string
          position: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          module_id: string
          position?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          module_id?: string
          position?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      material_generations: {
        Row: {
          ai_request_id: string
          content: Json
          course_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          detail_level: Database["public"]["Enums"]["AiDetailLevel"]
          id: string
          is_shared: boolean
          material_id: string | null
          title: string
          type: Database["public"]["Enums"]["AiGenerationType"]
          updated_at: string
        }
        Insert: {
          ai_request_id: string
          content: Json
          course_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          detail_level?: Database["public"]["Enums"]["AiDetailLevel"]
          id?: string
          is_shared?: boolean
          material_id?: string | null
          title: string
          type: Database["public"]["Enums"]["AiGenerationType"]
          updated_at?: string
        }
        Update: {
          ai_request_id?: string
          content?: Json
          course_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          detail_level?: Database["public"]["Enums"]["AiDetailLevel"]
          id?: string
          is_shared?: boolean
          material_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["AiGenerationType"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_generations_ai_request_id_fkey"
            columns: ["ai_request_id"]
            isOneToOne: false
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_generations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_generations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_generations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          assignment_id: string | null
          course_id: string
          created_at: string
          deleted_at: string | null
          external_url: string | null
          extracted_at: string | null
          extracted_text: string | null
          filename: string | null
          id: string
          is_published: boolean
          lesson_id: string | null
          mime_type: string | null
          module_id: string | null
          size: number | null
          storage_path: string | null
          title: string
          type: Database["public"]["Enums"]["MaterialType"]
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          assignment_id?: string | null
          course_id: string
          created_at?: string
          deleted_at?: string | null
          external_url?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          filename?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          mime_type?: string | null
          module_id?: string | null
          size?: number | null
          storage_path?: string | null
          title: string
          type: Database["public"]["Enums"]["MaterialType"]
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          assignment_id?: string | null
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          external_url?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          filename?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          mime_type?: string | null
          module_id?: string | null
          size?: number | null
          storage_path?: string | null
          title?: string
          type?: Database["public"]["Enums"]["MaterialType"]
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendances: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          meeting_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendances_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration: number
          ended_at: string | null
          host_id: string
          id: string
          room_name: string
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["MeetingStatus"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration?: number
          ended_at?: string | null
          host_id: string
          id?: string
          room_name: string
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["MeetingStatus"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration?: number
          ended_at?: string | null
          host_id?: string
          id?: string
          room_name?: string
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["MeetingStatus"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_id: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          attachment_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          attachment_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["NotificationType"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["NotificationType"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["NotificationType"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          key: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          last_seen_at: string | null
          role_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name: string
          id: string
          is_active?: boolean
          last_name: string
          last_seen_at?: string | null
          role_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          last_seen_at?: string | null
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          completed_at: string | null
          course_id: string
          enrollment_id: string
          id: string
          lesson_id: string | null
          material_id: string | null
          status: Database["public"]["Enums"]["ProgressStatus"]
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrollment_id: string
          id?: string
          lesson_id?: string | null
          material_id?: string | null
          status?: Database["public"]["Enums"]["ProgressStatus"]
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrollment_id?: string
          id?: string
          lesson_id?: string | null
          material_id?: string | null
          status?: Database["public"]["Enums"]["ProgressStatus"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_session_answers: {
        Row: {
          id: string
          is_correct: boolean
          question_id: string
          session_id: string
          time_taken_seconds: number | null
        }
        Insert: {
          id?: string
          is_correct: boolean
          question_id: string
          session_id: string
          time_taken_seconds?: number | null
        }
        Update: {
          id?: string
          is_correct?: boolean
          question_id?: string
          session_id?: string
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_session_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "generated_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_session_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "question_session_results"
            referencedColumns: ["id"]
          },
        ]
      }
      question_session_results: {
        Row: {
          accuracy: number
          completed_at: string
          duration_seconds: number | null
          generation_id: string
          id: string
          longest_streak: number
          score: number
          user_id: string
        }
        Insert: {
          accuracy?: number
          completed_at?: string
          duration_seconds?: number | null
          generation_id: string
          id?: string
          longest_streak?: number
          score?: number
          user_id: string
        }
        Update: {
          accuracy?: number
          completed_at?: string
          duration_seconds?: number | null
          generation_id?: string
          id?: string
          longest_streak?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_session_results_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "material_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_session_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      submission_files: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          score: number | null
          status: Database["public"]["Enums"]["SubmissionStatus"]
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["SubmissionStatus"]
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["SubmissionStatus"]
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_name: { Args: never; Returns: string }
      get_display_names: {
        Args: { p_ids: string[] }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_enrolled: { Args: { p_course_id: string }; Returns: boolean }
      notify_user: {
        Args: {
          p_actor_id: string
          p_body: string
          p_data: Json
          p_entity_id: string
          p_entity_type: string
          p_link: string
          p_title: string
          p_type: Database["public"]["Enums"]["NotificationType"]
          p_user_id: string
        }
        Returns: undefined
      }
      teaches_course: { Args: { p_course_id: string }; Returns: boolean }
    }
    Enums: {
      AiDetailLevel: "SHORT" | "STANDARD" | "COMPREHENSIVE"
      AiGenerationType:
        | "SUMMARY"
        | "REVIEWER"
        | "FLASHCARDS"
        | "QUESTIONS"
        | "STUDY_GUIDE"
      AiRequestStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
      AnnouncementScope: "SYSTEM" | "COURSE"
      ConversationType: "DIRECT" | "COURSE" | "GROUP"
      CourseStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      EnrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED"
      MaterialType:
        | "PDF"
        | "DOCX"
        | "PPTX"
        | "IMAGE"
        | "VIDEO"
        | "LINK"
        | "YOUTUBE"
        | "TEXT"
      MeetingStatus: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED"
      NotificationType:
        | "NEW_ASSIGNMENT"
        | "ASSIGNMENT_DEADLINE"
        | "ASSIGNMENT_GRADED"
        | "NEW_MESSAGE"
        | "NEW_ANNOUNCEMENT"
        | "UPCOMING_MEETING"
        | "AI_GENERATION_COMPLETED"
        | "AI_GENERATION_FAILED"
        | "SYSTEM"
      ProgressStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
      QuestionType:
        | "MULTIPLE_CHOICE"
        | "TRUE_FALSE"
        | "IDENTIFICATION"
        | "SHORT_ANSWER"
      SubmissionStatus: "SUBMITTED" | "LATE" | "GRADED" | "RETURNED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      AiDetailLevel: ["SHORT", "STANDARD", "COMPREHENSIVE"],
      AiGenerationType: [
        "SUMMARY",
        "REVIEWER",
        "FLASHCARDS",
        "QUESTIONS",
        "STUDY_GUIDE",
      ],
      AiRequestStatus: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      AnnouncementScope: ["SYSTEM", "COURSE"],
      ConversationType: ["DIRECT", "COURSE", "GROUP"],
      CourseStatus: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      EnrollmentStatus: ["ACTIVE", "COMPLETED", "DROPPED"],
      MaterialType: [
        "PDF",
        "DOCX",
        "PPTX",
        "IMAGE",
        "VIDEO",
        "LINK",
        "YOUTUBE",
        "TEXT",
      ],
      MeetingStatus: ["SCHEDULED", "LIVE", "ENDED", "CANCELLED"],
      NotificationType: [
        "NEW_ASSIGNMENT",
        "ASSIGNMENT_DEADLINE",
        "ASSIGNMENT_GRADED",
        "NEW_MESSAGE",
        "NEW_ANNOUNCEMENT",
        "UPCOMING_MEETING",
        "AI_GENERATION_COMPLETED",
        "AI_GENERATION_FAILED",
        "SYSTEM",
      ],
      ProgressStatus: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
      QuestionType: [
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
        "IDENTIFICATION",
        "SHORT_ANSWER",
      ],
      SubmissionStatus: ["SUBMITTED", "LATE", "GRADED", "RETURNED"],
    },
  },
} as const
