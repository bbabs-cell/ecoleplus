-- =============================================================================
-- 0019 — Moteur de notation
-- =============================================================================
-- Deux idées portent tout le reste.
--
-- 1. LE BARÈME EST UNE DONNÉE. Sur 10, sur 20, sur 100, A–F, niveaux de
--    maîtrise, appréciations maison : plusieurs systèmes coexistent dans une
--    même organisation et jusque dans un même établissement. Une classe peut
--    être notée sur 20 pendant qu'une formation professionnelle fonctionne par
--    niveaux de maîtrise (@CLAUDE.md, règle 2).
--
-- 2. UNE NOTE MANQUANTE N'EST PAS UN ZÉRO (@CLAUDE.md, règle 4). Neuf
--    situations doivent rester distinctes : non saisie, saisie, validée,
--    publiée, absence, absence justifiée, dispense, invalidée, zéro réel.
--    Elles se répartissent sur deux axes indépendants :
--
--      kind   — ce que la note EST      (score, absence, dispense, N/A…)
--      status — où elle en EST          (brouillon → saisie → … → publiée)
--
--    Et une contrainte rend la confusion physiquement impossible :
--        (kind = 'SCORE') = (raw_value is not null)
--    Une absence ne PEUT PAS porter de valeur ; un score en porte toujours une.
--    Aucun code applicatif ne peut donc transformer l'une en l'autre.
-- =============================================================================

-- Supabase range ses extensions dans le schéma `extensions` ; une base nue
-- (celle des tests locaux) n'a pas ce schéma. On suit la convention là où elle
-- existe, sans se rendre dépendant d'elle.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions') then
    execute 'create extension if not exists btree_gist with schema extensions';
  else
    execute 'create extension if not exists btree_gist';
  end if;
end;
$$;

create type public.grading_system_type as enum ('NUMERIC', 'LETTER', 'MASTERY', 'CUSTOM');
create type public.rounding_mode        as enum ('ROUND', 'FLOOR', 'CEIL');
create type public.grading_system_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- Ce que la note est. Seul 'SCORE' porte une valeur.
create type public.grade_kind as enum (
  'SCORE',           -- une valeur saisie — y compris un zéro réel
  'ABSENT',          -- absent à l'évaluation
  'EXCUSED',         -- absent, justifié
  'EXEMPT',          -- dispensé : l'évaluation ne le concerne pas
  'NOT_APPLICABLE',  -- sans objet pour cet apprenant
  'PENDING'          -- ligne ouverte, rien de saisi
);

-- Où la note en est. La publication fige.
create type public.grade_status as enum (
  'DRAFT', 'CAPTURED', 'VERIFIED', 'PUBLISHED', 'CORRECTED', 'CANCELLED', 'ARCHIVED'
);

create type public.assessment_status as enum (
  'DRAFT', 'OPEN', 'VERIFIED', 'PUBLISHED', 'CANCELLED'
);

-- Que faire d'une note manquante dans une moyenne. Jamais implicite.
create type public.missing_grade_policy as enum (
  'SKIP',      -- ignorée : la moyenne porte sur les notes présentes
  'ZERO',      -- comptée comme zéro — choix explicite de l'établissement
  'EXCLUDED'   -- l'évaluation ne concerne pas l'apprenant
);

-- -----------------------------------------------------------------------------
-- grading_systems
-- -----------------------------------------------------------------------------
-- `establishment_id` nul = système valable dans toute l'organisation.

create table public.grading_systems (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  establishment_id uuid,
  name             text not null,
  code             text not null,
  type             public.grading_system_type not null,
  min_value        numeric(10,4) not null,
  max_value        numeric(10,4) not null,
  -- « points », « %, « crédits »… purement libellé.
  unit             text,
  pass_threshold   numeric(10,4),
  rounding_mode    public.rounding_mode not null default 'ROUND',
  decimals         smallint not null default 2,
  status           public.grading_system_status not null default 'DRAFT',
  valid_from       date,
  valid_until      date,
  version          integer not null default 1,
  -- Moyenner des niveaux de maîtrise n'a pas toujours de sens. Plutôt que de
  -- trancher à la place du client, on lui laisse le dire.
  allows_averaging boolean not null default true,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint grading_systems_name_non_vide check (length(trim(name)) > 0),
  constraint grading_systems_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint grading_systems_bornes check (max_value > min_value),
  constraint grading_systems_seuil_dans_echelle check (
    pass_threshold is null or pass_threshold between min_value and max_value
  ),
  constraint grading_systems_decimales check (decimals between 0 and 4),
  constraint grading_systems_validite check (
    valid_from is null or valid_until is null or valid_until > valid_from
  ),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create unique index grading_systems_org_code_unique
  on public.grading_systems (organization_id, upper(code), version)
  where establishment_id is null;
create unique index grading_systems_etab_code_unique
  on public.grading_systems (establishment_id, upper(code), version)
  where establishment_id is not null;
create index grading_systems_org_idx on public.grading_systems (organization_id, status);

-- Un seul barème par défaut par périmètre.
create unique index grading_systems_defaut_org_unique
  on public.grading_systems (organization_id)
  where is_default and establishment_id is null;
create unique index grading_systems_defaut_etab_unique
  on public.grading_systems (establishment_id)
  where is_default and establishment_id is not null;

create unique index grading_systems_id_org_unique
  on public.grading_systems (id, organization_id);
create unique index grading_systems_id_etab_unique
  on public.grading_systems (id, establishment_id)
  where establishment_id is not null;

create trigger grading_systems_touch_updated_at
  before update on public.grading_systems
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- grading_scales — les tranches d'un système
-- -----------------------------------------------------------------------------
-- A = 16→20, B = 13→15.99. Bornes INCLUSES des deux côtés : c'est ainsi que les
-- barèmes s'écrivent réellement, et l'exclusion ci-dessous rend le
-- chevauchement impossible — pas « détecté plus tard », impossible.

create table public.grading_scales (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  grading_system_id uuid not null,
  label             text not null,
  description       text,
  min_score         numeric(10,4) not null,
  max_score         numeric(10,4) not null,
  position          smallint not null default 0,
  color             text,
  -- Cette tranche vaut-elle réussite ? Indépendant du seuil numérique : un
  -- système par niveaux de maîtrise n'a pas de seuil, mais a des tranches
  -- acquises et non acquises.
  is_passing        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint grading_scales_label_non_vide check (length(trim(label)) > 0),
  constraint grading_scales_bornes check (max_score >= min_score),
  foreign key (grading_system_id, organization_id)
    references public.grading_systems (id, organization_id) on delete cascade,

  -- Deux tranches d'un même système ne peuvent pas se recouvrir.
  constraint grading_scales_sans_chevauchement
    exclude using gist (
      grading_system_id with =,
      numrange(min_score, max_score, '[]') with &&
    )
);

create index grading_scales_systeme_idx
  on public.grading_scales (grading_system_id, position);
create unique index grading_scales_id_org_unique
  on public.grading_scales (id, organization_id);

create trigger grading_scales_touch_updated_at
  before update on public.grading_scales
  for each row execute function ecoleplus.touch_updated_at();

-- Une tranche doit tenir dans l'échelle de son système.
create or replace function ecoleplus.verifier_tranche()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_min numeric;
  v_max numeric;
begin
  select min_value, max_value into v_min, v_max
    from public.grading_systems where id = new.grading_system_id;

  if new.min_score < v_min or new.max_score > v_max then
    raise exception 'ECOLEPLUS_TRANCHE_HORS_ECHELLE: la tranche %–% sort de l''échelle %–%',
      new.min_score, new.max_score, v_min, v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger grading_scales_verifier_tranche
  before insert or update of min_score, max_score, grading_system_id
  on public.grading_scales
  for each row execute function ecoleplus.verifier_tranche();

-- -----------------------------------------------------------------------------
-- grading_categories — contrôle continu, examen, projet…
-- -----------------------------------------------------------------------------

create table public.grading_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  establishment_id uuid,
  name             text not null,
  code             text not null,
  weight           numeric(8,4) not null default 1,
  position         smallint not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint grading_categories_name_non_vide check (length(trim(name)) > 0),
  constraint grading_categories_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint grading_categories_poids check (weight > 0),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create unique index grading_categories_org_code_unique
  on public.grading_categories (organization_id, upper(code))
  where establishment_id is null;
create unique index grading_categories_etab_code_unique
  on public.grading_categories (establishment_id, upper(code))
  where establishment_id is not null;
create unique index grading_categories_id_org_unique
  on public.grading_categories (id, organization_id);

create trigger grading_categories_touch_updated_at
  before update on public.grading_categories
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- class_subjects — le programme d'une classe, et ses coefficients
-- -----------------------------------------------------------------------------
-- Manque n° 2 relevé dans @docs/reprise-projet-precedent.md : les coefficients
-- par matière vivaient dans `program_subjects`. Les parcours n'existent pas
-- encore ; la classe est le porteur naturel en attendant, et `teaching_
-- assignments` ne convenait pas — une matière peut y avoir deux enseignants,
-- le coefficient y serait dupliqué.

create table public.class_subjects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  establishment_id  uuid not null,
  class_id          uuid not null,
  subject_id        uuid not null,
  coefficient       numeric(8,4) not null default 1,
  -- Surcharge le barème de la classe pour cette matière seulement.
  grading_system_id uuid,
  position          smallint not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint class_subjects_coefficient check (coefficient > 0),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (class_id, establishment_id)
    references public.classes (id, establishment_id) on delete cascade,
  foreign key (subject_id, establishment_id)
    references public.subjects (id, establishment_id) on delete cascade,
  foreign key (grading_system_id, organization_id)
    references public.grading_systems (id, organization_id) on delete set null (grading_system_id)
);

create unique index class_subjects_unique on public.class_subjects (class_id, subject_id);
create index class_subjects_matiere_idx on public.class_subjects (subject_id);
create unique index class_subjects_id_org_unique on public.class_subjects (id, organization_id);

create trigger class_subjects_touch_updated_at
  before update on public.class_subjects
  for each row execute function ecoleplus.touch_updated_at();

-- Barème par défaut de la classe, quand la matière n'en impose pas.
alter table public.classes
  add column grading_system_id uuid,
  add constraint classes_grading_system_fkey
    foreign key (grading_system_id, organization_id)
    references public.grading_systems (id, organization_id) on delete set null (grading_system_id);

-- -----------------------------------------------------------------------------
-- assessments — l'évaluation
-- -----------------------------------------------------------------------------

create table public.assessments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  establishment_id  uuid not null,
  academic_year_id  uuid not null,
  academic_term_id  uuid,
  class_id          uuid not null,
  subject_id        uuid not null,
  teacher_id        uuid,
  category_id       uuid,
  grading_system_id uuid not null,
  title             text not null,
  description       text,
  date_on           date not null,
  coefficient       numeric(8,4) not null default 1,
  -- Réglable par évaluation. Défaut SKIP : ne jamais transformer une absence
  -- de note en zéro sans que quelqu'un l'ait décidé.
  missing_grade_policy public.missing_grade_policy not null default 'SKIP',
  status            public.assessment_status not null default 'DRAFT',
  published_by      uuid references public.profiles (id) on delete set null,
  published_at      timestamptz,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint assessments_title_non_vide check (length(trim(title)) > 0),
  constraint assessments_coefficient check (coefficient > 0),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  foreign key (academic_term_id, organization_id)
    references public.academic_terms (id, organization_id) on delete set null (academic_term_id),
  -- La classe relève de l'année évaluée : la clé composite l'impose.
  foreign key (class_id, academic_year_id)
    references public.classes (id, academic_year_id) on delete cascade,
  foreign key (subject_id, establishment_id)
    references public.subjects (id, establishment_id) on delete cascade,
  foreign key (teacher_id, establishment_id)
    references public.teachers (id, establishment_id) on delete set null (teacher_id),
  foreign key (category_id, organization_id)
    references public.grading_categories (id, organization_id) on delete set null (category_id),
  foreign key (grading_system_id, organization_id)
    references public.grading_systems (id, organization_id) on delete restrict
);

create index assessments_classe_idx on public.assessments (class_id, date_on desc);
create index assessments_matiere_idx on public.assessments (subject_id, academic_year_id);
create index assessments_periode_idx on public.assessments (academic_term_id);
create index assessments_etablissement_idx
  on public.assessments (establishment_id, academic_year_id, date_on desc);

create unique index assessments_id_org_unique on public.assessments (id, organization_id);

create trigger assessments_touch_updated_at
  before update on public.assessments
  for each row execute function ecoleplus.touch_updated_at();

-- La période doit relever de l'année évaluée.
create or replace function ecoleplus.verifier_periode_evaluation()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_annee uuid;
begin
  if new.academic_term_id is null then return new; end if;

  select academic_year_id into v_annee
    from public.academic_terms where id = new.academic_term_id;

  if v_annee is distinct from new.academic_year_id then
    raise exception 'ECOLEPLUS_PERIODE_DISCORDANTE: cette période ne relève pas de l''année de l''évaluation'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger assessments_verifier_periode
  before insert or update of academic_term_id, academic_year_id on public.assessments
  for each row execute function ecoleplus.verifier_periode_evaluation();

-- -----------------------------------------------------------------------------
-- assessment_results — la note
-- -----------------------------------------------------------------------------

create table public.assessment_results (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  assessment_id    uuid not null,
  enrollment_id    uuid not null,

  kind             public.grade_kind not null default 'PENDING',
  -- Valeur telle que saisie, sur l'échelle du barème de l'évaluation.
  raw_value        numeric(10,4),
  -- Tranche retenue : saisie directe pour un barème par lettres ou par niveaux
  -- de maîtrise, déduite de la valeur pour un barème numérique.
  scale_id         uuid,
  -- Valeur ramenée dans [0,1] par le déclencheur, seule base des moyennes :
  -- c'est elle qui permet de mêler un /20 et un /100 sans supposer que l'un
  -- des deux est la norme.
  normalized_value numeric(12,8),

  status           public.grade_status not null default 'DRAFT',
  comment          text,
  entered_by       uuid references public.profiles (id) on delete set null,
  entered_at       timestamptz,
  verified_by      uuid references public.profiles (id) on delete set null,
  verified_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- =========================================================================
  -- LA contrainte du module (@CLAUDE.md, règle 4).
  --
  -- Une valeur n'existe que pour un score ; un score en porte toujours une.
  -- Un zéro réel est donc (SCORE, 0) et une absence (ABSENT, null) : aucune
  -- écriture, d'où qu'elle vienne, ne peut produire l'un en croyant l'autre.
  -- =========================================================================
  constraint assessment_results_valeur_si_score
    check ((kind = 'SCORE') = (raw_value is not null)),

  -- Une note non saisie n'entre dans aucun calcul.
  constraint assessment_results_normalisation
    check ((normalized_value is null) or (kind = 'SCORE')),

  foreign key (assessment_id, organization_id)
    references public.assessments (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade,
  foreign key (scale_id, organization_id)
    references public.grading_scales (id, organization_id) on delete set null (scale_id)
);

-- Une seule note par évaluation et par inscription.
create unique index assessment_results_unique
  on public.assessment_results (assessment_id, enrollment_id);
create index assessment_results_inscription_idx
  on public.assessment_results (enrollment_id);
create index assessment_results_statut_idx
  on public.assessment_results (assessment_id, status);

create unique index assessment_results_id_org_unique
  on public.assessment_results (id, organization_id);

create trigger assessment_results_touch_updated_at
  before update on public.assessment_results
  for each row execute function ecoleplus.touch_updated_at();

comment on column public.assessment_results.raw_value is
  'Null hors kind = SCORE. Un zéro saisi est un résultat ; une absence de résultat n''en est pas un.';

-- -----------------------------------------------------------------------------
-- Normalisation et bornes
-- -----------------------------------------------------------------------------
-- Le calcul ne passe pas par le code applicatif : quelle que soit la voie
-- d'écriture, c'est la base qui borne la valeur et qui la normalise.

create or replace function ecoleplus.normaliser_resultat()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_systeme public.grading_systems;
  v_tranche public.grading_scales;
begin
  select gs.* into v_systeme
    from public.grading_systems gs
    join public.assessments a on a.grading_system_id = gs.id
   where a.id = new.assessment_id;

  if v_systeme.id is null then
    raise exception 'ECOLEPLUS_BAREME_INTROUVABLE: l''évaluation n''a pas de barème exploitable'
      using errcode = 'check_violation';
  end if;

  -- Saisie par tranche (lettres, niveaux de maîtrise) : la valeur numérique se
  -- déduit du MILIEU de la tranche. C'est une convention, et elle est assumée :
  -- moyenner des lettres suppose de leur prêter une valeur, faute de quoi la
  -- moyenne n'existe pas. Un établissement qui refuse ce postulat pose
  -- allows_averaging = false sur son barème.
  if new.kind = 'SCORE' and new.raw_value is null and new.scale_id is not null then
    select * into v_tranche from public.grading_scales where id = new.scale_id;
    if v_tranche.id is not null then
      new.raw_value := (v_tranche.min_score + v_tranche.max_score) / 2;
    end if;
  end if;

  if new.kind <> 'SCORE' then
    new.raw_value := null;
    new.normalized_value := null;
    return new;
  end if;

  if new.raw_value < v_systeme.min_value or new.raw_value > v_systeme.max_value then
    raise exception 'ECOLEPLUS_NOTE_HORS_ECHELLE: % sort de l''échelle %–%',
      new.raw_value, v_systeme.min_value, v_systeme.max_value
      using errcode = 'check_violation';
  end if;

  new.normalized_value :=
    (new.raw_value - v_systeme.min_value) / (v_systeme.max_value - v_systeme.min_value);

  -- Tranche correspondante, pour l'affichage. Un barème sans tranche n'en a pas.
  if new.scale_id is null then
    select id into new.scale_id
      from public.grading_scales
     where grading_system_id = v_systeme.id
       and new.raw_value between min_score and max_score
     order by position
     limit 1;
  end if;

  return new;
end;
$$;

create trigger assessment_results_normaliser
  before insert or update of kind, raw_value, scale_id, assessment_id
  on public.assessment_results
  for each row execute function ecoleplus.normaliser_resultat();

-- -----------------------------------------------------------------------------
-- assessment_result_histories — ne se purge jamais
-- -----------------------------------------------------------------------------

create table public.assessment_result_histories (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  result_id       uuid not null,
  action          text not null,
  old_value       jsonb,
  new_value       jsonb,
  reason          text,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now(),
  constraint assessment_result_histories_action_non_vide check (length(trim(action)) > 0),
  foreign key (result_id, organization_id)
    references public.assessment_results (id, organization_id) on delete cascade
);

create index assessment_result_histories_resultat_idx
  on public.assessment_result_histories (result_id, changed_at desc);

comment on table public.assessment_result_histories is
  'Écriture seule. Toute transition d''une note s''y ajoute et ne s''en retire jamais.';

create trigger assessment_result_histories_immuable
  before update or delete on public.assessment_result_histories
  for each row execute function ecoleplus.interdire_mutation();

-- -----------------------------------------------------------------------------
-- Un barème publié ne se réécrit pas
-- -----------------------------------------------------------------------------
-- Scénario de sécurité n° 10 de @docs/reprise-projet-precedent.md : déplacer
-- l'échelle après publication changerait rétroactivement des bulletins déjà
-- remis aux familles. La voie légitime est une NOUVELLE VERSION du barème.

create or replace function ecoleplus.bareme_fige()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_systeme uuid;
  v_publiees integer;
begin
  -- Un IF, et non un CASE : plpgsql évalue une expression CASE en entier, si
  -- bien que `old.grading_system_id` y serait résolu même sur `grading_systems`,
  -- où cette colonne n'existe pas. Seule la branche prise doit l'être.
  if tg_table_name = 'grading_systems' then
    v_systeme := old.id;
  else
    v_systeme := old.grading_system_id;
  end if;

  select count(*) into v_publiees
    from public.assessment_results r
    join public.assessments a on a.id = r.assessment_id
   where a.grading_system_id = v_systeme
     and r.status in ('PUBLISHED', 'ARCHIVED');

  if v_publiees > 0 then
    raise exception 'ECOLEPLUS_BAREME_PUBLIE: ce barème porte % note(s) publiée(s) ; créez-en une nouvelle version', v_publiees
      using errcode = 'insufficient_privilege';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

-- Seules les colonnes qui changent les CALCULS sont gelées : renommer le
-- barème ou changer sa couleur reste possible après publication.
create trigger grading_systems_fige_apres_publication
  before update of min_value, max_value, pass_threshold, rounding_mode, decimals, type
  on public.grading_systems
  for each row execute function ecoleplus.bareme_fige();

create trigger grading_systems_suppression_fige
  before delete on public.grading_systems
  for each row execute function ecoleplus.bareme_fige();

create trigger grading_scales_fige_apres_publication
  before update of min_score, max_score, grading_system_id
  on public.grading_scales
  for each row execute function ecoleplus.bareme_fige();

create trigger grading_scales_suppression_fige
  before delete on public.grading_scales
  for each row execute function ecoleplus.bareme_fige();
