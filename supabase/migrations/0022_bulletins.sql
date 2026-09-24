-- =============================================================================
-- 0022 — Bulletins
-- =============================================================================
-- Trois idées.
--
-- 1. PUBLIER, C'EST FIGER UN INSTANTANÉ. Le bulletin publié n'est pas une vue
--    recalculée à chaque affichage : c'est un JSON figé. Une note corrigée en
--    mars ne doit pas réécrire le bulletin remis en décembre — republier crée
--    une NOUVELLE VERSION, sans effacer la précédente.
--
-- 2. LE RANG EST OPTIONNEL. De nombreux systèmes éducatifs le proscrivent.
--    Il est donc désactivé par défaut et relève d'un réglage d'établissement,
--    jamais d'une hypothèse du code (@CLAUDE.md, règle 2).
--
-- 3. LES RÉGLAGES DESCENDENT À L'ÉTABLISSEMENT. Manque n° 7 relevé dans
--    @docs/reprise-projet-precedent.md : jusqu'ici les réglages étaient des
--    colonnes fixes au niveau organisation. Une table clé/valeur permet à un
--    établissement de diverger sans migration.
-- =============================================================================

create type public.report_card_status as enum ('DRAFT', 'VERIFIED', 'PUBLISHED');

-- -----------------------------------------------------------------------------
-- establishment_settings — réglages clé/valeur
-- -----------------------------------------------------------------------------

create table public.establishment_settings (
  organization_id  uuid not null,
  establishment_id uuid not null,
  key              text not null,
  value            jsonb not null,
  updated_at       timestamptz not null default now(),
  primary key (establishment_id, key),
  constraint establishment_settings_key_format check (key ~ '^[a-z][a-z0-9_.]{1,63}$'),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create trigger establishment_settings_touch_updated_at
  before update on public.establishment_settings
  for each row execute function ecoleplus.touch_updated_at();

comment on table public.establishment_settings is
  'Réglages surchargeables par établissement. Absent = le défaut du code s''applique.';

create or replace function ecoleplus.reglage_etablissement(
  p_establishment_id uuid, p_key text, p_defaut jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select value from public.establishment_settings
      where establishment_id = p_establishment_id and key = p_key),
    p_defaut);
$$;

grant execute on function ecoleplus.reglage_etablissement(uuid, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- report_cards
-- -----------------------------------------------------------------------------

create table public.report_cards (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  establishment_id  uuid not null,
  enrollment_id     uuid not null,
  academic_year_id  uuid not null,
  academic_term_id  uuid,
  class_id          uuid not null,
  status            public.report_card_status not null default 'DRAFT',
  -- L'instantané. Tout ce que le bulletin affiche s'y trouve : ni jointure ni
  -- recalcul à la lecture.
  snapshot          jsonb not null,
  general_ratio     numeric(12,8),
  general_value     numeric(10,4),
  grading_system_id uuid,
  -- Null quand le rang est désactivé — et c'est le cas par défaut.
  rank              integer,
  rank_of           integer,
  appreciation      text,
  generated_by      uuid references public.profiles (id) on delete set null,
  generated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint report_cards_rang check (
    (rank is null and rank_of is null)
    or (rank >= 1 and rank_of >= rank)
  ),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  foreign key (academic_term_id, organization_id)
    references public.academic_terms (id, organization_id) on delete set null (academic_term_id),
  foreign key (class_id, academic_year_id)
    references public.classes (id, academic_year_id) on delete cascade,
  foreign key (grading_system_id, organization_id)
    references public.grading_systems (id, organization_id) on delete set null (grading_system_id)
);

-- Un bulletin par inscription et par période. Le `coalesce` neutralise le nul
-- du bulletin annuel, que l'unicité ignorerait sinon.
create unique index report_cards_unique
  on public.report_cards (
    enrollment_id,
    coalesce(academic_term_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index report_cards_classe_idx on public.report_cards (class_id, academic_term_id);
create index report_cards_etablissement_idx
  on public.report_cards (establishment_id, academic_year_id);

create unique index report_cards_id_org_unique on public.report_cards (id, organization_id);

create trigger report_cards_touch_updated_at
  before update on public.report_cards
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- report_card_publications — les versions remises
-- -----------------------------------------------------------------------------
-- Republier n'écrase pas : la version précédente reste exactement telle qu'elle
-- a été remise. Écriture seule.

create table public.report_card_publications (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  report_card_id  uuid not null,
  version         integer not null,
  snapshot        jsonb not null,
  reason          text,
  published_by    uuid references public.profiles (id) on delete set null,
  published_at    timestamptz not null default now(),
  constraint report_card_publications_version check (version >= 1),
  foreign key (report_card_id, organization_id)
    references public.report_cards (id, organization_id) on delete cascade
);

create unique index report_card_publications_unique
  on public.report_card_publications (report_card_id, version);

comment on table public.report_card_publications is
  'Écriture seule. Chaque publication est une version conservée telle qu''elle a été remise.';

create trigger report_card_publications_immuable
  before update or delete on public.report_card_publications
  for each row execute function ecoleplus.interdire_mutation();

-- =============================================================================
-- Construction de l'instantané
-- =============================================================================

create or replace function ecoleplus.construire_bulletin(
  p_enrollment_id uuid,
  p_term_id       uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
  v_bulletin    jsonb;
  v_general     record;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: inscription inconnue'
      using errcode = 'no_data_found';
  end if;

  select * into v_general from public.moyenne_generale(p_enrollment_id, p_term_id);

  select jsonb_build_object(
    'version_instantane', 1,
    'genere_le', now(),
    'apprenant', jsonb_build_object(
      'id', l.id, 'given_name', l.given_name, 'family_name', l.family_name,
      'learner_code', l.learner_code, 'birth_date', l.birth_date),
    'inscription', jsonb_build_object(
      'id', e.id, 'status', e.status, 'enrolled_on', e.enrolled_on),
    'classe', jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code),
    'niveau', case when lv.id is not null
                   then jsonb_build_object('id', lv.id, 'name', lv.name) end,
    'annee', jsonb_build_object('id', ay.id, 'name', ay.name),
    'periode', case when at2.id is not null
                    then jsonb_build_object('id', at2.id, 'name', at2.name,
                                            'position', at2.position, 'weight', at2.weight) end,
    'etablissement', jsonb_build_object('id', es.id, 'name', es.name, 'code', es.code),
    -- Langue, format de date et devise suivent les réglages de
    -- l'établissement AU MOMENT de la publication : un bulletin remis ne
    -- change pas d'apparence si l'organisation change de convention ensuite.
    'reglages', jsonb_build_object(
      'locale', os.default_locale, 'timezone', os.timezone,
      'date_format', os.date_format, 'currency', os.currency,
      'name_display_format', os.name_display_format),
    'moyenne_generale', jsonb_build_object(
      'ratio', v_general.ratio, 'valeur', v_general.valeur,
      'mention', v_general.mention, 'matieres', v_general.matieres,
      'bareme_id', v_general.bareme_id)
  )
  into v_bulletin
    from public.enrollments e
    join public.learners l on l.id = e.learner_id
    join public.classes c on c.id = e.class_id
    join public.academic_years ay on ay.id = e.academic_year_id
    join public.establishments es on es.id = e.establishment_id
    join public.organization_settings os on os.organization_id = e.organization_id
    left join public.levels lv on lv.id = e.level_id
    left join public.academic_terms at2 on at2.id = p_term_id
   where e.id = p_enrollment_id;

  -- Les matières, dans l'ordre, avec leurs compteurs. Deux moyennes de 14 ne
  -- disent pas la même chose selon qu'elles portent sur deux notes ou douze :
  -- les compteurs partent donc dans l'instantané, pas seulement la moyenne.
  return v_bulletin || jsonb_build_object(
    'matieres', coalesce((
      select jsonb_agg(jsonb_build_object(
               'subject_id', m.subject_id,
               'nom', m.subject_name,
               'coefficient', m.coefficient,
               'notes_prises', m.notes_prises,
               'notes_ignorees', m.notes_ignorees,
               'ratio', m.ratio,
               'valeur', m.valeur,
               'mention', m.mention,
               'bareme_id', m.bareme_id)
               order by m.subject_name)
        from public.moyennes_matiere(p_enrollment_id, p_term_id) m
    ), '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Rang — calculé seulement s'il est activé
-- -----------------------------------------------------------------------------
-- `rank()` et non `row_number()` : deux moyennes égales partagent le même rang.
-- Départager arbitrairement deux apprenants à égalité serait une invention.

create or replace function ecoleplus.rang_dans_classe(
  p_enrollment_id uuid, p_term_id uuid
)
returns table (rang integer, sur integer)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_classe uuid;
begin
  select class_id into v_classe from public.enrollments where id = p_enrollment_id;

  return query
  with moyennes as (
    select e.id as enrollment_id, g.ratio
      from public.enrollments e
      cross join lateral public.moyenne_generale(e.id, p_term_id) g
     where e.class_id = v_classe
       and e.status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED')
       and g.ratio is not null
  ),
  classement as (
    select m.enrollment_id,
           rank() over (order by m.ratio desc)::integer as r,
           count(*) over ()::integer as n
      from moyennes m
  )
  select c.r, c.n from classement c where c.enrollment_id = p_enrollment_id;
end;
$$;

grant execute on function ecoleplus.construire_bulletin(uuid, uuid) to authenticated;
grant execute on function ecoleplus.rang_dans_classe(uuid, uuid) to authenticated;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.establishment_settings     enable row level security;
alter table public.report_cards               enable row level security;
alter table public.report_card_publications   enable row level security;

revoke all on
  public.establishment_settings, public.report_cards, public.report_card_publications
from anon, authenticated;

grant select, insert, update, delete on public.establishment_settings to authenticated;
-- Les bulletins ne s'écrivent que par fonction.
grant select on public.report_cards             to authenticated;
grant select on public.report_card_publications to authenticated;

create policy establishment_settings_select on public.establishment_settings
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'establishments.read', establishment_id));

create policy establishment_settings_ecriture on public.establishment_settings
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'establishments.update', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'establishments.update', establishment_id));

create policy report_cards_select on public.report_cards
  for select to authenticated
  using (
    ecoleplus.can_read(organization_id, 'reports.read', establishment_id)
    and ecoleplus.classe_enseignee(class_id)
  );

create policy report_card_publications_select on public.report_card_publications
  for select to authenticated
  using (exists (
    select 1 from public.report_cards rc
     where rc.id = report_card_publications.report_card_id
       and ecoleplus.can_read(rc.organization_id, 'reports.read', rc.establishment_id)
       and ecoleplus.classe_enseignee(rc.class_id)));

-- =============================================================================
-- Opérations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Prévisualiser — sans rien écrire
-- -----------------------------------------------------------------------------
-- La détection des erreurs de barème se fait ICI, pas au moment du bulletin :
-- une échelle incohérente découverte sur un document déjà remis aux familles
-- est irrattrapable.

create or replace function public.previsualiser_bulletin(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
  v_bulletin    jsonb;
  v_anomalies   jsonb;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or not ecoleplus.can_read(v_inscription.organization_id, 'reports.preview',
                               v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: prévisualiser un bulletin exige la permission reports.preview'
      using errcode = 'insufficient_privilege';
  end if;

  v_bulletin := ecoleplus.construire_bulletin(p_enrollment_id, p_term_id);

  -- Tous les barèmes qui entrent dans ce bulletin sont contrôlés.
  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'bareme', gs.name, 'gravite', v.gravite,
           'code', v.code, 'message', v.message)), '[]'::jsonb)
    into v_anomalies
    from public.assessments a
    join public.grading_systems gs on gs.id = a.grading_system_id
    cross join lateral public.verifier_bareme(gs.id) v
   where a.class_id = v_inscription.class_id
     and a.status <> 'CANCELLED'
     and (p_term_id is null or a.academic_term_id = p_term_id);

  return v_bulletin || jsonb_build_object('anomalies', v_anomalies);
end;
$$;

-- -----------------------------------------------------------------------------
-- Vérifier — pose l'instantané en brouillon
-- -----------------------------------------------------------------------------

create or replace function public.verifier_bulletin(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
  v_bulletin    jsonb;
  v_general     record;
  -- Deux scalaires, et non un record : plpgsql évalue une expression CASE en
  -- entier, si bien qu'un record non assigné y serait lu même sous une
  -- condition fausse.
  v_rang_valeur integer;
  v_rang_sur    integer;
  v_rang_actif  boolean;
  v_bareme      uuid;
  v_id          uuid;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or not ecoleplus.can_write(v_inscription.organization_id, 'reports.verify',
                                v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: vérifier un bulletin exige la permission reports.verify'
      using errcode = 'insufficient_privilege';
  end if;

  v_bulletin := ecoleplus.construire_bulletin(p_enrollment_id, p_term_id);
  select * into v_general from public.moyenne_generale(p_enrollment_id, p_term_id);

  select cl.grading_system_id into v_bareme
    from public.classes cl where cl.id = v_inscription.class_id;

  -- Le rang n'existe que si l'établissement l'a demandé. Défaut : non.
  v_rang_actif := (ecoleplus.reglage_etablissement(
    v_inscription.establishment_id, 'report_card.rank_enabled', 'false'::jsonb))::boolean;

  if v_rang_actif then
    select r.rang, r.sur into v_rang_valeur, v_rang_sur
      from ecoleplus.rang_dans_classe(p_enrollment_id, p_term_id) r;
    v_bulletin := v_bulletin || jsonb_build_object(
      'rang', jsonb_build_object('rang', v_rang_valeur, 'sur', v_rang_sur));
  end if;

  insert into public.report_cards
    (organization_id, establishment_id, enrollment_id, academic_year_id,
     academic_term_id, class_id, status, snapshot, general_ratio, general_value,
     grading_system_id, rank, rank_of, generated_by, generated_at)
  values
    (v_inscription.organization_id, v_inscription.establishment_id, p_enrollment_id,
     v_inscription.academic_year_id, p_term_id, v_inscription.class_id,
     'VERIFIED', v_bulletin, v_general.ratio, v_general.valeur, v_bareme,
     v_rang_valeur, v_rang_sur,
     ecoleplus.current_profile_id(), now())
  on conflict (enrollment_id,
               coalesce(academic_term_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set
    status            = 'VERIFIED',
    snapshot          = excluded.snapshot,
    general_ratio     = excluded.general_ratio,
    general_value     = excluded.general_value,
    grading_system_id = excluded.grading_system_id,
    rank              = excluded.rank,
    rank_of           = excluded.rank_of,
    generated_by      = excluded.generated_by,
    generated_at      = excluded.generated_at
  returning id into v_id;

  perform ecoleplus.write_audit_log(
    'report_card.verified', 'report_card', v_id::text,
    v_inscription.organization_id, v_inscription.establishment_id,
    null, jsonb_build_object('moyenne', v_general.valeur, 'rang_actif', v_rang_actif), null);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Publier — crée une VERSION, n'écrase jamais la précédente
-- -----------------------------------------------------------------------------

create or replace function public.publier_bulletin(
  p_report_card_id uuid,
  p_raison         text default null
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_bulletin public.report_cards;
  v_version  integer;
begin
  select * into v_bulletin from public.report_cards where id = p_report_card_id;

  if v_bulletin.id is null
     or v_bulletin.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_BULLETIN_INTROUVABLE: ce bulletin n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_bulletin.organization_id, 'reports.publish',
                             v_bulletin.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: publier un bulletin exige la permission reports.publish'
      using errcode = 'insufficient_privilege';
  end if;

  if v_bulletin.status = 'DRAFT' then
    raise exception 'ECOLEPLUS_NON_VERIFIE: un bulletin se vérifie avant de se publier'
      using errcode = 'check_violation';
  end if;

  -- Republier exige un motif : la famille a déjà reçu la version précédente.
  if exists (select 1 from public.report_card_publications
              where report_card_id = p_report_card_id)
     and length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: republier un bulletin déjà remis exige un motif'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.report_card_publications where report_card_id = p_report_card_id;

  insert into public.report_card_publications
    (organization_id, report_card_id, version, snapshot, reason, published_by)
  values
    (v_bulletin.organization_id, p_report_card_id, v_version, v_bulletin.snapshot,
     nullif(trim(coalesce(p_raison, '')), ''), ecoleplus.current_profile_id());

  update public.report_cards set status = 'PUBLISHED' where id = p_report_card_id;

  perform ecoleplus.write_audit_log(
    'report_card.published', 'report_card', p_report_card_id::text,
    v_bulletin.organization_id, v_bulletin.establishment_id,
    null, jsonb_build_object('version', v_version), p_raison);

  return v_version;
end;
$$;

revoke all on function
  public.previsualiser_bulletin(uuid, uuid),
  public.verifier_bulletin(uuid, uuid),
  public.publier_bulletin(uuid, text)
from public, anon;

grant execute on function
  public.previsualiser_bulletin(uuid, uuid),
  public.verifier_bulletin(uuid, uuid),
  public.publier_bulletin(uuid, text)
to authenticated;
