-- =============================================================================
-- 0003 — RBAC : rôles, permissions, adhésions, portée établissement
-- =============================================================================
-- Les permissions sont des données, jamais des `if` dans le code : ajouter un
-- rôle = insérer une ligne dans `roles` + des lignes dans `role_permissions`,
-- sans toucher ni au code ni aux policies RLS.
-- =============================================================================

create type public.role_scope as enum ('PLATFORM', 'ORGANIZATION', 'ESTABLISHMENT');
create type public.membership_status as enum ('ACTIVE', 'SUSPENDED');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- -----------------------------------------------------------------------------
-- permissions / roles / role_permissions
-- -----------------------------------------------------------------------------

create table public.permissions (
  key         text primary key,
  module      text        not null,
  description text        not null,
  created_at  timestamptz not null default now(),
  constraint permissions_key_format check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
);

comment on table public.permissions is
  'Référentiel en lecture seule pour les clients. Une permission s''ajoute par migration.';

-- `organization_id is null` = rôle système, proposé à toutes les organisations.
-- Sinon, rôle sur mesure, visible de sa seule organisation.
create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  code            text        not null,
  scope           public.role_scope not null,
  label           text        not null,
  description     text        not null default '',
  is_system       boolean     not null default false,
  created_at      timestamptz not null default now(),
  constraint roles_code_format check (code ~ '^[A-Z][A-Z0-9_]*$'),
  constraint roles_systeme_sans_organisation check (
    (is_system and organization_id is null) or (not is_system and organization_id is not null)
  ),
  -- Seule l'organisation plateforme porte des rôles PLATFORM ; ils sont système.
  constraint roles_platform_systeme check (scope <> 'PLATFORM' or is_system)
);

create unique index roles_code_systeme_unique
  on public.roles (code) where organization_id is null;
create unique index roles_code_organisation_unique
  on public.roles (organization_id, code) where organization_id is not null;
create index roles_organisation_idx on public.roles (organization_id);

comment on table public.roles is
  'Ajouter un rôle = une ligne ici + des lignes dans role_permissions. Aucune policy RLS à modifier.';

create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create index role_permissions_permission_idx on public.role_permissions (permission_key);

-- -----------------------------------------------------------------------------
-- organization_memberships — rattache un profil à une organisation
-- -----------------------------------------------------------------------------

create table public.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid        not null references public.profiles (id) on delete cascade,
  organization_id uuid        not null references public.organizations (id) on delete cascade,
  role_id         uuid        not null references public.roles (id) on delete restrict,
  status          public.membership_status not null default 'ACTIVE',
  invited_by      uuid        references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Un profil n'a qu'une adhésion par organisation : le rôle y est unique.
  constraint organization_memberships_unique unique (profile_id, organization_id)
);

create index organization_memberships_org_idx
  on public.organization_memberships (organization_id, status);
create index organization_memberships_profile_idx
  on public.organization_memberships (profile_id);

create trigger organization_memberships_touch_updated_at
  before update on public.organization_memberships
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- establishment_users — portée des rôles ESTABLISHMENT
-- -----------------------------------------------------------------------------

create table public.establishment_users (
  membership_id    uuid not null references public.organization_memberships (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (membership_id, establishment_id)
);

create index establishment_users_establishment_idx
  on public.establishment_users (establishment_id);

-- -----------------------------------------------------------------------------
-- organization_invitations
-- -----------------------------------------------------------------------------
-- Seul le SHA-256 du jeton est stocké : une fuite de la base ne permet pas de
-- rejouer une invitation. Le jeton en clair n'existe qu'une fois, dans le lien
-- remis à l'administrateur qui invite.

create table public.organization_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid        not null references public.organizations (id) on delete cascade,
  email            text        not null,
  role_id          uuid        not null references public.roles (id) on delete restrict,
  establishment_ids uuid[]     not null default '{}',
  token_hash       text        not null unique,
  status           public.invitation_status not null default 'PENDING',
  expires_at       timestamptz not null default (now() + interval '14 days'),
  invited_by       uuid        references public.profiles (id) on delete set null,
  accepted_by      uuid        references public.profiles (id) on delete set null,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint organization_invitations_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint organization_invitations_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

-- Une seule invitation en attente par adresse et par organisation.
create unique index organization_invitations_pending_unique
  on public.organization_invitations (organization_id, lower(email))
  where status = 'PENDING';
create index organization_invitations_org_idx
  on public.organization_invitations (organization_id, status);

-- -----------------------------------------------------------------------------
-- session_revocations — coupe-circuit immédiat
-- -----------------------------------------------------------------------------
-- Un JWT reste valide jusqu'à son expiration : cette table permet de bloquer
-- les écritures d'un compte révoqué sans attendre le rafraîchissement du jeton.

create table public.session_revocations (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  revoked_at timestamptz not null default now(),
  reason     text
);

-- =============================================================================
-- Helpers d'autorisation
-- =============================================================================

-- Vraie seulement pour les jetons émis AVANT la révocation : un compte
-- suspendu perd ses écritures immédiatement, mais un membre multi-organisations
-- qui rafraîchit son jeton retrouve ses droits là où il est toujours actif.
-- Un jeton sans `iat` est traité comme révoqué : l'échec est fermé.
create or replace function ecoleplus.is_revoked()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.session_revocations sr
     where sr.profile_id = ecoleplus.current_profile_id()
       and sr.revoked_at > coalesce(
             to_timestamp(nullif(ecoleplus.jwt_claims() ->> 'iat', '')::double precision),
             '-infinity'::timestamptz
           )
  );
$$;

-- Lecture : bonne organisation + permission + établissement autorisé.
create or replace function ecoleplus.can_read(
  p_org_id uuid,
  p_permission text,
  p_establishment_id uuid default null
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select p_org_id = ecoleplus.current_org_id()
     and ecoleplus.has_permission(p_permission)
     and ecoleplus.can_access_establishment(p_establishment_id);
$$;

-- Écriture : les mêmes conditions, plus deux refus absolus — une session
-- d'usurpation est en lecture seule, un compte révoqué n'écrit plus rien.
create or replace function ecoleplus.can_write(
  p_org_id uuid,
  p_permission text,
  p_establishment_id uuid default null
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select ecoleplus.can_read(p_org_id, p_permission, p_establishment_id)
     and not ecoleplus.is_impersonating()
     and not ecoleplus.is_revoked();
$$;

-- Évite une récursion RLS : appelée depuis les policies de `profiles`, elle
-- doit lire `organization_memberships` sans repasser par ses propres policies.
create or replace function ecoleplus.partage_mon_organisation(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.organization_memberships m
     where m.profile_id = p_profile_id
       and m.organization_id = ecoleplus.current_org_id()
  );
$$;

grant execute on function
  ecoleplus.is_revoked(),
  ecoleplus.can_read(uuid, text, uuid),
  ecoleplus.can_write(uuid, text, uuid),
  ecoleplus.partage_mon_organisation(uuid)
to authenticated;

-- =============================================================================
-- Intégrité multi-tenant
-- =============================================================================

-- Une organisation garde toujours au moins un propriétaire actif : sans cela,
-- une rétrogradation ou une suspension peut rendre l'organisation ingérable.
create or replace function ecoleplus.verifier_dernier_proprietaire()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_role_owner uuid;
  v_restants   integer;
begin
  -- L'organisation entière est supprimée : la garde n'a plus d'objet.
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    return coalesce(new, old);
  end if;

  select id into v_role_owner
    from public.roles where code = 'OWNER' and organization_id is null;

  if old.role_id is distinct from v_role_owner or old.status <> 'ACTIVE' then
    return coalesce(new, old);
  end if;

  -- Toujours propriétaire actif après l'opération : rien à vérifier.
  if tg_op = 'UPDATE' and new.role_id = v_role_owner and new.status = 'ACTIVE' then
    return new;
  end if;

  select count(*) into v_restants
    from public.organization_memberships
   where organization_id = old.organization_id
     and role_id = v_role_owner
     and status = 'ACTIVE'
     and id <> old.id;

  if v_restants = 0 then
    raise exception 'ECOLEPLUS_DERNIER_PROPRIETAIRE: une organisation doit conserver au moins un propriétaire actif'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_memberships_dernier_proprietaire
  before update or delete on public.organization_memberships
  for each row execute function ecoleplus.verifier_dernier_proprietaire();

-- Le rôle d'une adhésion doit être un rôle système ou un rôle de cette même
-- organisation : sans ce contrôle, un rôle sur mesure d'un autre tenant
-- pourrait être attribué et importer ses permissions.
create or replace function ecoleplus.verifier_role_adhesion()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_role public.roles;
begin
  select * into v_role from public.roles where id = new.role_id;

  if v_role.id is null then
    raise exception 'ECOLEPLUS_ROLE_INTROUVABLE: ce rôle n''existe pas'
      using errcode = 'check_violation';
  end if;

  if v_role.organization_id is not null
     and v_role.organization_id is distinct from new.organization_id then
    raise exception 'ECOLEPLUS_TENANCY_VIOLATION: ce rôle appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if v_role.scope = 'PLATFORM'
     and not exists (select 1 from public.organizations
                      where id = new.organization_id and is_platform) then
    raise exception 'ECOLEPLUS_ROLE_PLATEFORME: un rôle plateforme ne s''attribue que dans l''organisation EcolePlus'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger organization_memberships_verifier_role
  before insert or update of role_id on public.organization_memberships
  for each row execute function ecoleplus.verifier_role_adhesion();

-- L'adhésion et l'établissement doivent relever de la même organisation.
create or replace function ecoleplus.verifier_tenancy_establishment_user()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_org_adhesion      uuid;
  v_org_etablissement uuid;
begin
  select organization_id into v_org_adhesion
    from public.organization_memberships where id = new.membership_id;
  select organization_id into v_org_etablissement
    from public.establishments where id = new.establishment_id;

  if v_org_adhesion is distinct from v_org_etablissement then
    raise exception 'ECOLEPLUS_TENANCY_VIOLATION: cet établissement appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger establishment_users_verifier_tenancy
  before insert or update on public.establishment_users
  for each row execute function ecoleplus.verifier_tenancy_establishment_user();

-- Une invitation ne peut cibler que des établissements de son organisation, et
-- un rôle de portée ESTABLISHMENT sans établissement ne donnerait accès à rien.
create or replace function ecoleplus.verifier_invitation()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_scope   public.role_scope;
  v_org     uuid;
  v_inconnu integer;
begin
  select scope, organization_id into v_scope, v_org
    from public.roles where id = new.role_id;

  if v_scope is null then
    raise exception 'ECOLEPLUS_ROLE_INTROUVABLE: ce rôle n''existe pas'
      using errcode = 'check_violation';
  end if;

  if v_org is not null and v_org is distinct from new.organization_id then
    raise exception 'ECOLEPLUS_TENANCY_VIOLATION: ce rôle appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if v_scope = 'PLATFORM' then
    raise exception 'ECOLEPLUS_ROLE_PLATEFORME: un rôle plateforme ne s''invite pas'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_inconnu
    from unnest(new.establishment_ids) as demande(id)
   where not exists (
     select 1 from public.establishments e
      where e.id = demande.id and e.organization_id = new.organization_id
   );

  if v_inconnu > 0 then
    raise exception 'ECOLEPLUS_TENANCY_VIOLATION: un établissement visé appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if v_scope = 'ESTABLISHMENT' and cardinality(new.establishment_ids) = 0 then
    raise exception 'ECOLEPLUS_INVITATION_SANS_ETABLISSEMENT: ce rôle exige au moins un établissement'
      using errcode = 'check_violation';
  end if;

  if v_scope = 'ORGANIZATION' and cardinality(new.establishment_ids) > 0 then
    raise exception 'ECOLEPLUS_INVITATION_PORTEE: un rôle organisation ne se restreint pas à des établissements'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger organization_invitations_verifier
  before insert or update on public.organization_invitations
  for each row execute function ecoleplus.verifier_invitation();
