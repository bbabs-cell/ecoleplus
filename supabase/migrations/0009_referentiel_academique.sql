-- =============================================================================
-- 0009 — Référentiel académique : années, périodes, niveaux, matières
-- =============================================================================
-- Cloisonnement par CLÉS ÉTRANGÈRES COMPOSITES.
--
-- Chaque table porte `organization_id` en plus de son parent, et référence ce
-- parent sur le couple (id, organization_id). PostgreSQL refuse alors
-- physiquement qu'une ligne pointe vers un parent d'un autre tenant : la
-- garantie ne dépend plus d'un trigger qu'on pourrait oublier, ni d'une policy
-- qu'on pourrait mal écrire. La colonne redondante est le prix de cette
-- garantie, et il est faible.
--
-- Rien n'est codé en dur par pays (CLAUDE.md, règle 2) : le libellé de l'année,
-- le découpage en périodes et le nom des niveaux sont du texte libre. Un
-- trimestre français, un semestre universitaire et un quarter américain
-- occupent la même table sans distinction de schéma.
-- =============================================================================

create type public.academic_year_status as enum ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- -----------------------------------------------------------------------------
-- academic_years
-- -----------------------------------------------------------------------------

create table public.academic_years (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  -- Libellé libre : « 2026-2027 », « 1447 », « Année 3 »…
  name             text not null,
  starts_on        date not null,
  ends_on          date not null,
  status           public.academic_year_status not null default 'PLANNED',
  -- Année de travail par défaut de l'établissement.
  is_current       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint academic_years_name_non_vide check (length(trim(name)) > 0),
  constraint academic_years_periode check (ends_on > starts_on),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create unique index academic_years_etablissement_nom_unique
  on public.academic_years (establishment_id, lower(name));
create index academic_years_etablissement_idx
  on public.academic_years (establishment_id, starts_on desc);

-- Une seule année courante par établissement, garantie par l'index.
create unique index academic_years_une_seule_courante
  on public.academic_years (establishment_id) where is_current;

-- Cible des clés étrangères composites des enfants.
create unique index academic_years_id_org_unique
  on public.academic_years (id, organization_id);
create unique index academic_years_id_etablissement_unique
  on public.academic_years (id, establishment_id);

create trigger academic_years_touch_updated_at
  before update on public.academic_years
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- academic_terms — découpage de l'année
-- -----------------------------------------------------------------------------
-- `kind_label` est du texte libre : trimestre, semestre, quarter, période,
-- module… Aucune énumération ne couvrirait tous les systèmes éducatifs.

create table public.academic_terms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  academic_year_id uuid not null,
  name             text not null,
  kind_label       text,
  -- Ordre dans l'année : 1, 2, 3…
  position         smallint not null,
  starts_on        date not null,
  ends_on          date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint academic_terms_name_non_vide check (length(trim(name)) > 0),
  constraint academic_terms_periode check (ends_on > starts_on),
  constraint academic_terms_position check (position between 1 and 24),
  foreign key (academic_year_id, organization_id)
    references public.academic_years (id, organization_id) on delete cascade
);

create unique index academic_terms_annee_position_unique
  on public.academic_terms (academic_year_id, position);
create index academic_terms_annee_idx
  on public.academic_terms (academic_year_id, starts_on);

create unique index academic_terms_id_org_unique
  on public.academic_terms (id, organization_id);

create trigger academic_terms_touch_updated_at
  before update on public.academic_terms
  for each row execute function ecoleplus.touch_updated_at();

-- Une période doit tenir dans son année : sinon les calculs de moyennes et de
-- présences de la phase 3 porteraient sur des jours hors année.
create or replace function ecoleplus.verifier_periode_dans_annee()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_debut date;
  v_fin   date;
begin
  select starts_on, ends_on into v_debut, v_fin
    from public.academic_years where id = new.academic_year_id;

  if new.starts_on < v_debut or new.ends_on > v_fin then
    raise exception 'ECOLEPLUS_PERIODE_HORS_ANNEE: la période doit être comprise entre le % et le %', v_debut, v_fin
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger academic_terms_verifier_periode
  before insert or update of starts_on, ends_on, academic_year_id
  on public.academic_terms
  for each row execute function ecoleplus.verifier_periode_dans_annee();

-- -----------------------------------------------------------------------------
-- levels — niveaux d'études
-- -----------------------------------------------------------------------------
-- « CP », « 6ème », « Year 4 », « Licence 1 », « Module A »… Le nom, le code et
-- le regroupement (`stage_label` : cycle, primaire, collège, licence) sont
-- libres. `position` fixe l'ordre de progression, qui seul a un sens universel.

create table public.levels (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  name             text not null,
  code             text not null,
  stage_label      text,
  position         smallint not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint levels_name_non_vide check (length(trim(name)) > 0),
  constraint levels_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint levels_position check (position between 0 and 999),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create unique index levels_etablissement_code_unique
  on public.levels (establishment_id, upper(code));
create index levels_etablissement_ordre_idx
  on public.levels (establishment_id, position);

create unique index levels_id_org_unique
  on public.levels (id, organization_id);
create unique index levels_id_etablissement_unique
  on public.levels (id, establishment_id);

create trigger levels_touch_updated_at
  before update on public.levels
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- subjects — matières
-- -----------------------------------------------------------------------------
-- Les coefficients et barèmes ne sont PAS ici : ils dépendent du système de
-- notation, qui arrive en phase 3. Les poser maintenant reviendrait à figer une
-- règle de calcul avant d'avoir le module qui l'applique.

create table public.subjects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  name             text not null,
  code             text not null,
  description      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint subjects_name_non_vide check (length(trim(name)) > 0),
  constraint subjects_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create unique index subjects_etablissement_code_unique
  on public.subjects (establishment_id, upper(code));
create index subjects_etablissement_nom_idx
  on public.subjects (establishment_id, name);

create unique index subjects_id_org_unique
  on public.subjects (id, organization_id);
create unique index subjects_id_etablissement_unique
  on public.subjects (id, establishment_id);

create trigger subjects_touch_updated_at
  before update on public.subjects
  for each row execute function ecoleplus.touch_updated_at();
