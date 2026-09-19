-- =============================================================================
-- 0005 — Hook d'émission du jeton d'accès
-- =============================================================================
-- Pièce maîtresse du modèle de sécurité : organisation active, rôle, portée,
-- établissements et permissions sont calculés ICI, côté serveur, au moment de
-- l'émission du JWT. Le client ne peut donc pas les influencer — il ne peut que
-- demander un rafraîchissement du jeton.
--
-- À activer une fois la migration appliquée :
--   Dashboard > Authentication > Hooks > Customize Access Token (JWT) Claims
--   → ecoleplus.custom_access_token_hook
-- Sans cette activation, aucun claim n'est posé : `current_org_id()` renvoie
-- NULL et RLS refuse tout. L'échec est fermé, jamais ouvert.
-- =============================================================================

create or replace function ecoleplus.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_profile_id   uuid  := (event ->> 'user_id')::uuid;
  v_claims       jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_org_demandee text  := coalesce(v_claims -> 'user_metadata' ->> 'active_org_id', '');
  v_adhesion     record;
  v_permissions  jsonb;
  v_etablissements jsonb;
begin
  -- Organisation active : celle demandée si l'adhésion existe et est active,
  -- sinon la plus ancienne. Une organisation suspendue ou fermée n'émet aucun
  -- contexte : ses membres sont authentifiés mais sans accès aux données.
  select m.id,
         m.organization_id,
         r.code  as role_code,
         r.scope as role_scope
    into v_adhesion
    from public.organization_memberships m
    join public.roles r         on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
   where m.profile_id = v_profile_id
     and m.status = 'ACTIVE'
     and o.status in ('TRIAL', 'ACTIVE')
   order by (m.organization_id::text = v_org_demandee) desc, m.created_at asc
   limit 1;

  if v_adhesion.id is null then
    return jsonb_set(event, '{claims}', v_claims || jsonb_build_object(
      'org_id',            null,
      'role_code',         null,
      'role_scope',        null,
      'establishment_ids', '[]'::jsonb,
      'permissions',       '[]'::jsonb,
      'is_platform_admin', false
    ));
  end if;

  select coalesce(jsonb_agg(rp.permission_key), '[]'::jsonb)
    into v_permissions
    from public.role_permissions rp
   where rp.role_id = (select role_id from public.organization_memberships
                        where id = v_adhesion.id);

  -- Seuls les établissements encore actifs sont portés : archiver un
  -- établissement en retire l'accès au prochain rafraîchissement du jeton.
  select coalesce(jsonb_agg(eu.establishment_id::text), '[]'::jsonb)
    into v_etablissements
    from public.establishment_users eu
    join public.establishments e on e.id = eu.establishment_id
   where eu.membership_id = v_adhesion.id
     and e.status = 'ACTIVE';

  return jsonb_set(event, '{claims}', v_claims || jsonb_build_object(
    'org_id',            v_adhesion.organization_id,
    'role_code',         v_adhesion.role_code,
    'role_scope',        v_adhesion.role_scope,
    'establishment_ids', v_etablissements,
    'permissions',       v_permissions,
    'is_platform_admin', v_adhesion.role_scope = 'PLATFORM'
  ));
end;
$$;

-- Seul GoTrue appelle ce hook. Le laisser exécutable par `authenticated`
-- permettrait à n'importe qui de découvrir les permissions d'autrui.
revoke execute on function ecoleplus.custom_access_token_hook(jsonb)
  from authenticated, anon, public;
grant execute on function ecoleplus.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

-- GoTrue tourne sous `supabase_auth_admin`, qui n'a par défaut aucun droit sur
-- `public`. Lecture seule, strictement sur ce que le hook interroge.
grant usage on schema ecoleplus to supabase_auth_admin;
grant select on
  public.organization_memberships,
  public.organizations,
  public.roles,
  public.role_permissions,
  public.establishment_users,
  public.establishments
to supabase_auth_admin;
