-- =============================================================================
-- 0007 — Opérations sensibles
-- =============================================================================
-- Ce que RLS ne sait pas exprimer vit ici : une permission différente par
-- colonne, une garde anti-escalade, plusieurs écritures atomiques, une entrée
-- d'audit obligatoire. Chaque fonction revérifie tout — elle ne fait jamais
-- confiance à un identifiant reçu du frontend.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Création d'organisation
-- -----------------------------------------------------------------------------
-- Cas particulier : l'appelant n'a encore aucune organisation, donc aucun
-- claim `org_id`. La seule autorisation exigible est d'être authentifié.

create or replace function public.creer_organisation(
  p_nom            text,
  p_country_code   text,
  p_timezone       text default 'UTC',
  p_currency       text default 'EUR',
  p_default_locale text default 'fr'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_profil uuid := ecoleplus.current_profile_id();
  v_org    uuid;
  v_role   uuid;
begin
  if v_profil is null then
    raise exception 'ECOLEPLUS_NON_AUTHENTIFIE: connectez-vous pour créer une organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_nom, ''))) = 0 then
    raise exception 'ECOLEPLUS_NOM_REQUIS: le nom de l''organisation est obligatoire'
      using errcode = 'check_violation';
  end if;

  select id into v_role from public.roles
   where code = 'OWNER' and organization_id is null;

  if v_role is null then
    raise exception 'ECOLEPLUS_ROLE_MANQUANT: le rôle OWNER est absent du référentiel'
      using errcode = 'internal_error';
  end if;

  insert into public.organizations (name, slug, country_code)
  values (
    trim(p_nom),
    -- Le slug se dérive du nom puis se désambiguïse : la boucle est dans la
    -- transaction, donc à l'abri d'une collision concurrente.
    (
      with base as (select ecoleplus.slugify(p_nom) as s)
      select case
        when not exists (select 1 from public.organizations o where o.slug = base.s)
          then base.s
        else base.s || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
      end
      from base
    ),
    upper(p_country_code)
  )
  returning id into v_org;

  -- Le trigger a déjà créé la ligne de réglages avec les valeurs par défaut :
  -- on n'applique ici que ce que l'utilisateur a réellement choisi.
  update public.organization_settings
     set timezone          = coalesce(nullif(p_timezone, ''), timezone),
         currency          = coalesce(upper(nullif(p_currency, '')), currency),
         default_locale    = coalesce(nullif(p_default_locale, ''), default_locale),
         supported_locales = array[coalesce(nullif(p_default_locale, ''), 'fr')]
   where organization_id = v_org;

  insert into public.organization_memberships (profile_id, organization_id, role_id)
  values (v_profil, v_org, v_role);

  perform ecoleplus.write_audit_log(
    'organization.created', 'organization', v_org::text, v_org, null,
    null, jsonb_build_object('name', trim(p_nom), 'country_code', upper(p_country_code)),
    'Création de l''organisation');

  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gestion des membres
-- -----------------------------------------------------------------------------

-- Garde commune : l'adhésion visée existe, relève de MON organisation, et je
-- ne suis pas en train d'agir sur moi-même.
create or replace function ecoleplus.adhesion_administrable(
  p_membership_id uuid,
  p_permission text
)
returns public.organization_memberships
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_adhesion public.organization_memberships;
begin
  select * into v_adhesion
    from public.organization_memberships where id = p_membership_id;

  -- Message identique si l'adhésion n'existe pas ou appartient à un autre
  -- tenant : la réponse ne doit pas révéler l'existence de la ligne.
  if v_adhesion.id is null
     or v_adhesion.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_MEMBRE_INTROUVABLE: ce membre n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_adhesion.organization_id, p_permission) then
    raise exception 'ECOLEPLUS_PERMISSION: cette action exige la permission %', p_permission
      using errcode = 'insufficient_privilege';
  end if;

  -- Empêche autant l'auto-promotion que l'auto-exclusion.
  if v_adhesion.profile_id = ecoleplus.current_profile_id() then
    raise exception 'ECOLEPLUS_AUTO_MODIFICATION: vous ne pouvez pas modifier votre propre accès'
      using errcode = 'insufficient_privilege';
  end if;

  return v_adhesion;
end;
$$;

create or replace function public.changer_role_membre(
  p_membership_id uuid,
  p_role_id       uuid,
  p_raison        text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_adhesion    public.organization_memberships;
  v_role        public.roles;
  v_ancien_code text;
begin
  v_adhesion := ecoleplus.adhesion_administrable(p_membership_id, 'members.update_role');

  select * into v_role from public.roles where id = p_role_id;

  if v_role.id is null
     or (v_role.organization_id is not null
         and v_role.organization_id is distinct from v_adhesion.organization_id) then
    raise exception 'ECOLEPLUS_ROLE_INTROUVABLE: ce rôle n''existe pas pour votre organisation'
      using errcode = 'no_data_found';
  end if;

  -- Anti-escalade : seul un propriétaire fabrique un propriétaire. Sans cette
  -- garde, la permission `members.update_role` suffirait à s'octroyer, via un
  -- complice, les pleins pouvoirs sur l'organisation.
  if v_role.code = 'OWNER'
     and coalesce(ecoleplus.jwt_claims() ->> 'role_code', '') <> 'OWNER' then
    raise exception 'ECOLEPLUS_ESCALADE: seul un propriétaire peut nommer un propriétaire'
      using errcode = 'insufficient_privilege';
  end if;

  select code into v_ancien_code from public.roles where id = v_adhesion.role_id;

  update public.organization_memberships
     set role_id = p_role_id
   where id = p_membership_id;

  -- Le rôle a changé : les rattachements d'établissement de l'ancienne portée
  -- n'ont plus de sens s'il ne s'agit plus d'un rôle établissement.
  if v_role.scope <> 'ESTABLISHMENT' then
    delete from public.establishment_users where membership_id = p_membership_id;
  end if;

  perform ecoleplus.write_audit_log(
    'membership.role_changed', 'organization_membership', p_membership_id::text,
    v_adhesion.organization_id, null,
    jsonb_build_object('role', v_ancien_code),
    jsonb_build_object('role', v_role.code),
    p_raison);
end;
$$;

create or replace function public.changer_statut_membre(
  p_membership_id uuid,
  p_statut        public.membership_status,
  p_raison        text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_adhesion public.organization_memberships;
begin
  v_adhesion := ecoleplus.adhesion_administrable(p_membership_id, 'members.suspend');

  if v_adhesion.status = p_statut then
    return;
  end if;

  update public.organization_memberships
     set status = p_statut
   where id = p_membership_id;

  if p_statut = 'SUSPENDED' then
    -- Le JWT déjà émis resterait valide jusqu'à son expiration : on coupe les
    -- écritures tout de suite plutôt que d'attendre son rafraîchissement.
    insert into public.session_revocations (profile_id, revoked_at, reason)
    values (v_adhesion.profile_id, now(), coalesce(p_raison, 'Adhésion suspendue'))
    on conflict (profile_id)
      do update set revoked_at = now(),
                    reason     = excluded.reason;
  else
    delete from public.session_revocations where profile_id = v_adhesion.profile_id;
  end if;

  perform ecoleplus.write_audit_log(
    'membership.status_changed', 'organization_membership', p_membership_id::text,
    v_adhesion.organization_id, null,
    jsonb_build_object('status', v_adhesion.status),
    jsonb_build_object('status', p_statut),
    p_raison);
end;
$$;

create or replace function public.definir_etablissements_membre(
  p_membership_id    uuid,
  p_establishment_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_adhesion public.organization_memberships;
  v_scope    public.role_scope;
  v_inconnu  integer;
begin
  v_adhesion := ecoleplus.adhesion_administrable(p_membership_id, 'members.update_role');

  select scope into v_scope from public.roles where id = v_adhesion.role_id;

  if v_scope <> 'ESTABLISHMENT' then
    raise exception 'ECOLEPLUS_PORTEE_ROLE: ce rôle porte sur toute l''organisation, pas sur des établissements'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_inconnu
    from unnest(coalesce(p_establishment_ids, '{}')) as demande(id)
   where not exists (
     select 1 from public.establishments e
      where e.id = demande.id
        and e.organization_id = v_adhesion.organization_id
   );

  if v_inconnu > 0 then
    raise exception 'ECOLEPLUS_TENANCY_VIOLATION: un établissement visé appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(cardinality(p_establishment_ids), 0) = 0 then
    raise exception 'ECOLEPLUS_ETABLISSEMENT_REQUIS: ce rôle exige au moins un établissement'
      using errcode = 'check_violation';
  end if;

  delete from public.establishment_users
   where membership_id = p_membership_id
     and establishment_id <> all (p_establishment_ids);

  insert into public.establishment_users (membership_id, establishment_id)
  select p_membership_id, unnest(p_establishment_ids)
  on conflict do nothing;

  perform ecoleplus.write_audit_log(
    'membership.establishments_changed', 'organization_membership', p_membership_id::text,
    v_adhesion.organization_id, null, null,
    jsonb_build_object('establishment_ids', to_jsonb(p_establishment_ids)),
    null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------

-- Renvoie le jeton en clair UNE seule fois : seul son SHA-256 est conservé.
create or replace function public.creer_invitation(
  p_email            text,
  p_role_id          uuid,
  p_establishment_ids uuid[] default '{}'
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org   uuid := ecoleplus.current_org_id();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id    uuid;
begin
  if not ecoleplus.can_write(v_org, 'members.invite') then
    raise exception 'ECOLEPLUS_PERMISSION: inviter exige la permission members.invite'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.organization_memberships m
      join public.profiles p on p.id = m.profile_id
      join auth.users u      on u.id = p.id
     where m.organization_id = v_org and lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'ECOLEPLUS_DEJA_MEMBRE: cette adresse est déjà rattachée à votre organisation'
      using errcode = 'unique_violation';
  end if;

  insert into public.organization_invitations (
    organization_id, email, role_id, establishment_ids, token_hash, invited_by
  ) values (
    v_org,
    lower(trim(p_email)),
    p_role_id,
    coalesce(p_establishment_ids, '{}'),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    ecoleplus.current_profile_id()
  )
  returning id into v_id;

  perform ecoleplus.write_audit_log(
    'invitation.created', 'organization_invitation', v_id::text, v_org, null,
    null, jsonb_build_object('email', lower(trim(p_email))), null);

  return query select v_id, v_token;
end;
$$;

create or replace function public.revoquer_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_invitation public.organization_invitations;
begin
  select * into v_invitation
    from public.organization_invitations where id = p_invitation_id;

  if v_invitation.id is null
     or v_invitation.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_INVITATION_INTROUVABLE: cette invitation n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_invitation.organization_id, 'members.invite') then
    raise exception 'ECOLEPLUS_PERMISSION: révoquer exige la permission members.invite'
      using errcode = 'insufficient_privilege';
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'ECOLEPLUS_INVITATION_TRAITEE: cette invitation n''est plus en attente'
      using errcode = 'check_violation';
  end if;

  update public.organization_invitations
     set status = 'REVOKED' where id = p_invitation_id;

  perform ecoleplus.write_audit_log(
    'invitation.revoked', 'organization_invitation', p_invitation_id::text,
    v_invitation.organization_id, null, null, null, null);
end;
$$;

-- Appelée par l'invité, qui n'a encore aucun contexte d'organisation : la seule
-- preuve exigible est la possession du jeton ET la correspondance de l'adresse
-- e-mail. Un lien intercepté ne suffit donc pas à rejoindre l'organisation.
create or replace function public.accepter_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_profil     uuid := ecoleplus.current_profile_id();
  v_email      text;
  v_invitation public.organization_invitations;
  v_adhesion   uuid;
  v_scope      public.role_scope;
begin
  if v_profil is null then
    raise exception 'ECOLEPLUS_NON_AUTHENTIFIE: connectez-vous pour accepter une invitation'
      using errcode = 'insufficient_privilege';
  end if;

  select lower(email) into v_email from auth.users where id = v_profil;

  select * into v_invitation
    from public.organization_invitations
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  -- Jeton inconnu, expiré, déjà consommé ou destiné à quelqu'un d'autre :
  -- même message dans tous les cas, pour ne rien laisser deviner.
  if v_invitation.id is null
     or v_invitation.status <> 'PENDING'
     or v_invitation.expires_at <= now()
     or lower(v_invitation.email) <> v_email then
    raise exception 'ECOLEPLUS_INVITATION_INVALIDE: cette invitation est invalide, expirée ou ne vous est pas destinée'
      using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.organization_memberships
              where profile_id = v_profil
                and organization_id = v_invitation.organization_id) then
    raise exception 'ECOLEPLUS_DEJA_MEMBRE: vous êtes déjà membre de cette organisation'
      using errcode = 'unique_violation';
  end if;

  insert into public.organization_memberships
    (profile_id, organization_id, role_id, invited_by)
  values
    (v_profil, v_invitation.organization_id, v_invitation.role_id, v_invitation.invited_by)
  returning id into v_adhesion;

  select scope into v_scope from public.roles where id = v_invitation.role_id;

  if v_scope = 'ESTABLISHMENT' then
    insert into public.establishment_users (membership_id, establishment_id)
    select v_adhesion, unnest(v_invitation.establishment_ids)
    on conflict do nothing;
  end if;

  update public.organization_invitations
     set status      = 'ACCEPTED',
         accepted_by = v_profil,
         accepted_at = now()
   where id = v_invitation.id;

  perform ecoleplus.write_audit_log(
    'invitation.accepted', 'organization_membership', v_adhesion::text,
    v_invitation.organization_id, null, null,
    jsonb_build_object('invitation_id', v_invitation.id), null);

  return v_invitation.organization_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
-- `ecoleplus.adhesion_administrable` n'est PAS grantée : c'est un rouage
-- interne, appelable seulement par les fonctions ci-dessus.

revoke all on function
  public.creer_organisation(text, text, text, text, text),
  public.changer_role_membre(uuid, uuid, text),
  public.changer_statut_membre(uuid, public.membership_status, text),
  public.definir_etablissements_membre(uuid, uuid[]),
  public.creer_invitation(text, uuid, uuid[]),
  public.revoquer_invitation(uuid),
  public.accepter_invitation(text)
from public, anon;

grant execute on function
  public.creer_organisation(text, text, text, text, text),
  public.changer_role_membre(uuid, uuid, text),
  public.changer_statut_membre(uuid, public.membership_status, text),
  public.definir_etablissements_membre(uuid, uuid[]),
  public.creer_invitation(text, uuid, uuid[]),
  public.revoquer_invitation(uuid),
  public.accepter_invitation(text)
to authenticated;
