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
      classes: {
        Row: {
          academic_year_id: string
          capacity: number | null
          code: string
          created_at: string
          establishment_id: string
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
    }
    Enums: {
      academic_year_status: "PLANNED" | "ACTIVE" | "CLOSED" | "ARCHIVED"
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
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
      membership_status: "ACTIVE" | "SUSPENDED"
      name_display_format:
        | "GIVEN_FAMILY"
        | "FAMILY_GIVEN"
        | "FAMILY_UPPER_GIVEN"
      organization_status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CLOSED"
      role_scope: "PLATFORM" | "ORGANIZATION" | "ESTABLISHMENT"
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

export const Constants = {
  public: {
    Enums: {
      academic_year_status: ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"],
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
      invitation_status: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
      membership_status: ["ACTIVE", "SUSPENDED"],
      name_display_format: [
        "GIVEN_FAMILY",
        "FAMILY_GIVEN",
        "FAMILY_UPPER_GIVEN",
      ],
      organization_status: ["TRIAL", "ACTIVE", "SUSPENDED", "CLOSED"],
      role_scope: ["PLATFORM", "ORGANIZATION", "ESTABLISHMENT"],
      teacher_status: ["ACTIVE", "INACTIVE"],
    },
  },
} as const
