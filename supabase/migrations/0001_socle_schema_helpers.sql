-- =============================================================================
-- 0001 — Socle : schéma privé, helpers de sécurité, utilitaires
-- =============================================================================
-- Le schéma `ecoleplus` héberge toute la logique de sécurité. Il n'est jamais
-- exposé via PostgREST : seules les fonctions explicitement grantées y sont
-- appelables, et uniquement depuis les policies RLS.
--
-- Toutes les fonctions fixent `search_path = ''` et qualifient complètement
-- leurs références : sans cela, un schéma pirate placé en tête du search_path
-- d'un appelant permettrait de détourner les helpers de sécurité.
-- =============================================================================

-- `extensions` préexiste sur un projet Supabase ; la ligne rend la migration
-- rejouable sur un PostgreSQL nu (tests, CI).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists ecoleplus;

comment on schema ecoleplus is
  'Schéma privé : helpers de sécurité et déclencheurs. Jamais exposé à PostgREST.';

revoke all on schema ecoleplus from public;
grant usage on schema ecoleplus to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Lecture des claims du JWT courant
-- -----------------------------------------------------------------------------
-- Source unique de vérité pour l'identité de l'appelant. Les claims sont
-- écrits par `ecoleplus.custom_access_token_hook` (migration 0005) au moment de
-- l'émission du jeton : ils ne sont donc jamais modifiables par le client.

create or replace function ecoleplus.jwt_claims()
returns jsonb
language sql
stable
set search_path to ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function ecoleplus.current_profile_id()
returns uuid
language sql
stable
set search_path to ''
as $$
  select nullif(ecoleplus.jwt_claims() ->> 'sub', '')::uuid;
$$;

-- Organisation active de l'appelant. Tout le cloisonnement multi-tenant en
-- dépend : une ligne dont `organization_id` diffère est invisible, point.
create or replace function ecoleplus.current_org_id()
returns uuid
language sql
stable
set search_path to ''
as $$
  select nullif(ecoleplus.jwt_claims() ->> 'org_id', '')::uuid;
$$;

create or replace function ecoleplus.current_role_scope()
returns text
language sql
stable
set search_path to ''
as $$
  select nullif(ecoleplus.jwt_claims() ->> 'role_scope', '');
$$;

create or replace function ecoleplus.is_platform_admin()
returns boolean
language sql
stable
set search_path to ''
as $$
  select coalesce((ecoleplus.jwt_claims() ->> 'is_platform_admin')::boolean, false);
$$;

-- Un administrateur plateforme qui emprunte l'identité d'un client reste en
-- lecture seule : `can_write` refuse toute écriture tant que ce claim est posé.
create or replace function ecoleplus.is_impersonating()
returns boolean
language sql
stable
set search_path to ''
as $$
  select nullif(ecoleplus.jwt_claims() ->> 'impersonation_session_id', '') is not null;
$$;

create or replace function ecoleplus.has_permission(p_key text)
returns boolean
language sql
stable
set search_path to ''
as $$
  select coalesce(ecoleplus.jwt_claims() -> 'permissions' ? p_key, false);
$$;

-- -----------------------------------------------------------------------------
-- Portée établissement
-- -----------------------------------------------------------------------------
-- Un rôle de portée ESTABLISHMENT ne voit que les établissements auxquels il est
-- rattaché. Les portées ORGANIZATION et PLATFORM voient toute l'organisation.
-- `p_establishment_id is null` = donnée au niveau organisation, non rattachée.

create or replace function ecoleplus.can_access_establishment(p_establishment_id uuid)
returns boolean
language sql
stable
set search_path to ''
as $$
  select case
    when p_establishment_id is null then true
    when coalesce(ecoleplus.current_role_scope(), '') <> 'ESTABLISHMENT' then true
    else coalesce(
      ecoleplus.jwt_claims() -> 'establishment_ids' ? p_establishment_id::text,
      false
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------

create or replace function ecoleplus.touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Valide une colonne de fuseau horaire. En trigger et non en CHECK : une
-- contrainte CHECK n'accepte pas de sous-requête, et `pg_timezone_names` n'est
-- pas immuable. Le nom de la colonne est passé en argument du trigger.
create or replace function ecoleplus.valider_fuseau()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_colonne text := tg_argv[0];
  v_valeur  text;
begin
  execute format('select ($1).%I::text', v_colonne) into v_valeur using new;

  if v_valeur is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = v_valeur) then
    raise exception 'ECOLEPLUS_FUSEAU_INVALIDE: « % » n''est pas un fuseau horaire connu', v_valeur
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Slug ASCII stable et unique. Volontairement indépendant de toute locale :
-- le nom affiché reste intact, seul l'identifiant d'URL est translittéré.
create or replace function ecoleplus.slugify(p_texte text, p_defaut text default 'organisation')
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(
          lower(trim(coalesce(p_texte, ''))),
          'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
          'aaaaaaceeeeiiiinooooouuuuyyoa'
        ),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    p_defaut
  );
$$;

grant execute on function
  ecoleplus.jwt_claims(),
  ecoleplus.current_profile_id(),
  ecoleplus.current_org_id(),
  ecoleplus.current_role_scope(),
  ecoleplus.is_platform_admin(),
  ecoleplus.is_impersonating(),
  ecoleplus.has_permission(text),
  ecoleplus.can_access_establishment(uuid)
to authenticated;
