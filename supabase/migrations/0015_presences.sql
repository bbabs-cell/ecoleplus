-- =============================================================================
-- 0015 — Présences
-- =============================================================================
-- Le point central : les STATUTS SONT UNE TABLE, pas une énumération.
--
-- « Présent, absent, retard, excusé » n'ont ni la même définition ni les mêmes
-- conséquences d'un pays et d'un établissement à l'autre. Un retard compte-t-il
-- comme une présence ? Une absence justifiée alimente-t-elle le décompte ? Les
-- réponses varient, et les figer dans un type PostgreSQL reviendrait à choisir
-- à la place du client (@CLAUDE.md, règle 2).
--
-- Deux drapeaux portent donc toute la logique de calcul :
--   is_present    — l'apprenant était-il là ?
--   counts_absent — l'événement alimente-t-il le décompte d'absences ?
-- =============================================================================

-- Pondération de période, repérée comme manquante à la relecture de la
-- conception antérieure : un trimestre peut peser plus qu'un autre dans la
-- moyenne annuelle (phase 3, calculs).
alter table public.academic_terms
  add column weight numeric(6,3) not null default 1
  constraint academic_terms_weight_positif check (weight > 0);

create type public.attendance_session_status as enum ('OPEN', 'VALIDATED');

-- -----------------------------------------------------------------------------
-- attendance_statuses
-- -----------------------------------------------------------------------------
-- `establishment_id` nul = statut valable dans toute l'organisation. Renseigné,
-- il surcharge pour un établissement donné.

create table public.attendance_statuses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  establishment_id uuid,
  name             text not null,
  code             text not null,
  color            text,
  -- L'apprenant était présent physiquement. Un retard l'est, une absence
  -- justifiée ne l'est pas.
  is_present       boolean not null default false,
  -- L'événement alimente le décompte d'absences. Indépendant du précédent :
  -- une absence justifiée peut être comptée ou non selon l'établissement.
  counts_absent    boolean not null default false,
  -- Exige un justificatif pour être posé.
  requires_justification boolean not null default false,
  position         smallint not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint attendance_statuses_name_non_vide check (length(trim(name)) > 0),
  constraint attendance_statuses_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

-- Unicité du code : au niveau organisation d'une part, par établissement d'autre
-- part. Un établissement peut donc redéfinir « RETARD » pour lui seul.
create unique index attendance_statuses_org_code_unique
  on public.attendance_statuses (organization_id, upper(code))
  where establishment_id is null;
create unique index attendance_statuses_etab_code_unique
  on public.attendance_statuses (establishment_id, upper(code))
  where establishment_id is not null;
create index attendance_statuses_org_idx
  on public.attendance_statuses (organization_id, position);

create unique index attendance_statuses_id_org_unique
  on public.attendance_statuses (id, organization_id);

create trigger attendance_statuses_touch_updated_at
  before update on public.attendance_statuses
  for each row execute function ecoleplus.touch_updated_at();

-- Jeu de départ posé à la création de l'organisation. Ce ne sont que des
-- valeurs initiales : l'établissement les renomme, les désactive ou en ajoute.
create or replace function ecoleplus.creer_statuts_presence()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.attendance_statuses
    (organization_id, name, code, is_present, counts_absent, requires_justification, position, color)
  values
    (new.id, 'Présent',            'PRESENT',   true,  false, false, 1, '#2f6b45'),
    (new.id, 'Absent',             'ABSENT',    false, true,  false, 2, '#9b2f2f'),
    (new.id, 'Retard',             'RETARD',    true,  false, false, 3, '#8a5a12'),
    (new.id, 'Absence justifiée',  'EXCUSE',    false, false, true,  4, '#1e5f57')
  on conflict do nothing;
  return new;
end;
$$;

create trigger organizations_creer_statuts_presence
  after insert on public.organizations
  for each row execute function ecoleplus.creer_statuts_presence();

-- -----------------------------------------------------------------------------
-- attendance_sessions — la séance appelée
-- -----------------------------------------------------------------------------

create table public.attendance_sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  academic_year_id uuid not null,
  class_id         uuid not null,
  subject_id       uuid,
  teacher_id       uuid,
  date_on          date not null,
  starts_at        time,
  ends_at          time,
  -- Séance, journée, atelier, sortie… texte libre.
  kind_label       text,
  status           public.attendance_session_status not null default 'OPEN',
  notes            text,
  validated_by     uuid references public.profiles (id) on delete set null,
  validated_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint attendance_sessions_horaires check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  -- La classe doit relever de l'année appelée : la clé composite l'impose.
  foreign key (class_id, academic_year_id)
    references public.classes (id, academic_year_id) on delete cascade,
  foreign key (subject_id, establishment_id)
    references public.subjects (id, establishment_id) on delete set null (subject_id),
  foreign key (teacher_id, establishment_id)
    references public.teachers (id, establishment_id) on delete set null (teacher_id)
);

-- Une seule séance par classe, date, matière et horaire de début. Le
-- `coalesce` neutralise les valeurs nulles, que l'unicité ignorerait sinon.
create unique index attendance_sessions_unique
  on public.attendance_sessions (
    class_id, date_on,
    coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(starts_at, '00:00'::time)
  );
create index attendance_sessions_classe_date_idx
  on public.attendance_sessions (class_id, date_on desc);
create index attendance_sessions_etablissement_date_idx
  on public.attendance_sessions (establishment_id, date_on desc);

create unique index attendance_sessions_id_org_unique
  on public.attendance_sessions (id, organization_id);

create trigger attendance_sessions_touch_updated_at
  before update on public.attendance_sessions
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- attendance_records
-- -----------------------------------------------------------------------------
-- L'enregistrement pointe vers l'INSCRIPTION, pas vers l'apprenant : c'est elle
-- qui porte l'année, l'établissement et la classe. Un apprenant transféré garde
-- ainsi les présences de sa scolarité précédente là où elles ont eu lieu.

create table public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  session_id      uuid not null,
  enrollment_id   uuid not null,
  status_id       uuid not null,
  comment         text,
  -- Chemin R2 du justificatif. Le téléversement arrive en phase 5 ; la colonne
  -- est posée maintenant pour ne pas avoir à migrer les données existantes.
  justification_path text,
  recorded_by     uuid references public.profiles (id) on delete set null,
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  foreign key (session_id, organization_id)
    references public.attendance_sessions (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade,
  foreign key (status_id, organization_id)
    references public.attendance_statuses (id, organization_id) on delete restrict
);

-- L'appel ne peut pas produire de doublon.
create unique index attendance_records_unique
  on public.attendance_records (session_id, enrollment_id);
create index attendance_records_inscription_idx
  on public.attendance_records (enrollment_id);
create index attendance_records_statut_idx
  on public.attendance_records (status_id);

create unique index attendance_records_id_org_unique
  on public.attendance_records (id, organization_id);

create trigger attendance_records_touch_updated_at
  before update on public.attendance_records
  for each row execute function ecoleplus.touch_updated_at();

-- L'inscription appelée doit appartenir à la classe de la séance. Aucune clé
-- composite ne l'exprime — la classe est une colonne de l'inscription, pas une
-- clé — donc un trigger s'en charge.
create or replace function ecoleplus.verifier_inscription_de_la_seance()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_classe_seance uuid;
  v_classe_inscription uuid;
  v_annee_seance uuid;
  v_annee_inscription uuid;
begin
  select class_id, academic_year_id into v_classe_seance, v_annee_seance
    from public.attendance_sessions where id = new.session_id;
  select class_id, academic_year_id into v_classe_inscription, v_annee_inscription
    from public.enrollments where id = new.enrollment_id;

  if v_annee_inscription is distinct from v_annee_seance then
    raise exception 'ECOLEPLUS_ANNEE_DISCORDANTE: cette inscription ne relève pas de l''année de la séance'
      using errcode = 'check_violation';
  end if;

  if v_classe_inscription is distinct from v_classe_seance then
    raise exception 'ECOLEPLUS_HORS_CLASSE: cet apprenant n''est pas inscrit dans la classe appelée'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger attendance_records_verifier_inscription
  before insert or update of session_id, enrollment_id on public.attendance_records
  for each row execute function ecoleplus.verifier_inscription_de_la_seance();

-- -----------------------------------------------------------------------------
-- attendance_corrections
-- -----------------------------------------------------------------------------
-- Une correction ne remplace pas l'historique : elle s'y ajoute. L'appel est
-- une pièce administrative, parfois opposable.

create table public.attendance_corrections (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  record_id       uuid not null,
  old_status_id   uuid,
  new_status_id   uuid not null,
  reason          text not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now(),
  constraint attendance_corrections_motif_non_vide check (length(trim(reason)) > 0),
  foreign key (record_id, organization_id)
    references public.attendance_records (id, organization_id) on delete cascade
);

create index attendance_corrections_record_idx
  on public.attendance_corrections (record_id, changed_at desc);

comment on table public.attendance_corrections is
  'Écriture seule. Une correction s''ajoute à l''historique, elle ne le réécrit pas.';

-- Garde d'immuabilité générique, sans hypothèse sur les colonnes de la table.
-- `interdire_mutation_audit` ne convenait pas : elle inspecte des colonnes
-- propres à `audit_logs` et aurait échoué sur un message illisible ailleurs.
create or replace function ecoleplus.interdire_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'ECOLEPLUS_HISTORIQUE_IMMUABLE: %.% est en écriture seule (% interdit)',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger attendance_corrections_immuable
  before update or delete on public.attendance_corrections
  for each row execute function ecoleplus.interdire_mutation();
