/**
 * Fichier GÉNÉRÉ — ne pas modifier à la main.
 *
 *   npx supabase gen types typescript --project-id oaloryktutwwgjqknmbm \
 *     --schema public > src/lib/types/database.generated.ts
 *
 * À régénérer après toute migration touchant le schéma `public`.
 * Les alias métier se trouvent dans `database.ts`, à côté.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year_id: string
          created_at: string
          ends_on: string
          id: string
          kind_label: string | null
          name: string
          organization_id: string
          position: number
          starts_on: string
          updated_at: string
          weight: number
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          ends_on: string
          id?: string
          kind_label?: string | null
          name: string
          organization_id: string
          position: number
          starts_on: string
          updated_at?: string
          weight?: number
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          kind_label?: string | null
          name?: string
          organization_id?: string
          position?: number
          starts_on?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_academic_year_id_organization_id_fkey"
            columns: ["academic_year_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          ends_on: string
          establishment_id: string
          id: string
          is_current: boolean
          name: string
          organization_id: string
          starts_on: string
          status: Database["public"]["Enums"]["academic_year_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          establishment_id: string
          id?: string
          is_current?: boolean
          name: string
          organization_id: string
          starts_on: string
          status?: Database["public"]["Enums"]["academic_year_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          establishment_id?: string
          id?: string
          is_current?: boolean
          name?: string
          organization_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["academic_year_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      assessment_result_histories: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          reason: string | null
          result_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          reason?: string | null
          result_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          reason?: string | null
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_result_histories_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_result_histories_result_id_organization_id_fkey"
            columns: ["result_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "assessment_results"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          assessment_id: string
          comment: string | null
          created_at: string
          enrollment_id: string
          entered_at: string | null
          entered_by: string | null
          id: string
          kind: Database["public"]["Enums"]["grade_kind"]
          normalized_value: number | null
          organization_id: string
          published_at: string | null
          raw_value: number | null
          scale_id: string | null
          status: Database["public"]["Enums"]["grade_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assessment_id: string
          comment?: string | null
          created_at?: string
          enrollment_id: string
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["grade_kind"]
          normalized_value?: number | null
          organization_id: string
          published_at?: string | null
          raw_value?: number | null
          scale_id?: string | null
          status?: Database["public"]["Enums"]["grade_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assessment_id?: string
          comment?: string | null
          created_at?: string
          enrollment_id?: string
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["grade_kind"]
          normalized_value?: number | null
          organization_id?: string
          published_at?: string | null
          raw_value?: number | null
          scale_id?: string | null
          status?: Database["public"]["Enums"]["grade_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_organization_id_fkey"
            columns: ["assessment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessment_results_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessment_results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_scale_id_organization_id_fkey"
            columns: ["scale_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_scales"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessment_results_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          academic_term_id: string | null
          academic_year_id: string
          category_id: string | null
          class_id: string
          coefficient: number
          created_at: string
          created_by: string | null
          date_on: string
          description: string | null
          establishment_id: string
          grading_system_id: string
          id: string
          missing_grade_policy: Database["public"]["Enums"]["missing_grade_policy"]
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          subject_id: string
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          academic_year_id: string
          category_id?: string | null
          class_id: string
          coefficient?: number
          created_at?: string
          created_by?: string | null
          date_on: string
          description?: string | null
          establishment_id: string
          grading_system_id: string
          id?: string
          missing_grade_policy?: Database["public"]["Enums"]["missing_grade_policy"]
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          subject_id: string
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_term_id?: string | null
          academic_year_id?: string
          category_id?: string | null
          class_id?: string
          coefficient?: number
          created_at?: string
          created_by?: string | null
          date_on?: string
          description?: string | null
          establishment_id?: string
          grading_system_id?: string
          id?: string
          missing_grade_policy?: Database["public"]["Enums"]["missing_grade_policy"]
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          subject_id?: string
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_academic_term_id_organization_id_fkey"
            columns: ["academic_term_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessments_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "assessments_category_id_organization_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessments_class_id_academic_year_id_fkey"
            columns: ["class_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessments_grading_system_id_organization_id_fkey"
            columns: ["grading_system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assessments_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_establishment_id_fkey"
            columns: ["subject_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "assessments_teacher_id_establishment_id_fkey"
            columns: ["teacher_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      attendance_corrections: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_status_id: string
          old_status_id: string | null
          organization_id: string
          reason: string
          record_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_status_id: string
          old_status_id?: string | null
          organization_id: string
          reason: string
          record_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_status_id?: string
          old_status_id?: string | null
          organization_id?: string
          reason?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_record_id_organization_id_fkey"
            columns: ["record_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          comment: string | null
          created_at: string
          enrollment_id: string
          id: string
          justification_path: string | null
          organization_id: string
          recorded_at: string
          recorded_by: string | null
          session_id: string
          status_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          justification_path?: string | null
          organization_id: string
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          status_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          justification_path?: string | null
          organization_id?: string
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          status_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_organization_id_fkey"
            columns: ["session_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "attendance_records_status_id_organization_id_fkey"
            columns: ["status_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "attendance_statuses"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          academic_year_id: string
          class_id: string
          created_at: string
          date_on: string
          ends_at: string | null
          establishment_id: string
          id: string
          kind_label: string | null
          notes: string | null
          organization_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["attendance_session_status"]
          subject_id: string | null
          teacher_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          academic_year_id: string
          class_id: string
          created_at?: string
          date_on: string
          ends_at?: string | null
          establishment_id: string
          id?: string
          kind_label?: string | null
          notes?: string | null
          organization_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["attendance_session_status"]
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          created_at?: string
          date_on?: string
          ends_at?: string | null
          establishment_id?: string
          id?: string
          kind_label?: string | null
          notes?: string | null
          organization_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["attendance_session_status"]
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "attendance_sessions_class_id_academic_year_id_fkey"
            columns: ["class_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "attendance_sessions_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "attendance_sessions_subject_id_establishment_id_fkey"
            columns: ["subject_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "attendance_sessions_teacher_id_establishment_id_fkey"
            columns: ["teacher_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "attendance_sessions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_statuses: {
        Row: {
          code: string
          color: string | null
          counts_absent: boolean
          created_at: string
          establishment_id: string | null
          id: string
          is_active: boolean
          is_present: boolean
          name: string
          organization_id: string
          position: number
          requires_justification: boolean
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          counts_absent?: boolean
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          is_present?: boolean
          name: string
          organization_id: string
          position?: number
          requires_justification?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          counts_absent?: boolean
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          is_present?: boolean
          name?: string
          organization_id?: string
          position?: number
          requires_justification?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_statuses_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "attendance_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_profile_id: string | null
          context: Json
          establishment_id: string | null
          id: number
          new_value: Json | null
          occurred_at: string
          old_value: Json | null
          organization_id: string | null
          reason: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_profile_id?: string | null
          context?: Json
          establishment_id?: string | null
          id?: never
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          organization_id?: string | null
          reason?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_profile_id?: string | null
          context?: Json
          establishment_id?: string | null
          id?: never
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          organization_id?: string | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          coefficient: number
          created_at: string
          establishment_id: string
          grading_system_id: string | null
          id: string
          is_active: boolean
          organization_id: string
          position: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          coefficient?: number
          created_at?: string
          establishment_id: string
          grading_system_id?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          position?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          coefficient?: number
          created_at?: string
          establishment_id?: string
          grading_system_id?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          position?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_establishment_id_fkey"
            columns: ["class_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "class_subjects_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "class_subjects_grading_system_id_organization_id_fkey"
            columns: ["grading_system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_establishment_id_fkey"
            columns: ["subject_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          capacity: number | null
          code: string
          created_at: string
          establishment_id: string
          grading_system_id: string | null
          id: string
          is_active: boolean
          level_id: string
          main_teacher_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          capacity?: number | null
          code: string
          created_at?: string
          establishment_id: string
          grading_system_id?: string | null
          id?: string
          is_active?: boolean
          level_id: string
          main_teacher_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          capacity?: number | null
          code?: string
          created_at?: string
          establishment_id?: string
          grading_system_id?: string | null
          id?: string
          is_active?: boolean
          level_id?: string
          main_teacher_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "classes_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "classes_grading_system_fkey"
            columns: ["grading_system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "classes_level_id_establishment_id_fkey"
            columns: ["level_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "classes_main_teacher_id_establishment_id_fkey"
            columns: ["main_teacher_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          academic_year_id: string
          class_id: string | null
          created_at: string
          ended_on: string | null
          enrolled_on: string
          establishment_id: string
          id: string
          learner_id: string
          level_id: string | null
          organization_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          class_id?: string | null
          created_at?: string
          ended_on?: string | null
          enrolled_on?: string
          establishment_id: string
          id?: string
          learner_id: string
          level_id?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string | null
          created_at?: string
          ended_on?: string | null
          enrolled_on?: string
          establishment_id?: string
          id?: string
          learner_id?: string
          level_id?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "enrollments_classe_fkey"
            columns: ["class_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "enrollments_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "enrollments_learner_id_organization_id_fkey"
            columns: ["learner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "enrollments_level_id_establishment_id_fkey"
            columns: ["level_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      establishment_settings: {
        Row: {
          establishment_id: string
          key: string
          organization_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          establishment_id: string
          key: string
          organization_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          establishment_id?: string
          key?: string
          organization_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "establishment_settings_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      establishment_users: {
        Row: {
          created_at: string
          establishment_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_users_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_users_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          kind_label: string | null
          locale: string | null
          logo_path: string | null
          name: string
          organization_id: string
          phone: string | null
          status: Database["public"]["Enums"]["establishment_status"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          kind_label?: string | null
          locale?: string | null
          logo_path?: string | null
          name: string
          organization_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["establishment_status"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          kind_label?: string | null
          locale?: string | null
          logo_path?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["establishment_status"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_installments: {
        Row: {
          created_at: string
          due_on: string
          fee_structure_id: string
          id: string
          label: string
          organization_id: string
          position: number
          share_minor: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_on: string
          fee_structure_id: string
          id?: string
          label: string
          organization_id: string
          position?: number
          share_minor: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_on?: string
          fee_structure_id?: string
          id?: string
          label?: string
          organization_id?: string
          position?: number
          share_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_installments_fee_structure_id_organization_id_fkey"
            columns: ["fee_structure_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      fee_obligations: {
        Row: {
          adjustment_minor: number
          amount_minor: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          currency: string
          discount_minor: number
          due_on: string
          enrollment_id: string
          establishment_id: string
          fee_structure_id: string
          id: string
          installment_id: string | null
          label: string
          organization_id: string
          paid_minor: number
          status: Database["public"]["Enums"]["obligation_status"] | null
          total_minor: number | null
          updated_at: string
        }
        Insert: {
          adjustment_minor?: number
          amount_minor: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          currency: string
          discount_minor?: number
          due_on: string
          enrollment_id: string
          establishment_id: string
          fee_structure_id: string
          id?: string
          installment_id?: string | null
          label: string
          organization_id: string
          paid_minor?: number
          status?: Database["public"]["Enums"]["obligation_status"] | null
          total_minor?: number | null
          updated_at?: string
        }
        Update: {
          adjustment_minor?: number
          amount_minor?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          due_on?: string
          enrollment_id?: string
          establishment_id?: string
          fee_structure_id?: string
          id?: string
          installment_id?: string | null
          label?: string
          organization_id?: string
          paid_minor?: number
          status?: Database["public"]["Enums"]["obligation_status"] | null
          total_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_obligations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_obligations_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fee_obligations_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fee_obligations_fee_structure_id_organization_id_fkey"
            columns: ["fee_structure_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fee_obligations_installment_id_organization_id_fkey"
            columns: ["installment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "fee_installments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year_id: string
          amount_minor: number
          code: string
          created_at: string
          currency: string
          establishment_id: string
          id: string
          is_active: boolean
          is_recurring: boolean
          kind: Database["public"]["Enums"]["fee_kind"]
          kind_label: string | null
          level_id: string | null
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount_minor: number
          code: string
          created_at?: string
          currency: string
          establishment_id: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          kind?: Database["public"]["Enums"]["fee_kind"]
          kind_label?: string | null
          level_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount_minor?: number
          code?: string
          created_at?: string
          currency?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          kind?: Database["public"]["Enums"]["fee_kind"]
          kind_label?: string | null
          level_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "fee_structures_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "fee_structures_level_id_establishment_id_fkey"
            columns: ["level_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
      grading_categories: {
        Row: {
          code: string
          created_at: string
          establishment_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grading_categories_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "grading_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_scales: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          grading_system_id: string
          id: string
          is_passing: boolean
          label: string
          max_score: number
          min_score: number
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          grading_system_id: string
          id?: string
          is_passing?: boolean
          label: string
          max_score: number
          min_score: number
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          grading_system_id?: string
          id?: string
          is_passing?: boolean
          label?: string
          max_score?: number
          min_score?: number
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_scales_grading_system_id_organization_id_fkey"
            columns: ["grading_system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      grading_systems: {
        Row: {
          allows_averaging: boolean
          code: string
          created_at: string
          decimals: number
          establishment_id: string | null
          id: string
          is_default: boolean
          max_value: number
          min_value: number
          name: string
          organization_id: string
          pass_threshold: number | null
          rounding_mode: Database["public"]["Enums"]["rounding_mode"]
          status: Database["public"]["Enums"]["grading_system_status"]
          type: Database["public"]["Enums"]["grading_system_type"]
          unit: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          allows_averaging?: boolean
          code: string
          created_at?: string
          decimals?: number
          establishment_id?: string | null
          id?: string
          is_default?: boolean
          max_value: number
          min_value: number
          name: string
          organization_id: string
          pass_threshold?: number | null
          rounding_mode?: Database["public"]["Enums"]["rounding_mode"]
          status?: Database["public"]["Enums"]["grading_system_status"]
          type: Database["public"]["Enums"]["grading_system_type"]
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          allows_averaging?: boolean
          code?: string
          created_at?: string
          decimals?: number
          establishment_id?: string | null
          id?: string
          is_default?: boolean
          max_value?: number
          min_value?: number
          name?: string
          organization_id?: string
          pass_threshold?: number | null
          rounding_mode?: Database["public"]["Enums"]["rounding_mode"]
          status?: Database["public"]["Enums"]["grading_system_status"]
          type?: Database["public"]["Enums"]["grading_system_type"]
          unit?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "grading_systems_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "grading_systems_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          academic_year_id: string
          created_at: string
          enrollment_id: string
          group_id: string
          organization_id: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          enrollment_id: string
          group_id: string
          organization_id: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          enrollment_id?: string
          group_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_enrollment_id_academic_year_id_fkey"
            columns: ["enrollment_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "group_members_group_id_academic_year_id_fkey"
            columns: ["group_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          academic_year_id: string
          code: string
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          kind_label: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          code: string
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          kind_label?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          code?: string
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          kind_label?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "groups_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      learners: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          created_at: string
          email: string | null
          family_name: string
          gender_label: string | null
          given_name: string
          id: string
          is_archived: boolean
          learner_code: string | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          email?: string | null
          family_name: string
          gender_label?: string | null
          given_name: string
          id?: string
          is_archived?: boolean
          learner_code?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          email?: string | null
          family_name?: string
          gender_label?: string | null
          given_name?: string
          id?: string
          is_archived?: boolean
          learner_code?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: string
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number
          stage_label: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position: number
          stage_label?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
          stage_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          establishment_ids: string[]
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          establishment_ids?: string[]
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          establishment_ids?: string[]
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          profile_id: string
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          profile_id: string
          role_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          profile_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          currency: string
          date_format: string
          default_locale: string
          name_display_format: Database["public"]["Enums"]["name_display_format"]
          organization_id: string
          supported_locales: string[]
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          currency?: string
          date_format?: string
          default_locale?: string
          name_display_format?: Database["public"]["Enums"]["name_display_format"]
          organization_id: string
          supported_locales?: string[]
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          currency?: string
          date_format?: string
          default_locale?: string
          name_display_format?: Database["public"]["Enums"]["name_display_format"]
          organization_id?: string
          supported_locales?: string[]
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          country_code: string
          created_at: string
          email: string | null
          id: string
          is_platform: boolean
          logo_path: string | null
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country_code: string
          created_at?: string
          email?: string | null
          id?: string
          is_platform?: boolean
          logo_path?: string | null
          name: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_platform?: boolean
          logo_path?: string | null
          name?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          obligation_id: string
          organization_id: string
          payment_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          obligation_id: string
          organization_id: string
          payment_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          obligation_id?: string
          organization_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_obligation_id_organization_id_fkey"
            columns: ["obligation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "fee_obligations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_organization_id_fkey"
            columns: ["payment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          enrollment_id: string
          establishment_id: string
          id: string
          method_label: string
          notes: string | null
          organization_id: string
          paid_on: string
          received_by: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          enrollment_id: string
          establishment_id: string
          id?: string
          method_label: string
          notes?: string | null
          organization_id: string
          paid_on?: string
          received_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          enrollment_id?: string
          establishment_id?: string
          id?: string
          method_label?: string
          notes?: string | null
          organization_id?: string
          paid_on?: string
          received_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "payments_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          key: string
          module: string
        }
        Insert: {
          created_at?: string
          description: string
          key: string
          module: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          family_name: string
          given_name: string
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          family_name?: string
          given_name?: string
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          family_name?: string
          given_name?: string
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_counters: {
        Row: {
          establishment_id: string
          next_value: number
          organization_id: string
          year: number
        }
        Insert: {
          establishment_id: string
          next_value?: number
          organization_id: string
          year: number
        }
        Update: {
          establishment_id?: string
          next_value?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_counters_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          issued_at: string
          issued_by: string | null
          number: string
          organization_id: string
          payment_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          number: string
          organization_id: string
          payment_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          number?: string
          organization_id?: string
          payment_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "receipts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_organization_id_fkey"
            columns: ["payment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "receipts_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_card_publications: {
        Row: {
          id: number
          organization_id: string
          published_at: string
          published_by: string | null
          reason: string | null
          report_card_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          id?: never
          organization_id: string
          published_at?: string
          published_by?: string | null
          reason?: string | null
          report_card_id: string
          snapshot: Json
          version: number
        }
        Update: {
          id?: never
          organization_id?: string
          published_at?: string
          published_by?: string | null
          reason?: string | null
          report_card_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_card_publications_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_publications_report_card_id_organization_id_fkey"
            columns: ["report_card_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "report_cards"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      report_cards: {
        Row: {
          academic_term_id: string | null
          academic_year_id: string
          appreciation: string | null
          class_id: string
          created_at: string
          enrollment_id: string
          establishment_id: string
          general_ratio: number | null
          general_value: number | null
          generated_at: string
          generated_by: string | null
          grading_system_id: string | null
          id: string
          organization_id: string
          rank: number | null
          rank_of: number | null
          snapshot: Json
          status: Database["public"]["Enums"]["report_card_status"]
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          academic_year_id: string
          appreciation?: string | null
          class_id: string
          created_at?: string
          enrollment_id: string
          establishment_id: string
          general_ratio?: number | null
          general_value?: number | null
          generated_at?: string
          generated_by?: string | null
          grading_system_id?: string | null
          id?: string
          organization_id: string
          rank?: number | null
          rank_of?: number | null
          snapshot: Json
          status?: Database["public"]["Enums"]["report_card_status"]
          updated_at?: string
        }
        Update: {
          academic_term_id?: string | null
          academic_year_id?: string
          appreciation?: string | null
          class_id?: string
          created_at?: string
          enrollment_id?: string
          establishment_id?: string
          general_ratio?: number | null
          general_value?: number | null
          generated_at?: string
          generated_by?: string | null
          grading_system_id?: string | null
          id?: string
          organization_id?: string
          rank?: number | null
          rank_of?: number | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_card_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_academic_term_id_organization_id_fkey"
            columns: ["academic_term_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "report_cards_academic_year_id_establishment_id_fkey"
            columns: ["academic_year_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "report_cards_class_id_academic_year_id_fkey"
            columns: ["class_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "report_cards_enrollment_id_organization_id_fkey"
            columns: ["enrollment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "report_cards_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "report_cards_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_grading_system_id_organization_id_fkey"
            columns: ["grading_system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
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
          code: string
          created_at: string
          description: string
          id: string
          is_system: boolean
          label: string
          organization_id: string | null
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          label: string
          organization_id?: string | null
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          label?: string
          organization_id?: string | null
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_revocations: {
        Row: {
          profile_id: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          profile_id: string
          reason?: string | null
          revoked_at?: string
        }
        Update: {
          profile_id?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_revocations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          establishment_id: string
          family_name: string
          given_name: string
          hired_on: string | null
          id: string
          organization_id: string
          phone: string | null
          profile_id: string | null
          staff_code: string | null
          status: Database["public"]["Enums"]["teacher_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          establishment_id: string
          family_name: string
          given_name: string
          hired_on?: string | null
          id?: string
          organization_id: string
          phone?: string | null
          profile_id?: string | null
          staff_code?: string | null
          status?: Database["public"]["Enums"]["teacher_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          establishment_id?: string
          family_name?: string
          given_name?: string
          hired_on?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          profile_id?: string | null
          staff_code?: string | null
          status?: Database["public"]["Enums"]["teacher_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "teachers_profile_id_organization_id_fkey"
            columns: ["profile_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["profile_id", "organization_id"]
          },
        ]
      }
      teaching_assignments: {
        Row: {
          class_id: string
          created_at: string
          establishment_id: string
          id: string
          organization_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          establishment_id: string
          id?: string
          organization_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          organization_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assignments_class_id_establishment_id_fkey"
            columns: ["class_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "teaching_assignments_establishment_id_organization_id_fkey"
            columns: ["establishment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "teaching_assignments_subject_id_establishment_id_fkey"
            columns: ["subject_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "establishment_id"]
          },
          {
            foreignKeyName: "teaching_assignments_teacher_id_establishment_id_fkey"
            columns: ["teacher_id", "establishment_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id", "establishment_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accepter_invitation: { Args: { p_token: string }; Returns: string }
      affecter_classe: {
        Args: { p_class_id: string; p_enrollment_id: string }
        Returns: undefined
      }
      affecter_frais: {
        Args: { p_enrollment_ids: string[]; p_fee_structure_id: string }
        Returns: number
      }
      ajuster_creance: {
        Args: {
          p_adjustment_minor: number
          p_discount_minor: number
          p_obligation_id: string
          p_raison: string
        }
        Returns: undefined
      }
      annuler_creance: {
        Args: { p_obligation_id: string; p_raison: string }
        Returns: undefined
      }
      annuler_note: {
        Args: { p_raison: string; p_result_id: string }
        Returns: undefined
      }
      annuler_recu: {
        Args: { p_raison: string; p_receipt_id: string }
        Returns: undefined
      }
      changer_role_membre: {
        Args: { p_membership_id: string; p_raison?: string; p_role_id: string }
        Returns: undefined
      }
      changer_statut_inscription: {
        Args: {
          p_enrollment_id: string
          p_raison?: string
          p_statut: Database["public"]["Enums"]["enrollment_status"]
        }
        Returns: undefined
      }
      changer_statut_membre: {
        Args: {
          p_membership_id: string
          p_raison?: string
          p_statut: Database["public"]["Enums"]["membership_status"]
        }
        Returns: undefined
      }
      corriger_note: {
        Args: {
          p_kind: Database["public"]["Enums"]["grade_kind"]
          p_raison: string
          p_raw_value: number
          p_result_id: string
          p_scale_id: string
        }
        Returns: undefined
      }
      corriger_presence: {
        Args: { p_new_status_id: string; p_raison: string; p_record_id: string }
        Returns: undefined
      }
      creer_invitation: {
        Args: {
          p_email: string
          p_establishment_ids?: string[]
          p_role_id: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      creer_organisation: {
        Args: {
          p_country_code: string
          p_currency?: string
          p_default_locale?: string
          p_nom: string
          p_timezone?: string
        }
        Returns: string
      }
      definir_annee_courante: {
        Args: { p_academic_year_id: string }
        Returns: undefined
      }
      definir_etablissements_membre: {
        Args: { p_establishment_ids: string[]; p_membership_id: string }
        Returns: undefined
      }
      ecart_echeancier: {
        Args: { p_fee_structure_id: string }
        Returns: number
      }
      encaisser_paiement: {
        Args: {
          p_affectations?: Json
          p_amount_minor: number
          p_enrollment_id: string
          p_method_label: string
          p_notes?: string
          p_paid_on?: string
          p_reference?: string
        }
        Returns: string
      }
      enregistrer_appel: {
        Args: { p_lignes: Json; p_session_id: string }
        Returns: number
      }
      inscrire_apprenant: {
        Args: {
          p_academic_year_id: string
          p_birth_date?: string
          p_class_id?: string
          p_email?: string
          p_establishment_id: string
          p_family_name: string
          p_gender_label?: string
          p_given_name: string
          p_learner_code?: string
          p_level_id?: string
          p_phone?: string
          p_status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Returns: string
      }
      libelle_tranche: {
        Args: { p_ratio: number; p_system_id: string }
        Returns: string
      }
      moyenne_generale: {
        Args: { p_enrollment_id: string; p_term_id?: string }
        Returns: {
          bareme_id: string
          matieres: number
          mention: string
          ratio: number
          valeur: number
        }[]
      }
      moyennes_matiere: {
        Args: { p_enrollment_id: string; p_term_id?: string }
        Returns: {
          bareme_id: string
          coefficient: number
          mention: string
          notes_ignorees: number
          notes_prises: number
          ratio: number
          subject_id: string
          subject_name: string
          valeur: number
        }[]
      }
      previsualiser_bulletin: {
        Args: { p_enrollment_id: string; p_term_id?: string }
        Returns: Json
      }
      publier_bulletin: {
        Args: { p_raison?: string; p_report_card_id: string }
        Returns: number
      }
      publier_evaluation: { Args: { p_assessment_id: string }; Returns: number }
      reinscrire_apprenant: {
        Args: {
          p_academic_year_id: string
          p_class_id?: string
          p_establishment_id: string
          p_learner_id: string
          p_level_id?: string
          p_status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Returns: string
      }
      revoquer_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      rouvrir_seance: {
        Args: { p_raison: string; p_session_id: string }
        Returns: undefined
      }
      saisir_notes: {
        Args: { p_assessment_id: string; p_lignes: Json }
        Returns: number
      }
      situation_financiere: {
        Args: { p_enrollment_id: string }
        Returns: {
          creances: number
          devise: string
          du_minor: number
          en_retard: number
          regle_minor: number
          solde_minor: number
        }[]
      }
      valider_seance: { Args: { p_session_id: string }; Returns: undefined }
      verifier_bareme: {
        Args: { p_system_id: string }
        Returns: {
          code: string
          gravite: string
          message: string
        }[]
      }
      verifier_bulletin: {
        Args: { p_enrollment_id: string; p_term_id?: string }
        Returns: string
      }
      verifier_evaluation: {
        Args: { p_assessment_id: string }
        Returns: number
      }
    }
    Enums: {
      academic_year_status: "PLANNED" | "ACTIVE" | "CLOSED" | "ARCHIVED"
      assessment_status:
        | "DRAFT"
        | "OPEN"
        | "VERIFIED"
        | "PUBLISHED"
        | "CANCELLED"
      attendance_session_status: "OPEN" | "VALIDATED"
      enrollment_status:
        | "PREREGISTERED"
        | "ENROLLED"
        | "ACTIVE"
        | "SUSPENDED"
        | "TRANSFERRED"
        | "GRADUATED"
        | "DROPPED_OUT"
        | "ARCHIVED"
      establishment_status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"
      fee_kind:
        | "REGISTRATION"
        | "TUITION"
        | "FILE"
        | "TRANSPORT"
        | "EXAM"
        | "SUPPLIES"
        | "OTHER"
      grade_kind:
        | "SCORE"
        | "ABSENT"
        | "EXCUSED"
        | "EXEMPT"
        | "NOT_APPLICABLE"
        | "PENDING"
      grade_status:
        | "DRAFT"
        | "CAPTURED"
        | "VERIFIED"
        | "PUBLISHED"
        | "CORRECTED"
        | "CANCELLED"
        | "ARCHIVED"
      grading_system_status: "DRAFT" | "ACTIVE" | "ARCHIVED"
      grading_system_type: "NUMERIC" | "LETTER" | "MASTERY" | "CUSTOM"
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
      membership_status: "ACTIVE" | "SUSPENDED"
      missing_grade_policy: "SKIP" | "ZERO" | "EXCLUDED"
      name_display_format:
        | "GIVEN_FAMILY"
        | "FAMILY_GIVEN"
        | "FAMILY_UPPER_GIVEN"
      obligation_status: "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED"
      organization_status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CLOSED"
      report_card_status: "DRAFT" | "VERIFIED" | "PUBLISHED"
      role_scope: "PLATFORM" | "ORGANIZATION" | "ESTABLISHMENT"
      rounding_mode: "ROUND" | "FLOOR" | "CEIL"
      teacher_status: "ACTIVE" | "INACTIVE"
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
  public: {
    Enums: {
      academic_year_status: ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"],
      assessment_status: [
        "DRAFT",
        "OPEN",
        "VERIFIED",
        "PUBLISHED",
        "CANCELLED",
      ],
      attendance_session_status: ["OPEN", "VALIDATED"],
      enrollment_status: [
        "PREREGISTERED",
        "ENROLLED",
        "ACTIVE",
        "SUSPENDED",
        "TRANSFERRED",
        "GRADUATED",
        "DROPPED_OUT",
        "ARCHIVED",
      ],
      establishment_status: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
      fee_kind: [
        "REGISTRATION",
        "TUITION",
        "FILE",
        "TRANSPORT",
        "EXAM",
        "SUPPLIES",
        "OTHER",
      ],
      grade_kind: [
        "SCORE",
        "ABSENT",
        "EXCUSED",
        "EXEMPT",
        "NOT_APPLICABLE",
        "PENDING",
      ],
      grade_status: [
        "DRAFT",
        "CAPTURED",
        "VERIFIED",
        "PUBLISHED",
        "CORRECTED",
        "CANCELLED",
        "ARCHIVED",
      ],
      grading_system_status: ["DRAFT", "ACTIVE", "ARCHIVED"],
      grading_system_type: ["NUMERIC", "LETTER", "MASTERY", "CUSTOM"],
      invitation_status: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
      membership_status: ["ACTIVE", "SUSPENDED"],
      missing_grade_policy: ["SKIP", "ZERO", "EXCLUDED"],
      name_display_format: [
        "GIVEN_FAMILY",
        "FAMILY_GIVEN",
        "FAMILY_UPPER_GIVEN",
      ],
      obligation_status: ["UNPAID", "PARTIAL", "PAID", "CANCELLED"],
      organization_status: ["TRIAL", "ACTIVE", "SUSPENDED", "CLOSED"],
      report_card_status: ["DRAFT", "VERIFIED", "PUBLISHED"],
      role_scope: ["PLATFORM", "ORGANIZATION", "ESTABLISHMENT"],
      rounding_mode: ["ROUND", "FLOOR", "CEIL"],
      teacher_status: ["ACTIVE", "INACTIVE"],
    },
  },
} as const
