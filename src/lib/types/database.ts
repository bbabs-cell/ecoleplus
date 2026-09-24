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

// ---------------------------------------------------------------------------
// Présences (phase 3a)
// ---------------------------------------------------------------------------

export type AttendanceSessionStatus = Enums<'attendance_session_status'>;

export type AttendanceStatus = Tables<'attendance_statuses'>;
export type AttendanceSession = Tables<'attendance_sessions'>;
export type AttendanceRecord = Tables<'attendance_records'>;
export type AttendanceCorrection = Tables<'attendance_corrections'>;

// ---------------------------------------------------------------------------
// Notation et bulletins (phase 3b)
// ---------------------------------------------------------------------------

export type GradingSystemType = Enums<'grading_system_type'>;
export type GradingSystemStatus = Enums<'grading_system_status'>;
export type RoundingMode = Enums<'rounding_mode'>;
export type AssessmentStatus = Enums<'assessment_status'>;
export type MissingGradePolicy = Enums<'missing_grade_policy'>;
export type ReportCardStatus = Enums<'report_card_status'>;

/**
 * Ce qu'une note EST, et où elle EN EST — deux axes qu'il ne faut jamais
 * confondre (@CLAUDE.md, règle 4). Seul `SCORE` porte une valeur : un zéro
 * réel est `('SCORE', 0)`, une absence `('ABSENT', null)`.
 */
export type GradeKind = Enums<'grade_kind'>;
export type GradeStatus = Enums<'grade_status'>;

export type GradingSystem = Tables<'grading_systems'>;
export type GradingScale = Tables<'grading_scales'>;
export type GradingCategory = Tables<'grading_categories'>;
export type ClassSubject = Tables<'class_subjects'>;
export type Assessment = Tables<'assessments'>;
export type AssessmentResult = Tables<'assessment_results'>;
export type AssessmentResultHistory = Tables<'assessment_result_histories'>;
export type ReportCard = Tables<'report_cards'>;
export type ReportCardPublication = Tables<'report_card_publications'>;
export type EstablishmentSetting = Tables<'establishment_settings'>;

// ---------------------------------------------------------------------------
// Finances (phase 4)
// ---------------------------------------------------------------------------

export type FeeKind = Enums<'fee_kind'>;
export type ObligationStatus = Enums<'obligation_status'>;

export type FeeStructure = Tables<'fee_structures'>;
export type FeeInstallment = Tables<'fee_installments'>;
export type FeeObligation = Tables<'fee_obligations'>;
export type Payment = Tables<'payments'>;
export type PaymentAllocation = Tables<'payment_allocations'>;
export type Receipt = Tables<'receipts'>;
