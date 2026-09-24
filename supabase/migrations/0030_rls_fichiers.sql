-- =============================================================================
-- 0030 — RLS et opérations sur les fichiers
-- =============================================================================
-- Scénario de sécurité n° 7 de @docs/reprise-projet-precedent.md :
-- « téléchargement d'un document non autorisé ».
--
-- Trois barrières, dans cet ordre :
--   1. RLS — un fichier hors périmètre n'est même pas visible ;
--   2. la fonction `fichier_telechargeable`, qui refuse de désigner un fichier
--      non confirmé, supprimé, ou hors permission ;
--   3. l'URL signée elle-même, valable quelques secondes et produite
--      uniquement côté serveur.
--
-- Connaître l'identifiant d'un fichier ne donne donc aucun accès, et connaître
-- une URL signée périmée n'en donne pas davantage.
-- =============================================================================

alter table public.files enable row level security;

revoke all on public.files from anon, authenticated;
-- Les fichiers ne s'écrivent que par fonction : le dépôt en deux temps et la
-- suppression tracée ne peuvent pas être contournés par un INSERT direct.
grant select on public.files to authenticated;

create policy files_select on public.files
  for select to authenticated
  using (
    ecoleplus.can_read(organization_id, 'files.read', establishment_id)
    -- Un fichier supprimé reste en base pour l'audit, mais sort de la vue.
    and deleted_at is null
  );

-- -----------------------------------------------------------------------------
-- Préparer un dépôt
-- -----------------------------------------------------------------------------
-- Crée la ligne en `PENDING` et rend sa clé de stockage. L'appelant signe
-- ensuite une URL de dépôt à partir de cette clé — côté serveur, jamais côté
-- navigateur.
--
-- La taille annoncée ici est déclarative : c'est `confirmer_fichier` qui
-- tranche, avec la taille réellement constatée dans R2.

create or replace function public.preparer_fichier(
  p_original_name text,
  p_mime_type     text,
  p_size_bytes    bigint,
  p_category      text default null,
  p_learner_id    uuid default null,
  p_enrollment_id uuid default null,
  p_record_id     uuid default null
)
-- Les colonnes de sortie ne s'appellent ni `id` ni `storage_key` : plpgsql
-- traite les paramètres OUT comme des variables, et `insert into files (id…)`
-- deviendrait ambigu.
returns table (fichier_id uuid, cle_stockage text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org   uuid := ecoleplus.current_org_id();
  v_etab  uuid;
  v_id    uuid := gen_random_uuid();
  v_cle   text;
begin
  if v_org is null then
    raise exception 'ECOLEPLUS_CONTEXTE_ABSENT: aucune organisation active'
      using errcode = 'insufficient_privilege';
  end if;

  if num_nonnulls(p_learner_id, p_enrollment_id, p_record_id) <> 1 then
    raise exception 'ECOLEPLUS_RATTACHEMENT_INVALIDE: un fichier se rattache à exactement une cible'
      using errcode = 'check_violation';
  end if;

  -- L'établissement se DÉDUIT de la cible ; il ne se déclare pas. Le laisser
  -- déclarer reviendrait à laisser l'appelant choisir qui pourra lire.
  if p_enrollment_id is not null then
    select establishment_id into v_etab from public.enrollments where id = p_enrollment_id;
  elsif p_record_id is not null then
    select s.establishment_id into v_etab
      from public.attendance_records r
      join public.attendance_sessions s on s.id = r.session_id
     where r.id = p_record_id;
  end if;

  if not ecoleplus.can_write(v_org, 'files.upload', v_etab) then
    raise exception 'ECOLEPLUS_PERMISSION: déposer un fichier exige la permission files.upload'
      using errcode = 'insufficient_privilege';
  end if;

  v_cle := format('org/%s/%s', v_org, v_id);

  insert into public.files
    (id, organization_id, establishment_id, storage_key, original_name, mime_type,
     size_bytes, category_label, learner_id, enrollment_id, attendance_record_id,
     status, uploaded_by)
  values
    (v_id, v_org, v_etab, v_cle, trim(p_original_name), lower(trim(p_mime_type)),
     p_size_bytes, nullif(trim(coalesce(p_category, '')), ''),
     p_learner_id, p_enrollment_id, p_record_id, 'PENDING',
     ecoleplus.current_profile_id());

  return query select v_id, v_cle;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmer un dépôt
-- -----------------------------------------------------------------------------
-- Appelée UNIQUEMENT après que le serveur a constaté l'objet dans R2, avec sa
-- taille réelle. Un écart avec la taille annoncée met le fichier en
-- quarantaine plutôt que de le servir.

create or replace function public.confirmer_fichier(
  p_file_id uuid,
  p_size_constatee bigint
)
returns public.file_status
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_fichier public.files;
  v_statut  public.file_status;
begin
  select * into v_fichier from public.files where id = p_file_id;

  if v_fichier.id is null
     or v_fichier.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_FICHIER_INTROUVABLE: ce fichier n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_fichier.organization_id, 'files.upload',
                             v_fichier.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: confirmer un dépôt exige la permission files.upload'
      using errcode = 'insufficient_privilege';
  end if;

  if v_fichier.status <> 'PENDING' then
    return v_fichier.status;
  end if;

  -- La taille annoncée par le navigateur n'engage personne. Celle que R2
  -- rapporte, si. Un écart n'est pas forcément une attaque, mais ce n'est
  -- jamais un dépôt réussi.
  if p_size_constatee is null or p_size_constatee <= 0
     or p_size_constatee > 26214400
     or p_size_constatee is distinct from v_fichier.size_bytes then
    v_statut := 'QUARANTINED';
  else
    v_statut := 'STORED';
  end if;

  update public.files
     set status = v_statut,
         size_bytes = coalesce(p_size_constatee, size_bytes),
         uploaded_at = now()
   where id = p_file_id;

  perform ecoleplus.write_audit_log(
    case v_statut when 'STORED' then 'files.uploaded' else 'files.quarantined' end,
    'file', p_file_id::text,
    v_fichier.organization_id, v_fichier.establishment_id,
    null,
    jsonb_build_object('nom', v_fichier.original_name, 'type', v_fichier.mime_type,
                       'taille_annoncee', v_fichier.size_bytes,
                       'taille_constatee', p_size_constatee),
    null);

  return v_statut;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autoriser un téléchargement
-- -----------------------------------------------------------------------------
-- Le serveur appelle ceci AVANT de signer quoi que ce soit. Rendre la clé
-- n'est pas anodin : c'est la seule fonction qui la livre, et elle ne la livre
-- qu'après avoir tout vérifié.

create or replace function public.fichier_telechargeable(p_file_id uuid)
returns table (cle_stockage text, nom_origine text, type_mime text)
language plpgsql
stable
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

  -- Un dépôt jamais confirmé, ou mis en quarantaine, ne se sert pas.
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
-- Supprimer un fichier
-- -----------------------------------------------------------------------------
-- Suppression LOGIQUE, avec motif. L'objet R2 se purge ensuite par une
-- opération d'exploitation séparée : effacer les octets dans le même geste
-- rendrait toute erreur irréversible.

create or replace function public.supprimer_fichier(p_file_id uuid, p_raison text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_fichier public.files;
begin
  select * into v_fichier from public.files where id = p_file_id;

  if v_fichier.id is null
     or v_fichier.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_FICHIER_INTROUVABLE: ce fichier n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_fichier.organization_id, 'files.delete',
                             v_fichier.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: supprimer un fichier exige la permission files.delete'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: supprimer un fichier exige un motif'
      using errcode = 'check_violation';
  end if;

  if v_fichier.deleted_at is not null then
    return;
  end if;

  update public.files
     set status = 'DELETED',
         deleted_at = now(),
         deleted_by = ecoleplus.current_profile_id(),
         delete_reason = trim(p_raison)
   where id = p_file_id;

  perform ecoleplus.write_audit_log(
    'files.deleted', 'file', p_file_id::text,
    v_fichier.organization_id, v_fichier.establishment_id,
    jsonb_build_object('nom', v_fichier.original_name, 'statut', v_fichier.status),
    jsonb_build_object('statut', 'DELETED'), p_raison);
end;
$$;

revoke all on function
  public.preparer_fichier(text, text, bigint, text, uuid, uuid, uuid),
  public.confirmer_fichier(uuid, bigint),
  public.fichier_telechargeable(uuid),
  public.supprimer_fichier(uuid, text)
from public, anon;

grant execute on function
  public.preparer_fichier(text, text, bigint, text, uuid, uuid, uuid),
  public.confirmer_fichier(uuid, bigint),
  public.fichier_telechargeable(uuid),
  public.supprimer_fichier(uuid, text)
to authenticated;
