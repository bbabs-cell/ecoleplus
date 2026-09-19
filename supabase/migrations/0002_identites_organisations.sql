-- =============================================================================
-- 0002 — Identités, organisations, établissements
-- =============================================================================

create type public.organization_status as enum ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.establishment_status as enum ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- Ordre d'affichage d'un nom de personne. Aucun ordre n'est universel : il se
-- règle par organisation (cf. CLAUDE.md, règle 2).
create type public.name_display_format as enum ('GIVEN_FAMILY', 'FAMILY_GIVEN', 'FAMILY_UPPER_GIVEN');

-- -----------------------------------------------------------------------------
-- profiles — miroir applicatif de auth.users
-- -----------------------------------------------------------------------------
-- `auth.users` n'est pas interrogeable en jointure depuis PostgREST : on tient
-- un miroir dans `public`. Le prénom et le nom sont stockés séparément car leur
-- ordre d'affichage dépend de l'organisation, pas du code.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  given_name  text        not null default '',
  family_name text        not null default '',
  phone       text,
  avatar_path text,
  locale      text        not null default 'fr',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_locale_format check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

comment on table public.profiles is
  'Identité applicative. Un profil n''appartient à aucune organisation : c''est organization_memberships qui le rattache.';

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function ecoleplus.touch_updated_at();

-- Crée le profil dès l'inscription. SECURITY DEFINER car `auth.users` est écrit
-- par GoTrue, qui n'a aucun droit sur `public`.
create or replace function ecoleplus.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, given_name, family_name, phone, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'given_name', ''),
    coalesce(new.raw_user_meta_data ->> 'family_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function ecoleplus.handle_new_user();

-- -----------------------------------------------------------------------------
-- organizations — le tenant
-- -----------------------------------------------------------------------------

create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  slug         text        not null unique,
  status       public.organization_status not null default 'TRIAL',
  country_code text        not null,
  city         text,
  address      text,
  phone        text,
  email        text,
  logo_path    text,
  -- Organisation interne EcolePlus : porte les rôles de portée PLATFORM.
  is_platform  boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint organizations_name_non_vide check (length(trim(name)) > 0),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint organizations_country_code_iso check (country_code ~ '^[A-Z]{2}$')
);

create index organizations_status_idx on public.organizations (status);
-- Une seule organisation plateforme, garantie par l'index et non par le code.
create unique index organizations_platform_unique
  on public.organizations ((true)) where is_platform;

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- organization_settings — tout ce qui varie d'un pays/système à l'autre
-- -----------------------------------------------------------------------------
-- Règle 2 de CLAUDE.md : aucune de ces valeurs n'est codée en dur ailleurs.
-- Les réglages académiques (notation, calendrier, niveaux) arriveront avec les
-- phases 2 et 3 : ils ne sont volontairement pas anticipés ici.

create table public.organization_settings (
  organization_id     uuid primary key references public.organizations (id) on delete cascade,
  default_locale      text        not null default 'fr',
  supported_locales   text[]      not null default array['fr'],
  timezone            text        not null default 'UTC',
  currency            text        not null default 'EUR',
  name_display_format public.name_display_format not null default 'GIVEN_FAMILY',
  date_format         text        not null default 'DD/MM/YYYY',
  -- 1 = lundi … 7 = dimanche (ISO-8601). Le week-end varie selon les pays.
  week_starts_on      smallint    not null default 1,
  updated_at          timestamptz not null default now(),
  constraint organization_settings_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint organization_settings_locale_format check (default_locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint organization_settings_week_start check (week_starts_on between 1 and 7),
  constraint organization_settings_locale_supportee check (default_locale = any (supported_locales))
);

create trigger organization_settings_valider_fuseau
  before insert or update of timezone on public.organization_settings
  for each row execute function ecoleplus.valider_fuseau('timezone');

create trigger organization_settings_touch_updated_at
  before update on public.organization_settings
  for each row execute function ecoleplus.touch_updated_at();

-- Toute organisation a ses réglages dès sa création : aucun code applicatif
-- n'a donc à gérer le cas « settings absents ».
create or replace function ecoleplus.creer_reglages_organisation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.organization_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger organizations_creer_reglages
  after insert on public.organizations
  for each row execute function ecoleplus.creer_reglages_organisation();

-- -----------------------------------------------------------------------------
-- establishments — école / faculté / centre au sein d'une organisation
-- -----------------------------------------------------------------------------
-- `kind_label` est du texte libre, pas une énumération : « maternelle »,
-- « lycée », « faculté », « centre de formation » n'ont ni le même nom ni le
-- même découpage d'un système éducatif à l'autre (CLAUDE.md, règle 2).

create table public.establishments (
  organization_id uuid        not null references public.organizations (id) on delete cascade,
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  code            text        not null,
  kind_label      text,
  status          public.establishment_status not null default 'ACTIVE',
  -- Null = hérite du réglage de l'organisation.
  timezone        text,
  locale          text,
  address         text,
  city            text,
  phone           text,
  email           text,
  logo_path       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint establishments_name_non_vide check (length(trim(name)) > 0),
  constraint establishments_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint establishments_locale_format check (locale is null or locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

-- Le code identifie l'établissement dans l'organisation, pas au-delà.
create unique index establishments_org_code_unique
  on public.establishments (organization_id, upper(code));
create index establishments_org_status_idx
  on public.establishments (organization_id, status);

-- Cible des clés étrangères composites des tables métier : garantit qu'un
-- enfant ne peut pas référencer un établissement d'une autre organisation.
create unique index establishments_id_org_unique
  on public.establishments (id, organization_id);

create trigger establishments_valider_fuseau
  before insert or update of timezone on public.establishments
  for each row execute function ecoleplus.valider_fuseau('timezone');

create trigger establishments_touch_updated_at
  before update on public.establishments
  for each row execute function ecoleplus.touch_updated_at();
