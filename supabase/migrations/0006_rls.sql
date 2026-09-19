-- =============================================================================
-- 0006 — Row Level Security
-- =============================================================================
-- Deux principes :
--   1. Aucune table n'est exposée sans RLS active, et l'absence de policy vaut
--      refus : les opérations non prévues ici sont impossibles, pas simplement
--      masquées dans l'interface.
--   2. Les écritures non uniformes (changer un rôle, suspendre un membre,
--      accepter une invitation) n'ont volontairement aucune policy : elles
--      passent par les fonctions de la migration 0007, qui contrôlent une
--      permission précise et journalisent. RLS y sert de refus par défaut.
--
-- `(select ecoleplus.current_org_id())` plutôt que l'appel nu : PostgreSQL
-- évalue alors le helper une seule fois par requête (InitPlan) au lieu d'une
-- fois par ligne.
-- =============================================================================

alter table public.profiles                 enable row level security;
alter table public.organizations            enable row level security;
alter table public.organization_settings    enable row level security;
alter table public.establishments           enable row level security;
alter table public.permissions              enable row level security;
alter table public.roles                    enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.establishment_users      enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.session_revocations      enable row level security;
alter table public.audit_logs               enable row level security;

-- Table de service : aucun accès client, même en lecture.
alter table public.session_revocations force row level security;

-- -----------------------------------------------------------------------------
-- Droits : on repart de zéro plutôt que de se fier aux droits par défaut.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, update            on public.profiles                 to authenticated;
grant select, update            on public.organizations            to authenticated;
grant select, update            on public.organization_settings    to authenticated;
grant select, insert, update    on public.establishments           to authenticated;
grant select                    on public.permissions              to authenticated;
grant select                    on public.roles                    to authenticated;
grant select                    on public.role_permissions         to authenticated;
grant select                    on public.organization_memberships to authenticated;
grant select                    on public.establishment_users      to authenticated;
grant select                    on public.organization_invitations to authenticated;
grant select                    on public.audit_logs               to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select ecoleplus.current_profile_id())
    or ecoleplus.partage_mon_organisation(id)
  );

-- Chacun ne modifie que sa propre fiche. Le rôle et l'appartenance ne sont pas
-- ici : ils vivent dans organization_memberships, hors de portée du client.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select ecoleplus.current_profile_id()))
  with check (id = (select ecoleplus.current_profile_id()));

-- -----------------------------------------------------------------------------
-- organizations / organization_settings
-- -----------------------------------------------------------------------------

create policy organizations_select on public.organizations
  for select to authenticated
  using (ecoleplus.can_read(id, 'organization.read'));

create policy organizations_update on public.organizations
  for update to authenticated
  using (ecoleplus.can_write(id, 'organization.update'))
  with check (ecoleplus.can_write(id, 'organization.update'));

-- Seule table lisible sur simple appartenance, sans permission dédiée : sans la
-- devise, le fuseau et le format de date, l'interface ne peut rien afficher
-- correctement, et ces valeurs ne sont pas confidentielles.
create policy organization_settings_select on public.organization_settings
  for select to authenticated
  using (organization_id = (select ecoleplus.current_org_id()));

create policy organization_settings_update on public.organization_settings
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'organization.settings.update'))
  with check (ecoleplus.can_write(organization_id, 'organization.settings.update'));

-- -----------------------------------------------------------------------------
-- establishments
-- -----------------------------------------------------------------------------
-- Un rôle de portée ESTABLISHMENT ne voit que les siens ; les portées
-- ORGANIZATION et PLATFORM voient toute l'organisation.

create policy establishments_select on public.establishments
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'establishments.read', id));

create policy establishments_insert on public.establishments
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'establishments.create'));

create policy establishments_update on public.establishments
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'establishments.update', id))
  with check (ecoleplus.can_write(organization_id, 'establishments.update', id));

-- Aucune policy DELETE : un établissement s'archive (statut ARCHIVED), il ne se
-- supprime pas (CLAUDE.md, règle 5).

-- -----------------------------------------------------------------------------
-- Référentiel RBAC
-- -----------------------------------------------------------------------------

create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

create policy roles_select on public.roles
  for select to authenticated
  using (
    organization_id is null
    or organization_id = (select ecoleplus.current_org_id())
  );

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (exists (
    select 1 from public.roles r
     where r.id = role_permissions.role_id
       and (r.organization_id is null
            or r.organization_id = (select ecoleplus.current_org_id()))
  ));

-- Aucune policy d'écriture sur roles/role_permissions : les rôles système sont
-- immuables, et les rôles sur mesure par organisation (colonne
-- `roles.organization_id`, déjà prévue) arriveront avec leur interface.

-- -----------------------------------------------------------------------------
-- Adhésions et rattachements
-- -----------------------------------------------------------------------------

create policy organization_memberships_select on public.organization_memberships
  for select to authenticated
  using (
    -- Chacun voit toujours sa propre adhésion : sans cela, l'interface ne peut
    -- même pas afficher à l'utilisateur son propre rôle.
    profile_id = (select ecoleplus.current_profile_id())
    or ecoleplus.can_read(organization_id, 'members.read')
  );

create policy establishment_users_select on public.establishment_users
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
     where m.id = establishment_users.membership_id
       and (m.profile_id = (select ecoleplus.current_profile_id())
            or ecoleplus.can_read(m.organization_id, 'members.read'))
  ));

create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'members.invite'));

-- Écritures : uniquement via les fonctions de la migration 0007.

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
-- Lecture réservée à la permission `audit.read`, et jamais au-delà de son
-- organisation. Aucune policy INSERT : seule `write_audit_log` écrit.

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'audit.read', establishment_id));
