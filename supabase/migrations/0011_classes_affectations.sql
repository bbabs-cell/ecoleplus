-- =============================================================================
-- 0011 — Classes, groupes et affectations
-- =============================================================================
-- Le modèle indicatif de docs/architecture.md prévoyait une table
-- `class_members`. Elle n'existe pas ici : l'appartenance à une classe est une
-- COLONNE de l'inscription.
--
-- La raison est qu'une inscription désigne déjà un apprenant, un établissement
-- et une année ; y accrocher la classe garantit sans effort qu'on ne peut pas
-- placer un élève dans la classe d'une autre année, et qu'il n'appartient qu'à
-- une classe principale. Une table séparée aurait exigé des contrôles pour
-- rétablir ces deux invariants.
--
-- Les GROUPES, eux, gardent leur table de liaison : un élève appartient à
-- plusieurs groupes (option, langue, travaux dirigés, atelier) simultanément.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- classes
-- -----------------------------------------------------------------------------

create table public.classes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  academic_year_id uuid not null,
  level_id         uuid not null,
  name             text not null,
  code             text not null,
  -- Effectif maximal. Null = pas de plafond défini.
  capacity         smallint,
  -- Professeur principal / titulaire.
  main_teacher_id  uuid,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint classes_name_non_vide check (length(trim(name)) > 0),
  constraint classes_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint classes_capacite check (capacity is null or capacity between 1 and 2000),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  foreign key (level_id, establishment_id)
    references public.levels (id, establishment_id) on delete restrict,
  foreign key (main_teacher_id, establishment_id)
    references public.teachers (id, establishment_id) on delete set null (main_teacher_id)
);

create unique index classes_annee_code_unique
  on public.classes (academic_year_id, upper(code));
create index classes_annee_niveau_idx
  on public.classes (academic_year_id, level_id);
create index classes_etablissement_idx
  on public.classes (establishment_id, is_active);

create unique index classes_id_org_unique      on public.classes (id, organization_id);
create unique index classes_id_annee_unique    on public.classes (id, academic_year_id);
create unique index classes_id_etab_unique     on public.classes (id, establishment_id);

create trigger classes_touch_updated_at
  before update on public.classes
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- groups — regroupements transversaux
-- -----------------------------------------------------------------------------
-- `kind_label` libre : option, langue vivante, TD, atelier, spécialité…

create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  academic_year_id uuid not null,
  name             text not null,
  code             text not null,
  kind_label       text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint groups_name_non_vide check (length(trim(name)) > 0),
  constraint groups_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade
);

create unique index groups_annee_code_unique
  on public.groups (academic_year_id, upper(code));
create index groups_etablissement_idx
  on public.groups (establishment_id, is_active);

create unique index groups_id_org_unique   on public.groups (id, organization_id);
create unique index groups_id_annee_unique on public.groups (id, academic_year_id);

create trigger groups_touch_updated_at
  before update on public.groups
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Rattachement d'une inscription à une classe
-- -----------------------------------------------------------------------------
-- Ajouté ici, et non dans la migration 0010, parce que `classes` doit exister
-- avant d'être référencée. La clé composite sur (id, academic_year_id) des deux
-- côtés impose que la classe soit bien celle de l'année de l'inscription.

alter table public.enrollments
  add column class_id uuid;

create unique index enrollments_id_annee_unique
  on public.enrollments (id, academic_year_id);

alter table public.enrollments
  add constraint enrollments_classe_fkey
  foreign key (class_id, academic_year_id)
  references public.classes (id, academic_year_id) on delete set null (class_id);

create index enrollments_classe_idx on public.enrollments (class_id);

-- -----------------------------------------------------------------------------
-- group_members
-- -----------------------------------------------------------------------------

create table public.group_members (
  group_id         uuid not null,
  enrollment_id    uuid not null,
  academic_year_id uuid not null,
  organization_id  uuid not null,
  created_at       timestamptz not null default now(),
  primary key (group_id, enrollment_id),

  foreign key (group_id, academic_year_id)
    references public.groups (id, academic_year_id) on delete cascade,
  foreign key (enrollment_id, academic_year_id)
    references public.enrollments (id, academic_year_id) on delete cascade,
  foreign key (organization_id) references public.organizations (id) on delete cascade
);

create index group_members_inscription_idx on public.group_members (enrollment_id);

-- -----------------------------------------------------------------------------
-- teaching_assignments — qui enseigne quoi, à quelle classe
-- -----------------------------------------------------------------------------
-- Plusieurs enseignants peuvent se partager une matière dans une même classe :
-- l'unicité porte sur le triplet complet, pas sur (classe, matière).

create table public.teaching_assignments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  class_id         uuid not null,
  subject_id       uuid not null,
  teacher_id       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (class_id, establishment_id)
    references public.classes (id, establishment_id) on delete cascade,
  foreign key (subject_id, establishment_id)
    references public.subjects (id, establishment_id) on delete cascade,
  foreign key (teacher_id, establishment_id)
    references public.teachers (id, establishment_id) on delete cascade
);

create unique index teaching_assignments_unique
  on public.teaching_assignments (class_id, subject_id, teacher_id);
create index teaching_assignments_enseignant_idx
  on public.teaching_assignments (teacher_id);
create index teaching_assignments_matiere_idx
  on public.teaching_assignments (subject_id);

create unique index teaching_assignments_id_org_unique
  on public.teaching_assignments (id, organization_id);

create trigger teaching_assignments_touch_updated_at
  before update on public.teaching_assignments
  for each row execute function ecoleplus.touch_updated_at();
