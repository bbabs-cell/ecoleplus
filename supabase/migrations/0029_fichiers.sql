-- =============================================================================
-- 0029 — Fichiers
-- =============================================================================
-- L'objet vit dans Cloudflare R2, la MÉTADONNÉE vit ici. C'est PostgreSQL qui
-- dit à qui un fichier appartient et qui peut le lire ; R2 ne fait que stocker
-- des octets sous une clé imprévisible.
--
-- Quatre décisions.
--
-- 1. LA CLÉ DE STOCKAGE NE SE DEVINE PAS. Elle dérive de l'identifiant du
--    fichier, jamais de son nom d'origine : `dossiers/awa-sow/bulletin.pdf`
--    ne doit mener nulle part, et un nom de fichier peut trahir une donnée
--    personnelle par sa seule présence dans une URL.
--
-- 2. UN FICHIER N'EST SERVI QUE S'IL EST CONFIRMÉ. Le dépôt se fait en deux
--    temps : la ligne naît en `PENDING`, et ne passe en `STORED` qu'une fois
--    l'objet réellement constaté dans R2. On ne croit pas le navigateur sur
--    parole (@CLAUDE.md, règle 3).
--
-- 3. LE RATTACHEMENT EST EXPLICITE, PAS POLYMORPHE. Trois colonnes, une
--    contrainte « exactement une renseignée », et des clés composites qui
--    portent l'organisation : un fichier ne peut pas pointer vers une donnée
--    d'un autre tenant, la base le refuse.
--
-- 4. UN FICHIER NE SE SUPPRIME PAS EN SILENCE. Suppression logique, motif,
--    journal d'audit (@CLAUDE.md, règle 5). La purge de l'objet R2 est une
--    opération d'exploitation distincte, pas un effet de bord d'un clic.
-- =============================================================================

create type public.file_status as enum ('PENDING', 'STORED', 'QUARANTINED', 'DELETED');

create table public.files (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  establishment_id uuid,

  -- Chemin de l'objet dans R2. Imprévisible par construction : il dérive de
  -- `id`, pas du nom d'origine.
  storage_key      text not null,
  original_name    text not null,
  mime_type        text not null,
  size_bytes       bigint not null,
  -- Empreinte fournie par le client, à titre indicatif. Elle ne fait pas
  -- foi : c'est la taille constatée dans R2 qui tranche.
  checksum         text,

  -- Libellé libre : « justificatif d'absence », « acte de naissance »… le
  -- vocabulaire administratif n'est pas le même d'un pays à l'autre.
  category_label   text,

  -- Rattachement. Exactement une des trois colonnes est renseignée.
  learner_id             uuid,
  enrollment_id          uuid,
  attendance_record_id   uuid,

  status           public.file_status not null default 'PENDING',
  uploaded_by      uuid references public.profiles (id) on delete set null,
  uploaded_at      timestamptz,
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles (id) on delete set null,
  delete_reason    text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint files_nom_non_vide check (length(trim(original_name)) > 0),
  constraint files_cle_non_vide check (length(trim(storage_key)) > 0),
  -- La clé ne doit jamais contenir le nom d'origine : on vérifie au moins
  -- qu'elle suit le motif attendu.
  constraint files_cle_format check (storage_key ~ '^org/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  constraint files_mime_format check (mime_type ~ '^[a-z]+/[a-zA-Z0-9.+-]+$'),
  -- 25 Mio. Plafond dur en base : une limite applicative seule se contourne.
  constraint files_taille check (size_bytes > 0 and size_bytes <= 26214400),
  constraint files_rattachement_unique check (
    num_nonnulls(learner_id, enrollment_id, attendance_record_id) = 1
  ),
  constraint files_motif_suppression check (
    deleted_at is null or length(trim(coalesce(delete_reason, ''))) > 0
  ),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  -- Clés composites : le rattachement ne peut pas franchir la frontière du
  -- tenant, quelle que soit la charge utile envoyée.
  foreign key (learner_id, organization_id)
    references public.learners (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade,
  foreign key (attendance_record_id, organization_id)
    references public.attendance_records (id, organization_id) on delete cascade
);

create unique index files_storage_key_unique on public.files (storage_key);
create index files_apprenant_idx on public.files (learner_id) where learner_id is not null;
create index files_inscription_idx on public.files (enrollment_id) where enrollment_id is not null;
create index files_presence_idx
  on public.files (attendance_record_id) where attendance_record_id is not null;
create index files_etablissement_idx
  on public.files (establishment_id, status, created_at desc);
create unique index files_id_org_unique on public.files (id, organization_id);

create trigger files_touch_updated_at
  before update on public.files
  for each row execute function ecoleplus.touch_updated_at();

comment on column public.files.storage_key is
  'Clé R2, dérivée de l''identifiant. Jamais du nom d''origine : une URL ne doit rien révéler.';
comment on column public.files.status is
  'PENDING tant que l''objet n''a pas été constaté dans R2. Un PENDING ne se sert jamais.';

-- -----------------------------------------------------------------------------
-- L'établissement du fichier suit celui de la cible
-- -----------------------------------------------------------------------------
-- Sans cela, un fichier rattaché à une inscription du lycée pourrait se
-- déclarer de l'annexe, et devenir lisible par les mauvaises personnes.

create or replace function ecoleplus.verifier_rattachement_fichier()
returns trigger
language plpgsql
set search_path to ''
as $$
declare v_etab uuid;
begin
  if new.enrollment_id is not null then
    select establishment_id into v_etab from public.enrollments where id = new.enrollment_id;
  elsif new.attendance_record_id is not null then
    select s.establishment_id into v_etab
      from public.attendance_records r
      join public.attendance_sessions s on s.id = r.session_id
     where r.id = new.attendance_record_id;
  else
    -- Un apprenant peut avoir plusieurs inscriptions, donc plusieurs
    -- établissements : son dossier reste au niveau de l'organisation.
    return new;
  end if;

  if v_etab is null then
    raise exception 'ECOLEPLUS_CIBLE_INTROUVABLE: la cible de ce fichier n''existe pas'
      using errcode = 'no_data_found';
  end if;

  if new.establishment_id is distinct from v_etab then
    raise exception 'ECOLEPLUS_ETABLISSEMENT_DISCORDANT: ce fichier ne relève pas de l''établissement de sa cible'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger files_verifier_rattachement
  before insert or update of learner_id, enrollment_id, attendance_record_id, establishment_id
  on public.files
  for each row execute function ecoleplus.verifier_rattachement_fichier();

-- -----------------------------------------------------------------------------
-- Une clé de stockage ne se réécrit pas
-- -----------------------------------------------------------------------------
-- La déplacer ferait pointer la métadonnée vers un autre objet, ou laisserait
-- un objet orphelin dans R2 sans que rien ne le signale.

create or replace function ecoleplus.figer_cle_stockage()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.storage_key is distinct from old.storage_key then
    raise exception 'ECOLEPLUS_CLE_FIGEE: la clé de stockage d''un fichier ne se modifie pas'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger files_cle_figee
  before update of storage_key on public.files
  for each row execute function ecoleplus.figer_cle_stockage();

-- -----------------------------------------------------------------------------
-- Le justificatif de présence rejoint les fichiers
-- -----------------------------------------------------------------------------
-- La phase 3a avait posé `attendance_records.justification_path` en prévision
-- de R2. La colonne devient redondante : le justificatif est désormais un
-- fichier comme un autre, avec ses permissions et sa trace. On la conserve
-- plutôt que de la détruire — une migration destructive sur des données
-- existantes n'a pas sa place ici — mais on la marque.

comment on column public.attendance_records.justification_path is
  'Obsolète depuis la phase 5 : le justificatif est un enregistrement de `files` rattaché par attendance_record_id.';
