/**
 * Types de la base, écrits à la main d'après les migrations `supabase/migrations`.
 *
 * À remplacer par la génération automatique dès que le projet Supabase existe :
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/types/database.ts
 * Tant que ce fichier est manuel, toute migration touchant `public` doit être
 * répercutée ici — sinon le typage ment.
 */

export type OrganizationStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type EstablishmentStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export type RoleScope = 'PLATFORM' | 'ORGANIZATION' | 'ESTABLISHMENT';
export type NameDisplayFormat = 'GIVEN_FAMILY' | 'FAMILY_GIVEN' | 'FAMILY_UPPER_GIVEN';

export type Profile = {
  id: string;
  given_name: string;
  family_name: string;
  phone: string | null;
  avatar_path: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
}

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  country_code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  is_platform: boolean;
  created_at: string;
  updated_at: string;
}

export type OrganizationSettings = {
  organization_id: string;
  default_locale: string;
  supported_locales: string[];
  timezone: string;
  currency: string;
  name_display_format: NameDisplayFormat;
  date_format: string;
  week_starts_on: number;
  updated_at: string;
}

export type Establishment = {
  organization_id: string;
  id: string;
  name: string;
  code: string;
  kind_label: string | null;
  status: EstablishmentStatus;
  timezone: string | null;
  locale: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}

export type Role = {
  id: string;
  organization_id: string | null;
  code: string;
  scope: RoleScope;
  label: string;
  description: string;
  is_system: boolean;
  created_at: string;
}

export type Permission = {
  key: string;
  module: string;
  description: string;
  created_at: string;
}

export type OrganizationMembership = {
  id: string;
  profile_id: string;
  organization_id: string;
  role_id: string;
  status: MembershipStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EstablishmentUser = {
  membership_id: string;
  establishment_id: string;
  created_at: string;
}

export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  establishment_ids: string[];
  token_hash: string;
  status: InvitationStatus;
  expires_at: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export type AuditLog = {
  id: number;
  occurred_at: string;
  actor_profile_id: string | null;
  actor_label: string | null;
  organization_id: string | null;
  establishment_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  context: Record<string, unknown>;
}

/**
 * Table sous la forme attendue par supabase-js.
 *
 * `Insert` et `Update` doivent satisfaire `Record<string, unknown>` : y mettre
 * `never` fait échouer la contrainte générique, et supabase-js retombe alors
 * silencieusement sur un schéma vide où tout devient `never`.
 */
type TableDef<
  Row,
  Insert extends Record<string, unknown> = LectureSeule,
  Update extends Record<string, unknown> = LectureSeule,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Table non modifiable par le client : toute écriture passe par une fonction. */
type LectureSeule = Record<string, never>;

/** Équivalent de `Record<never, never>` avec signature d'index implicite. */
type Vide = { [_ in never]: never };

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, LectureSeule, Partial<Pick<Profile, 'given_name' | 'family_name' | 'phone' | 'locale' | 'avatar_path'>>>;
      organizations: TableDef<Organization, LectureSeule, Partial<Pick<Organization, 'name' | 'city' | 'address' | 'phone' | 'email' | 'logo_path'>>>;
      organization_settings: TableDef<
        OrganizationSettings,
        LectureSeule,
        Partial<Omit<OrganizationSettings, 'organization_id' | 'updated_at'>>
      >;
      establishments: TableDef<
        Establishment,
        Pick<Establishment, 'organization_id' | 'name' | 'code'> &
          Partial<Pick<Establishment, 'kind_label' | 'timezone' | 'locale' | 'address' | 'city' | 'phone' | 'email'>>,
        Partial<Pick<Establishment, 'name' | 'code' | 'kind_label' | 'status' | 'timezone' | 'locale' | 'address' | 'city' | 'phone' | 'email'>>
      >;
      roles: TableDef<Role>;
      permissions: TableDef<Permission>;
      role_permissions: TableDef<{ role_id: string; permission_key: string }>;
      organization_memberships: TableDef<OrganizationMembership>;
      establishment_users: TableDef<EstablishmentUser>;
      organization_invitations: TableDef<OrganizationInvitation>;
      audit_logs: TableDef<AuditLog>;
    };
    Views: Vide;
    Functions: {
      creer_organisation: {
        Args: {
          p_nom: string;
          p_country_code: string;
          p_timezone?: string;
          p_currency?: string;
          p_default_locale?: string;
        };
        Returns: string;
      };
      changer_role_membre: {
        Args: { p_membership_id: string; p_role_id: string; p_raison?: string };
        Returns: undefined;
      };
      changer_statut_membre: {
        Args: { p_membership_id: string; p_statut: MembershipStatus; p_raison?: string };
        Returns: undefined;
      };
      definir_etablissements_membre: {
        Args: { p_membership_id: string; p_establishment_ids: string[] };
        Returns: undefined;
      };
      creer_invitation: {
        Args: { p_email: string; p_role_id: string; p_establishment_ids?: string[] };
        Returns: { invitation_id: string; token: string }[];
      };
      revoquer_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      accepter_invitation: { Args: { p_token: string }; Returns: string };
    };
    Enums: {
      organization_status: OrganizationStatus;
      establishment_status: EstablishmentStatus;
      membership_status: MembershipStatus;
      invitation_status: InvitationStatus;
      role_scope: RoleScope;
      name_display_format: NameDisplayFormat;
    };
    CompositeTypes: Vide;
  };
}
