-- =============================================================================
-- 0010 — Enseignants, apprenants, inscriptions
-- =============================================================================
-- Deux choix de modélisation structurants :
--
-- 1. Un ENSEIGNANT n'est pas forcément un compte. Beaucoup d'établissements
--    saisissent leurs enseignants bien avant de leur ouvrir un accès, et
--    certains ne leur en ouvrent jamais. `profile_id` est donc optionnel, et
--    l'identité vit dans la table.
--
-- 2. Un APPRENANT appartient à l'ORGANISATION, pas à l'établissement. C'est ce
--    qui rend le statut « transféré » réalisable : l'élève qui change d'école
--    au sein d'un groupe garde son dossier, son historique et son identifiant.
--    Le rattachement à un établissement passe par l'inscription, qui est
--    annuelle.
--
-- Les responsables légaux (parents/tuteurs) ne sont PAS ici : la phase 2 de la
-- feuille de route ne les liste pas, et les poser à moitié — sans lien de
-- responsabilité ni portail — vaudrait moins que de les poser correctement
-- avec le module qui les exploite.
-- =============================================================================

create type public.teacher_status as enum ('ACTIVE', 'INACTIVE');

-- Les huit statuts du cahier des charges, dans l'ordre du cycle de vie.
create type public.enrollment_status as enum (
  'PREREGISTERED',  -- préinscrit
  'ENROLLED',       -- inscrit (dossier complet)
  'ACTIVE',         -- actif (scolarité en cours)
  'SUSPENDED',      -- suspendu
  'TRANSFERRED',    -- transféré
  'GRADUATED',      -- diplômé
  'DROPPED_OUT',    -- abandon
  'ARCHIVED'        -- archivé
);

-- -----------------------------------------------------------------------------
-- teachers
-- -----------------------------------------------------------------------------
-- Rattaché à un établissement. Une personne qui enseigne dans deux
-- établissements y a deux fiches : la mutualisation viendra si le besoin est
-- réel, pas par anticipation.

create table public.teachers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  -- Compte applicatif, si la personne en a un.
  profile_id       uuid,
  given_name       text not null,
  family_name      text not null,
  email            text,
  phone            text,
  staff_code       text,
  status           public.teacher_status not null default 'ACTIVE',
  hired_on         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint teachers_nom_non_vide check (length(trim(given_name || family_name)) > 0),
  constraint teachers_email_format check (
    email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  -- Le compte lié doit être membre de CETTE organisation. La contrainte
  -- s'appuie sur l'unicité (profile_id, organization_id) des adhésions : aucun
  -- trigger n'est nécessaire, la base refuse le rattachement croisé.
  -- `set null (profile_id)` ne vide que cette colonne, pas l'organisation.
  foreign key (profile_id, organization_id)
    references public.organization_memberships (profile_id, organization_id)
    on delete set null (profile_id)
);

-- Un compte ne pilote qu'une fiche enseignant par établissement.
create unique index teachers_profil_etablissement_unique
  on public.teachers (establishment_id, profile_id) where profile_id is not null;
create unique index teachers_etablissement_code_unique
  on public.teachers (establishment_id, upper(staff_code)) where staff_code is not null;
create index teachers_etablissement_nom_idx
  on public.teachers (establishment_id, family_name, given_name);

create unique index teachers_id_org_unique
  on public.teachers (id, organization_id);
create unique index teachers_id_etablissement_unique
  on public.teachers (id, establishment_id);

create trigger teachers_touch_updated_at
  before update on public.teachers
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- learners
-- -----------------------------------------------------------------------------
-- `gender_label` est du texte libre et facultatif : les catégories officielles
-- diffèrent d'un pays et d'un système à l'autre, et aucune énumération ne les
-- couvrirait sans en exclure (CLAUDE.md, règle 2).
--
-- Pas de suppression : `is_archived` retire l'apprenant des listes sans effacer
-- son dossier, ses inscriptions ni, plus tard, ses notes et paiements
-- (CLAUDE.md, règle 5).

create table public.learners (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  given_name      text not null,
  family_name     text not null,
  birth_date      date,
  birth_place     text,
  gender_label    text,
  nationality     text,
  national_id     text,
  email           text,
  phone           text,
  address         text,
  photo_path      text,
  notes           text,
  -- Identifiant lisible attribué par l'établissement (matricule).
  learner_code    text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint learners_nom_non_vide check (length(trim(given_name || family_name)) > 0),
  constraint learners_naissance_passee check (birth_date is null or birth_date <= current_date),
  constraint learners_email_format check (
    email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

create unique index learners_org_code_unique
  on public.learners (organization_id, upper(learner_code)) where learner_code is not null;
create index learners_org_nom_idx
  on public.learners (organization_id, family_name, given_name);
create index learners_org_actifs_idx
  on public.learners (organization_id) where not is_archived;

create unique index learners_id_org_unique
  on public.learners (id, organization_id);

create trigger learners_touch_updated_at
  before update on public.learners
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- enrollments — le lien apprenant × établissement × année
-- -----------------------------------------------------------------------------
-- Les clés composites imposent que l'apprenant, l'établissement, l'année et le
-- niveau relèvent tous du même tenant ET du même établissement. Une inscription
-- incohérente est donc impossible à écrire, quelle que soit la voie d'accès.

create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  learner_id       uuid not null,
  academic_year_id uuid not null,
  level_id         uuid,
  status           public.enrollment_status not null default 'PREREGISTERED',
  enrolled_on      date not null default current_date,
  ended_on         date,
  status_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint enrollments_fin_apres_debut check (ended_on is null or ended_on >= enrolled_on),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (learner_id, organization_id)
    references public.learners (id, organization_id) on delete cascade,
  -- L'année ET le niveau doivent relever de l'établissement de l'inscription.
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  foreign key (level_id, establishment_id)
    references public.levels (id, establishment_id) on delete set null (level_id)
);

create unique index enrollments_apprenant_annee_etablissement_unique
  on public.enrollments (learner_id, academic_year_id, establishment_id);

-- Un apprenant n'a qu'une inscription vivante par année. Les statuts terminaux
-- (transféré, diplômé, abandon, archivé) en sont exclus : c'est précisément ce
-- qui permet de transférer un élève vers un autre établissement en cours
-- d'année sans effacer la trace de son inscription précédente.
create unique index enrollments_une_seule_en_cours
  on public.enrollments (learner_id, academic_year_id)
  where status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED');

create index enrollments_annee_statut_idx
  on public.enrollments (academic_year_id, status);
create index enrollments_etablissement_idx
  on public.enrollments (establishment_id, academic_year_id);
create index enrollments_apprenant_idx
  on public.enrollments (learner_id);

create unique index enrollments_id_org_unique
  on public.enrollments (id, organization_id);

create trigger enrollments_touch_updated_at
  before update on public.enrollments
  for each row execute function ecoleplus.touch_updated_at();
