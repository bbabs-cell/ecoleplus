-- =============================================================================
-- 0004 — Journal d'audit
-- =============================================================================
-- Un journal modifiable ne vaut rien : `audit_logs` est en insertion seule,
-- pour tout le monde, y compris les propriétaires et l'organisation plateforme.
-- La seule voie d'écriture est `ecoleplus.write_audit_log`.
-- =============================================================================

create table public.audit_logs (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  -- Conservé même si le compte disparaît : l'acteur reste identifiable par son
  -- libellé figé au moment des faits.
  actor_profile_id uuid        references public.profiles (id) on delete set null,
  actor_label      text,
  organization_id  uuid        references public.organizations (id) on delete set null,
  establishment_id uuid        references public.establishments (id) on delete set null,
  action           text        not null,
  resource_type    text        not null,
  resource_id      text,
  old_value        jsonb,
  new_value        jsonb,
  reason           text,
  context          jsonb       not null default '{}'::jsonb
);

comment on table public.audit_logs is
  'Écriture seule. Aucun UPDATE ni DELETE n''est autorisé, pour personne.';

create index audit_logs_org_date_idx
  on public.audit_logs (organization_id, occurred_at desc);
create index audit_logs_ressource_idx
  on public.audit_logs (resource_type, resource_id);
create index audit_logs_acteur_idx
  on public.audit_logs (actor_profile_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Écriture
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER : l'appelant n'a aucun droit d'INSERT direct sur la table.
-- L'organisation retombe sur celle du jeton, jamais sur une valeur fournie par
-- le client sans contrôle.

create or replace function ecoleplus.write_audit_log(
  p_action          text,
  p_resource_type   text,
  p_resource_id     text    default null,
  p_organization_id uuid    default null,
  p_establishment_id uuid   default null,
  p_old_value       jsonb   default null,
  p_new_value       jsonb   default null,
  p_reason          text    default null,
  p_context         jsonb   default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id      bigint;
  v_acteur  uuid := ecoleplus.current_profile_id();
begin
  insert into public.audit_logs (
    actor_profile_id, actor_label, organization_id, establishment_id,
    action, resource_type, resource_id, old_value, new_value, reason, context
  ) values (
    v_acteur,
    coalesce(
      nullif(trim(
        (select p.given_name || ' ' || p.family_name
           from public.profiles p where p.id = v_acteur)
      ), ''),
      'système'
    ),
    coalesce(p_organization_id, ecoleplus.current_org_id()),
    p_establishment_id,
    p_action, p_resource_type, p_resource_id, p_old_value, p_new_value, p_reason,
    p_context || jsonb_build_object('impersonating', ecoleplus.is_impersonating())
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function ecoleplus.write_audit_log(text, text, text, uuid, uuid, jsonb, jsonb, text, jsonb)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Immuabilité
-- -----------------------------------------------------------------------------
-- Les `ON DELETE SET NULL` des clés étrangères ci-dessus produisent des UPDATE
-- légitimes lorsqu'une organisation ou un compte est supprimé. Ils sont tolérés
-- à la seule condition de ne toucher que ces colonnes, et uniquement pour les
-- passer à NULL. Toute autre modification, et tout DELETE, sont refusés.

create or replace function ecoleplus.interdire_mutation_audit()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_avant jsonb;
  v_apres jsonb;
begin
  if tg_op = 'UPDATE' then
    v_avant := to_jsonb(old) - 'actor_profile_id' - 'organization_id' - 'establishment_id';
    v_apres := to_jsonb(new) - 'actor_profile_id' - 'organization_id' - 'establishment_id';

    if v_avant = v_apres
       and (new.actor_profile_id is null or new.actor_profile_id is not distinct from old.actor_profile_id)
       and (new.organization_id  is null or new.organization_id  is not distinct from old.organization_id)
       and (new.establishment_id is null or new.establishment_id is not distinct from old.establishment_id) then
      return new;
    end if;
  end if;

  raise exception 'ECOLEPLUS_AUDIT_IMMUABLE: le journal d''audit est en écriture seule (% interdit)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_immuable
  before update or delete on public.audit_logs
  for each row execute function ecoleplus.interdire_mutation_audit();
