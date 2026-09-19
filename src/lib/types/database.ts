/**
 * Alias métier au-dessus des types générés.
 *
 * `database.generated.ts` est produit par la CLI Supabase depuis le schéma réel
 * et ne se modifie pas à la main. Ce fichier-ci lui donne des noms lisibles,
 * pour que le reste du code écrive `Establishment` plutôt que
 * `Tables<'establishments'>`.
 *
 * Aucune forme n'est redéfinie ici : la base reste la seule source de vérité,
 * et une colonne ajoutée par migration se répercute dès la régénération.
 */
import type { Enums, Tables } from '@/lib/types/database.generated';

export type { Database, Json } from '@/lib/types/database.generated';
export type { Tables, TablesInsert, TablesUpdate } from '@/lib/types/database.generated';

export type OrganizationStatus = Enums<'organization_status'>;
export type EstablishmentStatus = Enums<'establishment_status'>;
export type MembershipStatus = Enums<'membership_status'>;
export type InvitationStatus = Enums<'invitation_status'>;
export type RoleScope = Enums<'role_scope'>;
export type NameDisplayFormat = Enums<'name_display_format'>;

export type Profile = Tables<'profiles'>;
export type Organization = Tables<'organizations'>;
export type OrganizationSettings = Tables<'organization_settings'>;
export type Establishment = Tables<'establishments'>;
export type Role = Tables<'roles'>;
export type Permission = Tables<'permissions'>;
export type RolePermission = Tables<'role_permissions'>;
export type OrganizationMembership = Tables<'organization_memberships'>;
export type EstablishmentUser = Tables<'establishment_users'>;
export type OrganizationInvitation = Tables<'organization_invitations'>;
export type AuditLog = Tables<'audit_logs'>;

// ---------------------------------------------------------------------------
// Domaine académique (phase 2)
// ---------------------------------------------------------------------------

export type AcademicYearStatus = Enums<'academic_year_status'>;
export type EnrollmentStatus = Enums<'enrollment_status'>;
export type TeacherStatus = Enums<'teacher_status'>;

export type AcademicYear = Tables<'academic_years'>;
export type AcademicTerm = Tables<'academic_terms'>;
export type Level = Tables<'levels'>;
export type Subject = Tables<'subjects'>;
export type Teacher = Tables<'teachers'>;
export type Learner = Tables<'learners'>;
export type Enrollment = Tables<'enrollments'>;
export type Classe = Tables<'classes'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type TeachingAssignment = Tables<'teaching_assignments'>;
