-- =============================================================================
-- 0013 — Opérations académiques
-- =============================================================================
-- Même principe qu'en phase 1 : ce que RLS ne sait pas exprimer — plusieurs
-- écritures atomiques, une règle métier, une entrée d'audit — passe par une
-- fonction qui revérifie tout.
-- =============================================================================

-- Effectif vivant d'une classe. Les inscriptions transférées, diplômées,
-- abandonnées ou archivées ne consomment pas de place.
create or replace function ecoleplus.effectif_classe(p_class_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::integer
    from public.enrollments e
   where e.class_id = p_class_id
     and e.status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED');
$$;

-- Refuse le placement si la classe est pleine. `p_enrollment_id` permet de ne
-- pas compter l'inscription déjà présente dans cette classe.
create or replace function ecoleplus.verifier_capacite(p_class_id uuid, p_enrollment_id uuid default null)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_capacite smallint;
  v_effectif integer;
  v_nom      text;
begin
  if p_class_id is null then return; end if;

  select capacity, name into v_capacite, v_nom
    from public.classes where id = p_class_id;

  if v_capacite is null then return; end if;

  select count(*)::integer into v_effectif
    from public.enrollments e
   where e.class_id = p_class_id
     and e.status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED')
     and (p_enrollment_id is null or e.id <> p_enrollment_id);

  if v_effectif >= v_capacite then
    raise exception 'ECOLEPLUS_CLASSE_PLEINE: la classe « % » a atteint son effectif maximal (%)', v_nom, v_capacite
      using errcode = 'check_violation';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Inscrire un nouvel apprenant
-- -----------------------------------------------------------------------------
-- Crée le dossier ET l'inscription dans la même transaction. C'est ce qui
-- garantit qu'aucun apprenant orphelin n'existe : sans inscription, il serait
-- invisible aux rôles de portée établissement (cf. migration 0012).

create or replace function public.inscrire_apprenant(
  p_establishment_id uuid,
  p_academic_year_id uuid,
  p_given_name       text,
  p_family_name      text,
  p_level_id         uuid default null,
  p_class_id         uuid default null,
  p_birth_date       date default null,
  p_gender_label     text default null,
  p_learner_code     text default null,
  p_email            text default null,
  p_phone            text default null,
  p_status           public.enrollment_status default 'PREREGISTERED'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org        uuid := ecoleplus.current_org_id();
  v_apprenant  uuid;
  v_inscription uuid;
begin
  if not ecoleplus.can_write(v_org, 'learners.manage', p_establishment_id)
     or not ecoleplus.can_write(v_org, 'enrollments.manage', p_establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: inscrire un apprenant exige learners.manage et enrollments.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_given_name, '') || coalesce(p_family_name, ''))) = 0 then
    raise exception 'ECOLEPLUS_NOM_REQUIS: le nom de l''apprenant est obligatoire'
      using errcode = 'check_violation';
  end if;

  -- L'établissement visé doit relever de mon organisation. Les clés composites
  -- rattraperaient l'incohérence, mais avec un message illisible.
  if not exists (
    select 1 from public.establishments
     where id = p_establishment_id and organization_id = v_org
  ) then
    raise exception 'ECOLEPLUS_ETABLISSEMENT_INTROUVABLE: cet établissement n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  perform ecoleplus.verifier_capacite(p_class_id);

  insert into public.learners (
    organization_id, given_name, family_name, birth_date,
    gender_label, learner_code, email, phone
  ) values (
    v_org, trim(p_given_name), trim(p_family_name), p_birth_date,
    nullif(trim(coalesce(p_gender_label, '')), ''),
    nullif(trim(coalesce(p_learner_code, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  returning id into v_apprenant;

  insert into public.enrollments (
    organization_id, establishment_id, learner_id,
    academic_year_id, level_id, class_id, status
  ) values (
    v_org, p_establishment_id, v_apprenant,
    p_academic_year_id, p_level_id, p_class_id, p_status
  )
  returning id into v_inscription;

  perform ecoleplus.write_audit_log(
    'learner.enrolled', 'enrollment', v_inscription::text, v_org, p_establishment_id,
    null,
    jsonb_build_object(
      'learner_id', v_apprenant,
      'academic_year_id', p_academic_year_id,
      'status', p_status),
    null);

  return v_apprenant;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réinscrire un apprenant existant
-- -----------------------------------------------------------------------------
-- Sert aussi bien au passage à l'année suivante qu'au transfert vers un autre
-- établissement du même groupe : le dossier, lui, ne bouge pas.

create or replace function public.reinscrire_apprenant(
  p_learner_id       uuid,
  p_establishment_id uuid,
  p_academic_year_id uuid,
  p_level_id         uuid default null,
  p_class_id         uuid default null,
  p_status           public.enrollment_status default 'ENROLLED'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org         uuid := ecoleplus.current_org_id();
  v_inscription uuid;
begin
  if not ecoleplus.can_write(v_org, 'enrollments.manage', p_establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: réinscrire exige la permission enrollments.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.learners
     where id = p_learner_id and organization_id = v_org
  ) then
    raise exception 'ECOLEPLUS_APPRENANT_INTROUVABLE: cet apprenant n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  perform ecoleplus.verifier_capacite(p_class_id);

  insert into public.enrollments (
    organization_id, establishment_id, learner_id,
    academic_year_id, level_id, class_id, status
  ) values (
    v_org, p_establishment_id, p_learner_id,
    p_academic_year_id, p_level_id, p_class_id, p_status
  )
  returning id into v_inscription;

  perform ecoleplus.write_audit_log(
    'learner.reenrolled', 'enrollment', v_inscription::text, v_org, p_establishment_id,
    null,
    jsonb_build_object('learner_id', p_learner_id, 'academic_year_id', p_academic_year_id),
    null);

  return v_inscription;
end;
$$;

-- -----------------------------------------------------------------------------
-- Changer le statut d'une inscription
-- -----------------------------------------------------------------------------
-- Les statuts terminaux ferment la scolarité : la date de fin est posée
-- automatiquement si elle manque, pour qu'aucun dossier clos ne reste ouvert.

create or replace function public.changer_statut_inscription(
  p_enrollment_id uuid,
  p_statut        public.enrollment_status,
  p_raison        text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
  v_terminal    boolean;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or v_inscription.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: cette inscription n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_inscription.organization_id, 'enrollments.manage',
                             v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: changer le statut exige la permission enrollments.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if v_inscription.status = p_statut then
    return;
  end if;

  v_terminal := p_statut in ('TRANSFERRED', 'GRADUATED', 'DROPPED_OUT', 'ARCHIVED');

  update public.enrollments
     set status        = p_statut,
         status_reason = p_raison,
         ended_on      = case
                           when v_terminal then coalesce(ended_on, current_date)
                           else null
                         end
   where id = p_enrollment_id;

  perform ecoleplus.write_audit_log(
    'enrollment.status_changed', 'enrollment', p_enrollment_id::text,
    v_inscription.organization_id, v_inscription.establishment_id,
    jsonb_build_object('status', v_inscription.status),
    jsonb_build_object('status', p_statut),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Affecter une inscription à une classe
-- -----------------------------------------------------------------------------

create or replace function public.affecter_classe(
  p_enrollment_id uuid,
  p_class_id      uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or v_inscription.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: cette inscription n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_inscription.organization_id, 'enrollments.manage',
                             v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: affecter une classe exige la permission enrollments.manage'
      using errcode = 'insufficient_privilege';
  end if;

  perform ecoleplus.verifier_capacite(p_class_id, p_enrollment_id);

  -- La clé composite (class_id, academic_year_id) refuse une classe d'une autre
  -- année ou d'un autre établissement : inutile de le revérifier ici.
  update public.enrollments set class_id = p_class_id where id = p_enrollment_id;

  perform ecoleplus.write_audit_log(
    'enrollment.class_changed', 'enrollment', p_enrollment_id::text,
    v_inscription.organization_id, v_inscription.establishment_id,
    jsonb_build_object('class_id', v_inscription.class_id),
    jsonb_build_object('class_id', p_class_id),
    null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Désigner l'année courante
-- -----------------------------------------------------------------------------
-- L'index unique partiel interdit deux années courantes : la bascule doit donc
-- libérer l'ancienne avant de poser la nouvelle, dans la même transaction.

create or replace function public.definir_annee_courante(p_academic_year_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_annee public.academic_years;
begin
  select * into v_annee from public.academic_years where id = p_academic_year_id;

  if v_annee.id is null
     or v_annee.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_ANNEE_INTROUVABLE: cette année n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_annee.organization_id, 'academic.manage', v_annee.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: définir l''année courante exige la permission academic.manage'
      using errcode = 'insufficient_privilege';
  end if;

  update public.academic_years
     set is_current = false
   where establishment_id = v_annee.establishment_id and is_current;

  update public.academic_years
     set is_current = true, status = case when status = 'PLANNED' then 'ACTIVE' else status end
   where id = p_academic_year_id;

  perform ecoleplus.write_audit_log(
    'academic_year.set_current', 'academic_year', p_academic_year_id::text,
    v_annee.organization_id, v_annee.establishment_id,
    null, jsonb_build_object('name', v_annee.name), null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------

revoke all on function
  public.inscrire_apprenant(uuid, uuid, text, text, uuid, uuid, date, text, text, text, text, public.enrollment_status),
  public.reinscrire_apprenant(uuid, uuid, uuid, uuid, uuid, public.enrollment_status),
  public.changer_statut_inscription(uuid, public.enrollment_status, text),
  public.affecter_classe(uuid, uuid),
  public.definir_annee_courante(uuid)
from public, anon;

grant execute on function
  public.inscrire_apprenant(uuid, uuid, text, text, uuid, uuid, date, text, text, text, text, public.enrollment_status),
  public.reinscrire_apprenant(uuid, uuid, uuid, uuid, uuid, public.enrollment_status),
  public.changer_statut_inscription(uuid, public.enrollment_status, text),
  public.affecter_classe(uuid, uuid),
  public.definir_annee_courante(uuid)
to authenticated;
