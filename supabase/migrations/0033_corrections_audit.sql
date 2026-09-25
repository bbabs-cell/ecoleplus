-- =============================================================================
-- 0033 — Deux corrections issues de l'audit de sécurité
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. `fichier_telechargeable` était STABLE alors qu'elle écrit
-- -----------------------------------------------------------------------------
-- Elle journalise chaque téléchargement en appelant `write_audit_log`, qui est
-- VOLATILE. PostgreSQL n'interdit pas cet appel indirect dans une transaction
-- ordinaire — c'est pourquoi la suite de tests passait, psql ouvrant des
-- transactions en lecture-écriture.
--
-- Mais PostgREST exécute toute fonction STABLE ou IMMUTABLE dans une
-- transaction LECTURE SEULE. En production, chaque téléchargement aurait donc
-- échoué sur :
--
--     cannot execute INSERT in a read-only transaction
--
-- L'écran, lui, aurait affiché « Document introuvable » — la route traduit
-- toute erreur en 404 pour ne pas révéler l'existence d'un fichier. Le défaut
-- se serait présenté comme une absence, pas comme une panne.
--
-- La fonction écrit : elle est VOLATILE. Rien d'autre ne change.

create or replace function public.fichier_telechargeable(p_file_id uuid)
returns table (cle_stockage text, nom_origine text, type_mime text)
language plpgsql
-- VOLATILE (le défaut) : cette fonction journalise, elle ne peut pas être
-- déclarée STABLE sans casser son exécution côté PostgREST.
volatile
security definer
set search_path to ''
as $$
declare v_fichier public.files;
begin
  select * into v_fichier from public.files where id = p_file_id;

  -- Un fichier d'une autre organisation est traité comme inexistant : le
  -- message ne doit pas confirmer qu'il existe ailleurs.
  if v_fichier.id is null
     or v_fichier.organization_id is distinct from ecoleplus.current_org_id()
     or v_fichier.deleted_at is not null then
    raise exception 'ECOLEPLUS_FICHIER_INTROUVABLE: ce fichier n''existe pas'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_read(v_fichier.organization_id, 'files.read',
                            v_fichier.establishment_id) then
    raise exception 'ECOLEPLUS_FICHIER_INTROUVABLE: ce fichier n''existe pas'
      using errcode = 'no_data_found';
  end if;

  if v_fichier.status <> 'STORED' then
    raise exception 'ECOLEPLUS_FICHIER_NON_DISPONIBLE: ce dépôt n''a pas été confirmé'
      using errcode = 'no_data_found';
  end if;

  perform ecoleplus.write_audit_log(
    'files.downloaded', 'file', p_file_id::text,
    v_fichier.organization_id, v_fichier.establishment_id,
    null, jsonb_build_object('nom', v_fichier.original_name), null);

  return query select v_fichier.storage_key, v_fichier.original_name, v_fichier.mime_type;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. La portée d'un référentiel partagé pouvait être déplacée
-- -----------------------------------------------------------------------------
-- Trois tables ont un `establishment_id` NULLABLE : nul signifie « valable
-- dans toute l'organisation », renseigné signifie « propre à cet
-- établissement ». Leur policy d'écriture évalue `can_write(..., 
-- establishment_id)`, et `can_access_establishment(null)` rend `true` — ce qui
-- est correct pour LIRE un référentiel partagé.
--
-- Mais la clause `using` porte sur la ligne AVANT modification et la clause
-- `with check` sur la ligne APRÈS. Une ligne d'organisation passait donc la
-- première (portée nulle = accessible), et la seconde une fois rattachée à
-- l'établissement de l'appelant.
--
-- Scénario reproduit : l'administrateur de l'annexe exécute
--
--     update grading_systems set establishment_id = <son annexe> where code = 'NUM20'
--
-- Le barème sur 20, partagé par tous les établissements, devient celui de
-- l'annexe seule. Les autres le perdent de leur liste, et leur barème par
-- défaut disparaît avec lui. Aucune donnée ne franchit la frontière de
-- l'organisation — mais un établissement s'approprie le référentiel des autres.
--
-- Déplacer la portée n'est jamais une modification légitime : un référentiel
-- d'établissement se CRÉE, il ne se prend pas. La base le refuse désormais.
--
-- Et la même racine ouvrait une troisième porte, elle aussi reproduite : le
-- même administrateur pouvait CRÉER un barème — ou un statut de présence —
-- au niveau organisation, donc l'imposer à des établissements auxquels il n'a
-- aucun accès. `can_access_establishment(null)` rend `true`, ce qui convient
-- pour LIRE un référentiel partagé mais pas pour en écrire un.
--
-- Écrire une ligne de portée ORGANISATION exige désormais un rôle dont la
-- portée n'est pas l'établissement.

create or replace function ecoleplus.figer_portee_etablissement()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.establishment_id is distinct from old.establishment_id then
    raise exception 'ECOLEPLUS_PORTEE_FIGEE: la portée d''un référentiel ne se déplace pas ; créez-en un propre à l''établissement'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger grading_systems_portee_figee
  before update of establishment_id on public.grading_systems
  for each row execute function ecoleplus.figer_portee_etablissement();

create trigger grading_categories_portee_figee
  before update of establishment_id on public.grading_categories
  for each row execute function ecoleplus.figer_portee_etablissement();

create trigger attendance_statuses_portee_figee
  before update of establishment_id on public.attendance_statuses
  for each row execute function ecoleplus.figer_portee_etablissement();


create or replace function ecoleplus.can_write_portee_organisation(
  p_org_id uuid, p_permission text
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select ecoleplus.can_write(p_org_id, p_permission, null)
     -- Un rôle de portée ÉTABLISSEMENT ne façonne pas le référentiel commun :
     -- il ne voit qu'une partie de l'organisation, et l'imposerait au reste.
     and coalesce(ecoleplus.current_role_scope(), '') <> 'ESTABLISHMENT';
$$;

grant execute on function ecoleplus.can_write_portee_organisation(uuid, text) to authenticated;

-- Les trois policies distinguent désormais les deux portées. La lecture, elle,
-- ne change pas : un référentiel partagé reste visible de tous.

drop policy grading_systems_ecriture on public.grading_systems;
create policy grading_systems_ecriture on public.grading_systems
  for all to authenticated
  using (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'grades.configure')
         else ecoleplus.can_write(organization_id, 'grades.configure', establishment_id)
    end)
  with check (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'grades.configure')
         else ecoleplus.can_write(organization_id, 'grades.configure', establishment_id)
    end);

drop policy grading_categories_ecriture on public.grading_categories;
create policy grading_categories_ecriture on public.grading_categories
  for all to authenticated
  using (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'grades.configure')
         else ecoleplus.can_write(organization_id, 'grades.configure', establishment_id)
    end)
  with check (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'grades.configure')
         else ecoleplus.can_write(organization_id, 'grades.configure', establishment_id)
    end);

drop policy attendance_statuses_ecriture on public.attendance_statuses;
create policy attendance_statuses_ecriture on public.attendance_statuses
  for all to authenticated
  using (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'attendance.configure')
         else ecoleplus.can_write(organization_id, 'attendance.configure', establishment_id)
    end)
  with check (
    case when establishment_id is null
         then ecoleplus.can_write_portee_organisation(organization_id, 'attendance.configure')
         else ecoleplus.can_write(organization_id, 'attendance.configure', establishment_id)
    end);
