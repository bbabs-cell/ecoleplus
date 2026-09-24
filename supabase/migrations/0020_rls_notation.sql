-- =============================================================================
-- 0020 — RLS, opérations et calculs du moteur de notation
-- =============================================================================
-- Trois principes.
--
-- 1. LA PUBLICATION FIGE. Une note publiée ne se modifie pas silencieusement :
--    permission dédiée, motif obligatoire, entrée d'historique. Aucune policy
--    d'écriture ne permet de toucher une note publiée — la seule voie est
--    `corriger_note`, qui trace.
--
-- 2. LE CALCUL EST DANS LA BASE. Les moyennes ne sont pas recalculées par le
--    frontend : la politique de note manquante, les coefficients et l'arrondi
--    vivent ici, où la RLS les protège et où un test peut les vérifier.
--
-- 3. UNE NOTE MANQUANTE N'EST PAS UN ZÉRO, et une note manquante n'est pas non
--    plus une note. Les deux compteurs `notes_prises` / `notes_ignorees`
--    accompagnent donc toute moyenne : une moyenne de 14 sur deux notes et une
--    moyenne de 14 sur douze ne disent pas la même chose.
-- =============================================================================

alter table public.grading_systems             enable row level security;
alter table public.grading_scales              enable row level security;
alter table public.grading_categories          enable row level security;
alter table public.class_subjects              enable row level security;
alter table public.assessments                 enable row level security;
alter table public.assessment_results          enable row level security;
alter table public.assessment_result_histories enable row level security;

revoke all on
  public.grading_systems, public.grading_scales, public.grading_categories,
  public.class_subjects, public.assessments, public.assessment_results,
  public.assessment_result_histories
from anon, authenticated;

grant select, insert, update, delete on public.grading_systems    to authenticated;
grant select, insert, update, delete on public.grading_scales     to authenticated;
grant select, insert, update, delete on public.grading_categories to authenticated;
grant select, insert, update, delete on public.class_subjects     to authenticated;
grant select, insert, update, delete on public.assessments        to authenticated;
-- Les notes ne s'écrivent que par fonction : pas de grant d'écriture.
grant select on public.assessment_results          to authenticated;
grant select on public.assessment_result_histories to authenticated;

-- -----------------------------------------------------------------------------
-- Portée « mes matières »
-- -----------------------------------------------------------------------------
-- La portée « mes classes » des présences ne suffit plus : dans une classe,
-- chaque enseignant note SA matière. Le professeur principal fait exception —
-- de nombreux établissements lui confient la saisie pour toute la classe.
--
-- Les rôles non enseignants ne sont pas restreints par l'affectation.

create or replace function ecoleplus.matiere_enseignee(p_class_id uuid, p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when coalesce(ecoleplus.jwt_claims() ->> 'role_code', '') <> 'TEACHER' then true
    else exists (
      select 1
        from public.teachers t
       where t.profile_id = ecoleplus.current_profile_id()
         and t.status = 'ACTIVE'
         and (
           exists (select 1 from public.classes c
                    where c.id = p_class_id and c.main_teacher_id = t.id)
           or exists (select 1 from public.teaching_assignments ta
                       where ta.class_id = p_class_id
                         and ta.subject_id = p_subject_id
                         and ta.teacher_id = t.id)
         )
    )
  end;
$$;

grant execute on function ecoleplus.matiere_enseignee(uuid, uuid) to authenticated;

create or replace function ecoleplus.evaluation_accessible(p_assessment_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.assessments a
     where a.id = p_assessment_id
       and ecoleplus.can_read(a.organization_id, p_permission, a.establishment_id)
       and ecoleplus.classe_enseignee(a.class_id)
  );
$$;

grant execute on function ecoleplus.evaluation_accessible(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies — référentiel de notation
-- -----------------------------------------------------------------------------
-- Barèmes, tranches et catégories sont du paramétrage : quiconque lit les notes
-- doit les voir, sinon l'interface ne sait ni afficher ni convertir.

create policy grading_systems_select on public.grading_systems
  for select to authenticated
  using (organization_id = (select ecoleplus.current_org_id()));

create policy grading_systems_ecriture on public.grading_systems
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id));

create policy grading_scales_select on public.grading_scales
  for select to authenticated
  using (organization_id = (select ecoleplus.current_org_id()));

create policy grading_scales_ecriture on public.grading_scales
  for all to authenticated
  using (exists (
    select 1 from public.grading_systems gs
     where gs.id = grading_scales.grading_system_id
       and ecoleplus.can_write(gs.organization_id, 'grades.configure', gs.establishment_id)))
  with check (exists (
    select 1 from public.grading_systems gs
     where gs.id = grading_scales.grading_system_id
       and ecoleplus.can_write(gs.organization_id, 'grades.configure', gs.establishment_id)));

create policy grading_categories_select on public.grading_categories
  for select to authenticated
  using (organization_id = (select ecoleplus.current_org_id()));

create policy grading_categories_ecriture on public.grading_categories
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id));

create policy class_subjects_select on public.class_subjects
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'grades.read', establishment_id));

create policy class_subjects_ecriture on public.class_subjects
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'grades.configure', establishment_id));

-- -----------------------------------------------------------------------------
-- Policies — évaluations
-- -----------------------------------------------------------------------------

create policy assessments_select on public.assessments
  for select to authenticated
  using (
    ecoleplus.can_read(organization_id, 'grades.read', establishment_id)
    and ecoleplus.classe_enseignee(class_id)
  );

create policy assessments_insert on public.assessments
  for insert to authenticated
  with check (
    ecoleplus.can_write(organization_id, 'grades.manage', establishment_id)
    and ecoleplus.matiere_enseignee(class_id, subject_id)
  );

-- Le cadre de l'évaluation se modifie tant qu'elle n'est pas publiée. Changer
-- le coefficient ou le barème d'une évaluation publiée déplacerait des
-- moyennes déjà remises aux familles.
create policy assessments_update on public.assessments
  for update to authenticated
  using (
    status <> 'PUBLISHED'
    and ecoleplus.can_write(organization_id, 'grades.manage', establishment_id)
    and ecoleplus.matiere_enseignee(class_id, subject_id)
  )
  with check (
    status <> 'PUBLISHED'
    and ecoleplus.can_write(organization_id, 'grades.manage', establishment_id)
  );

-- Supprimer une évaluation détruirait les notes qui s'y rattachent
-- (@CLAUDE.md, règle 5). On l'annule : `status = 'CANCELLED'`.
-- Aucune policy DELETE n'est donc posée.

create policy assessment_results_select on public.assessment_results
  for select to authenticated
  using (ecoleplus.evaluation_accessible(assessment_id, 'grades.read'));

create policy assessment_result_histories_select on public.assessment_result_histories
  for select to authenticated
  using (exists (
    select 1 from public.assessment_results r
     where r.id = assessment_result_histories.result_id
       and ecoleplus.evaluation_accessible(r.assessment_id, 'grades.read')));

-- =============================================================================
-- Outils de calcul
-- =============================================================================

-- Arrondi configurable, appliqué au dernier moment (§5 de la spécification).
create or replace function ecoleplus.arrondir(
  p_valeur numeric, p_mode public.rounding_mode, p_decimales integer
)
returns numeric
language sql
immutable
set search_path to ''
as $$
  select case p_mode
    when 'ROUND' then round(p_valeur, p_decimales)
    when 'FLOOR' then floor(p_valeur * power(10, p_decimales)) / power(10, p_decimales)
    when 'CEIL'  then ceil (p_valeur * power(10, p_decimales)) / power(10, p_decimales)
  end;
$$;

-- Ratio [0,1] ramené sur l'échelle d'un barème, arrondi selon ses réglages.
create or replace function ecoleplus.denormaliser(p_ratio numeric, p_system_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v public.grading_systems;
begin
  if p_ratio is null then return null; end if;
  select * into v from public.grading_systems where id = p_system_id;
  if v.id is null then return null; end if;

  return ecoleplus.arrondir(
    v.min_value + p_ratio * (v.max_value - v.min_value), v.rounding_mode, v.decimals);
end;
$$;

grant execute on function ecoleplus.arrondir(numeric, public.rounding_mode, integer) to authenticated;
grant execute on function ecoleplus.denormaliser(numeric, uuid) to authenticated;

-- Tranche (lettre, niveau de maîtrise) correspondant à un ratio.
create or replace function public.libelle_tranche(p_ratio numeric, p_system_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select gsc.label
    from public.grading_scales gsc
    join public.grading_systems gs on gs.id = gsc.grading_system_id
   where gsc.grading_system_id = p_system_id
     and p_ratio is not null
     and (gs.min_value + p_ratio * (gs.max_value - gs.min_value))
         between gsc.min_score and gsc.max_score
   order by gsc.position
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Vérification d'un barème — à la PRÉVISUALISATION, pas au bulletin
-- -----------------------------------------------------------------------------
-- Le chevauchement de tranches est déjà impossible (contrainte d'exclusion de
-- la migration 0019). Restent les erreurs qu'aucune contrainte ne peut voir :
-- le trou entre deux tranches, l'échelle non couverte, le seuil incohérent.

create or replace function public.verifier_bareme(p_system_id uuid)
returns table (gravite text, code text, message text)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v        public.grading_systems;
  v_pas    numeric;
  v_prec   public.grading_scales;
  v_cour   public.grading_scales;
  v_nb     integer;
begin
  select * into v from public.grading_systems where id = p_system_id;

  if v.id is null or v.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_BAREME_INTROUVABLE: ce barème n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if v.max_value <= v.min_value then
    return query select 'ERREUR', 'BORNES',
      format('Le maximum (%s) doit dépasser le minimum (%s).', v.max_value, v.min_value);
  end if;

  if v.pass_threshold is not null
     and (v.pass_threshold < v.min_value or v.pass_threshold > v.max_value) then
    return query select 'ERREUR', 'SEUIL_HORS_ECHELLE',
      format('Le seuil de réussite (%s) sort de l''échelle %s–%s.',
             v.pass_threshold, v.min_value, v.max_value);
  end if;

  select count(*) into v_nb from public.grading_scales where grading_system_id = p_system_id;

  -- Un barème par lettres ou par niveaux de maîtrise SANS tranche ne sait rien
  -- convertir : c'est une erreur, pas une préférence.
  if v_nb = 0 then
    if v.type in ('LETTER', 'MASTERY') then
      return query select 'ERREUR', 'TRANCHES_ABSENTES',
        'Un barème par lettres ou par niveaux de maîtrise exige des tranches.';
    end if;
    return;
  end if;

  -- Pas représentable du barème : deux tranches sont contiguës si l'écart qui
  -- les sépare ne dépasse pas une décimale exprimable. C'est ce qui fait de
  -- 13–15.99 puis 16–20 un enchaînement correct, et non un trou.
  v_pas := power(10, -v.decimals);

  for v_cour in
    select * from public.grading_scales
     where grading_system_id = p_system_id
     order by min_score
  loop
    if v_prec.id is null then
      if v_cour.min_score > v.min_value then
        return query select 'AVERTISSEMENT', 'ECHELLE_NON_COUVERTE',
          format('Aucune tranche ne couvre %s–%s.', v.min_value, v_cour.min_score);
      end if;
    elsif v_cour.min_score - v_prec.max_score > v_pas then
      return query select 'ERREUR', 'TROU',
        format('Trou entre la tranche « %s » (jusqu''à %s) et « %s » (à partir de %s).',
               v_prec.label, v_prec.max_score, v_cour.label, v_cour.min_score);
    end if;
    v_prec := v_cour;
  end loop;

  if v_prec.id is not null and v_prec.max_score < v.max_value then
    return query select 'AVERTISSEMENT', 'ECHELLE_NON_COUVERTE',
      format('Aucune tranche ne couvre %s–%s.', v_prec.max_score, v.max_value);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Moyennes
-- -----------------------------------------------------------------------------
-- Le traitement d'une note manquante suit `missing_grade_policy`, JAMAIS une
-- valeur par défaut du code :
--   SKIP     → la note est ignorée, la moyenne porte sur les notes présentes
--   ZERO     → comptée comme zéro, choix explicite de l'établissement
--   EXCLUDED → l'évaluation ne concerne pas cet apprenant
--
-- Une dispense (EXEMPT) et un « sans objet » (NOT_APPLICABLE) sortent du calcul
-- quelle que soit la politique : ce ne sont pas des notes manquantes, ce sont
-- des évaluations qui ne s'appliquent pas. Une note annulée sort également.

create or replace function public.moyennes_matiere(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns table (
  subject_id     uuid,
  subject_name   text,
  coefficient    numeric,
  notes_prises   integer,
  notes_ignorees integer,
  ratio          numeric,
  valeur         numeric,
  bareme_id      uuid,
  mention        text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or not ecoleplus.can_read(v_inscription.organization_id, 'grades.read',
                               v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: inscription hors de votre périmètre'
      using errcode = 'no_data_found';
  end if;

  return query
  with notes as (
    select
      a.subject_id,
      a.coefficient * coalesce(gc.weight, 1) as poids,
      case
        -- La note est là.
        when r.kind = 'SCORE' and r.status <> 'CANCELLED' then r.normalized_value
        -- Dispense, sans objet, note annulée : hors calcul, toujours.
        when r.kind in ('EXEMPT', 'NOT_APPLICABLE') then null
        when r.status = 'CANCELLED' then null
        -- Absence, absence justifiée, ligne vide, ou aucune ligne : c'est la
        -- politique de l'évaluation qui tranche, et elle seule.
        when a.missing_grade_policy = 'ZERO' then 0
        else null
      end as valeur,
      (r.kind = 'SCORE' and r.status <> 'CANCELLED') as saisie
      from public.assessments a
      join public.classes c on c.id = a.class_id
      join public.grading_systems gs on gs.id = a.grading_system_id
      left join public.grading_categories gc on gc.id = a.category_id
      left join public.assessment_results r
             on r.assessment_id = a.id and r.enrollment_id = p_enrollment_id
     where c.id = v_inscription.class_id
       and a.status <> 'CANCELLED'
       and gs.allows_averaging
       and (p_term_id is null or a.academic_term_id = p_term_id)
  ),
  agregat as (
    select n.subject_id,
           sum(n.valeur * n.poids) filter (where n.valeur is not null) as somme,
           sum(n.poids)            filter (where n.valeur is not null) as poids_total,
           count(*) filter (where n.saisie)::integer                   as prises,
           count(*) filter (where n.valeur is null)::integer           as ignorees
      from notes n
     group by n.subject_id
  )
  select
    s.id,
    s.name,
    coalesce(cs.coefficient, 1)::numeric,
    ag.prises,
    ag.ignorees,
    case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
    ecoleplus.denormaliser(
      case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
      coalesce(cs.grading_system_id, cl.grading_system_id)),
    coalesce(cs.grading_system_id, cl.grading_system_id),
    public.libelle_tranche(
      case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
      coalesce(cs.grading_system_id, cl.grading_system_id))
    from agregat ag
    join public.subjects s on s.id = ag.subject_id
    join public.classes cl on cl.id = v_inscription.class_id
    left join public.class_subjects cs
           on cs.class_id = v_inscription.class_id and cs.subject_id = ag.subject_id
   order by s.name;
end;
$$;

-- Moyenne générale : moyenne des moyennes de matière, pondérée par le
-- coefficient de chaque matière.
create or replace function public.moyenne_generale(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns table (
  ratio     numeric,
  valeur    numeric,
  matieres  integer,
  bareme_id uuid,
  mention   text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_bareme uuid;
begin
  select cl.grading_system_id into v_bareme
    from public.enrollments e
    join public.classes cl on cl.id = e.class_id
   where e.id = p_enrollment_id;

  return query
  with m as (
    select * from public.moyennes_matiere(p_enrollment_id, p_term_id)
     where moyennes_matiere.ratio is not null
  ),
  g as (
    select case when sum(m.coefficient) > 0
                then sum(m.ratio * m.coefficient) / sum(m.coefficient) end as r,
           count(*)::integer as n
      from m
  )
  select g.r,
         ecoleplus.denormaliser(g.r, v_bareme),
         g.n,
         v_bareme,
         public.libelle_tranche(g.r, v_bareme)
    from g;
end;
$$;

-- =============================================================================
-- Opérations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Saisir les notes d'une évaluation
-- -----------------------------------------------------------------------------
-- Format attendu, un objet par apprenant :
--   [{"enrollment_id": "...", "kind": "SCORE", "raw_value": 14.5,
--     "scale_id": null, "comment": "..."}, ...]
--
-- `kind` est OBLIGATOIRE et explicite. Il n'y a pas de valeur par défaut qui
-- ferait d'une case vide un zéro : une case vide se saisit 'PENDING', une
-- absence 'ABSENT', un zéro réel ('SCORE', 0).

create or replace function public.saisir_notes(
  p_assessment_id uuid,
  p_lignes        jsonb
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_eval   public.assessments;
  v_nombre integer;
begin
  select * into v_eval from public.assessments where id = p_assessment_id;

  if v_eval.id is null
     or v_eval.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_EVALUATION_INTROUVABLE: cette évaluation n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_eval.organization_id, 'grades.enter',
                             v_eval.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: saisir des notes exige la permission grades.enter'
      using errcode = 'insufficient_privilege';
  end if;

  if not ecoleplus.matiere_enseignee(v_eval.class_id, v_eval.subject_id) then
    raise exception 'ECOLEPLUS_HORS_MES_MATIERES: vous n''enseignez pas cette matière dans cette classe'
      using errcode = 'insufficient_privilege';
  end if;

  if v_eval.status = 'PUBLISHED' then
    raise exception 'ECOLEPLUS_EVALUATION_PUBLIEE: cette évaluation est publiée ; passez par une correction'
      using errcode = 'insufficient_privilege';
  end if;

  if v_eval.status = 'CANCELLED' then
    raise exception 'ECOLEPLUS_EVALUATION_ANNULEE: cette évaluation est annulée'
      using errcode = 'insufficient_privilege';
  end if;

  -- Une note déjà publiée résiste à la saisie de masse, même si l'évaluation a
  -- été rouverte : elle ne se modifie que par `corriger_note`.
  insert into public.assessment_results
    (organization_id, assessment_id, enrollment_id, kind, raw_value, scale_id,
     comment, status, entered_by, entered_at)
  select v_eval.organization_id, p_assessment_id,
         (ligne ->> 'enrollment_id')::uuid,
         coalesce((ligne ->> 'kind')::public.grade_kind, 'PENDING'),
         (ligne ->> 'raw_value')::numeric,
         (ligne ->> 'scale_id')::uuid,
         nullif(trim(coalesce(ligne ->> 'comment', '')), ''),
         case when coalesce((ligne ->> 'kind')::public.grade_kind, 'PENDING') = 'PENDING'
              then 'DRAFT'::public.grade_status
              else 'CAPTURED'::public.grade_status end,
         ecoleplus.current_profile_id(),
         now()
    from jsonb_array_elements(p_lignes) as ligne
  on conflict (assessment_id, enrollment_id) do update
    set kind       = excluded.kind,
        raw_value  = excluded.raw_value,
        scale_id   = excluded.scale_id,
        comment    = excluded.comment,
        status     = excluded.status,
        entered_by = excluded.entered_by,
        entered_at = excluded.entered_at
    where public.assessment_results.status
          not in ('PUBLISHED', 'CORRECTED', 'CANCELLED', 'ARCHIVED');

  get diagnostics v_nombre = row_count;

  if v_eval.status = 'DRAFT' then
    update public.assessments set status = 'OPEN' where id = p_assessment_id;
  end if;

  insert into public.assessment_result_histories
    (organization_id, result_id, action, new_value, changed_by)
  select r.organization_id, r.id, 'captured',
         jsonb_build_object('kind', r.kind, 'raw_value', r.raw_value),
         ecoleplus.current_profile_id()
    from public.assessment_results r
   where r.assessment_id = p_assessment_id
     and r.enrollment_id in (
       select (ligne ->> 'enrollment_id')::uuid from jsonb_array_elements(p_lignes) as ligne)
     and r.status in ('DRAFT', 'CAPTURED');

  perform ecoleplus.write_audit_log(
    'grades.captured', 'assessment', p_assessment_id::text,
    v_eval.organization_id, v_eval.establishment_id,
    null, jsonb_build_object('lignes', v_nombre), null);

  return v_nombre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vérifier puis publier
-- -----------------------------------------------------------------------------
-- Deux permissions distinctes, et cette séparation est le sens du cycle de vie :
-- celui qui saisit n'est pas forcément celui qui engage l'établissement en
-- remettant la note à la famille.

create or replace function public.verifier_evaluation(p_assessment_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_eval    public.assessments;
  v_restant integer;
  v_nombre  integer;
begin
  select * into v_eval from public.assessments where id = p_assessment_id;

  if v_eval.id is null
     or v_eval.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_EVALUATION_INTROUVABLE: cette évaluation n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_eval.organization_id, 'grades.verify',
                             v_eval.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: vérifier exige la permission grades.verify'
      using errcode = 'insufficient_privilege';
  end if;

  if v_eval.status = 'PUBLISHED' then
    raise exception 'ECOLEPLUS_EVALUATION_PUBLIEE: cette évaluation est déjà publiée'
      using errcode = 'insufficient_privilege';
  end if;

  -- Une ligne restée vide n'est ni une note ni une absence : figer cette
  -- ambiguïté serait précisément l'erreur que le module doit empêcher.
  select count(*) into v_restant
    from public.assessment_results
   where assessment_id = p_assessment_id and kind = 'PENDING';

  if v_restant > 0 then
    raise exception 'ECOLEPLUS_SAISIE_INCOMPLETE: % ligne(s) sans nature de note (ni valeur, ni absence, ni dispense)', v_restant
      using errcode = 'check_violation';
  end if;

  update public.assessment_results
     set status = 'VERIFIED', verified_by = ecoleplus.current_profile_id(), verified_at = now()
   where assessment_id = p_assessment_id and status in ('DRAFT', 'CAPTURED');

  get diagnostics v_nombre = row_count;

  update public.assessments set status = 'VERIFIED' where id = p_assessment_id;

  insert into public.assessment_result_histories
    (organization_id, result_id, action, new_value, changed_by)
  select r.organization_id, r.id, 'verified',
         jsonb_build_object('status', 'VERIFIED'), ecoleplus.current_profile_id()
    from public.assessment_results r
   where r.assessment_id = p_assessment_id and r.status = 'VERIFIED';

  perform ecoleplus.write_audit_log(
    'grades.verified', 'assessment', p_assessment_id::text,
    v_eval.organization_id, v_eval.establishment_id,
    null, jsonb_build_object('notes', v_nombre), null);

  return v_nombre;
end;
$$;

create or replace function public.publier_evaluation(p_assessment_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_eval   public.assessments;
  v_nombre integer;
  v_erreurs integer;
begin
  select * into v_eval from public.assessments where id = p_assessment_id;

  if v_eval.id is null
     or v_eval.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_EVALUATION_INTROUVABLE: cette évaluation n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_eval.organization_id, 'grades.publish',
                             v_eval.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: publier exige la permission grades.publish'
      using errcode = 'insufficient_privilege';
  end if;

  if v_eval.status <> 'VERIFIED' then
    raise exception 'ECOLEPLUS_NON_VERIFIEE: une évaluation se vérifie avant de se publier'
      using errcode = 'check_violation';
  end if;

  -- Le barème est contrôlé AVANT publication, pas au moment du bulletin : une
  -- erreur d'échelle découverte sur un bulletin remis est irrattrapable.
  select count(*) into v_erreurs
    from public.verifier_bareme(v_eval.grading_system_id) where gravite = 'ERREUR';

  if v_erreurs > 0 then
    raise exception 'ECOLEPLUS_BAREME_INVALIDE: le barème de cette évaluation porte % erreur(s) de configuration', v_erreurs
      using errcode = 'check_violation';
  end if;

  update public.assessment_results
     set status = 'PUBLISHED', published_at = now()
   where assessment_id = p_assessment_id and status = 'VERIFIED';

  get diagnostics v_nombre = row_count;

  update public.assessments
     set status = 'PUBLISHED',
         published_by = ecoleplus.current_profile_id(),
         published_at = now()
   where id = p_assessment_id;

  insert into public.assessment_result_histories
    (organization_id, result_id, action, new_value, changed_by)
  select r.organization_id, r.id, 'published',
         jsonb_build_object('status', 'PUBLISHED'), ecoleplus.current_profile_id()
    from public.assessment_results r
   where r.assessment_id = p_assessment_id and r.status = 'PUBLISHED';

  perform ecoleplus.write_audit_log(
    'grades.published', 'assessment', p_assessment_id::text,
    v_eval.organization_id, v_eval.establishment_id,
    null, jsonb_build_object('notes', v_nombre), null);

  return v_nombre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Corriger une note publiée
-- -----------------------------------------------------------------------------
-- Permission dédiée + motif obligatoire + entrée d'historique. C'est la SEULE
-- voie : aucune policy ne permet de toucher une note publiée.

create or replace function public.corriger_note(
  p_result_id uuid,
  p_kind      public.grade_kind,
  p_raw_value numeric,
  p_scale_id  uuid,
  p_raison    text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_note public.assessment_results;
  v_eval public.assessments;
begin
  select * into v_note from public.assessment_results where id = p_result_id;

  if v_note.id is null
     or v_note.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_NOTE_INTROUVABLE: cette note n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  select * into v_eval from public.assessments where id = v_note.assessment_id;

  if not ecoleplus.can_write(v_eval.organization_id, 'grades.correct',
                             v_eval.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: corriger une note exige la permission grades.correct'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: corriger une note exige un motif'
      using errcode = 'check_violation';
  end if;

  update public.assessment_results
     set kind      = p_kind,
         raw_value = case when p_kind = 'SCORE' then p_raw_value end,
         scale_id  = case when p_kind = 'SCORE' then p_scale_id end,
         status    = case when v_note.status in ('PUBLISHED', 'CORRECTED')
                          then 'CORRECTED'::public.grade_status
                          else v_note.status end,
         entered_by = ecoleplus.current_profile_id()
   where id = p_result_id;

  insert into public.assessment_result_histories
    (organization_id, result_id, action, old_value, new_value, reason, changed_by)
  values
    (v_note.organization_id, p_result_id, 'corrected',
     jsonb_build_object('kind', v_note.kind, 'raw_value', v_note.raw_value,
                        'status', v_note.status),
     jsonb_build_object('kind', p_kind, 'raw_value', p_raw_value),
     trim(p_raison), ecoleplus.current_profile_id());

  perform ecoleplus.write_audit_log(
    'grades.corrected', 'assessment_result', p_result_id::text,
    v_eval.organization_id, v_eval.establishment_id,
    jsonb_build_object('kind', v_note.kind, 'raw_value', v_note.raw_value),
    jsonb_build_object('kind', p_kind, 'raw_value', p_raw_value),
    p_raison);
end;
$$;

-- Invalider une note : elle sort des calculs sans disparaître (@CLAUDE.md,
-- règle 5). « Invalidée » est l'un des neuf états, pas une suppression.
create or replace function public.annuler_note(p_result_id uuid, p_raison text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_note public.assessment_results;
  v_eval public.assessments;
begin
  select * into v_note from public.assessment_results where id = p_result_id;

  if v_note.id is null
     or v_note.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_NOTE_INTROUVABLE: cette note n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  select * into v_eval from public.assessments where id = v_note.assessment_id;

  if not ecoleplus.can_write(v_eval.organization_id, 'grades.correct',
                             v_eval.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: invalider une note exige la permission grades.correct'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: invalider une note exige un motif'
      using errcode = 'check_violation';
  end if;

  update public.assessment_results set status = 'CANCELLED' where id = p_result_id;

  insert into public.assessment_result_histories
    (organization_id, result_id, action, old_value, new_value, reason, changed_by)
  values
    (v_note.organization_id, p_result_id, 'cancelled',
     jsonb_build_object('status', v_note.status),
     jsonb_build_object('status', 'CANCELLED'),
     trim(p_raison), ecoleplus.current_profile_id());

  perform ecoleplus.write_audit_log(
    'grades.cancelled', 'assessment_result', p_result_id::text,
    v_eval.organization_id, v_eval.establishment_id,
    jsonb_build_object('status', v_note.status), jsonb_build_object('status', 'CANCELLED'),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------

revoke all on function
  public.saisir_notes(uuid, jsonb),
  public.verifier_evaluation(uuid),
  public.publier_evaluation(uuid),
  public.corriger_note(uuid, public.grade_kind, numeric, uuid, text),
  public.annuler_note(uuid, text),
  public.verifier_bareme(uuid),
  public.moyennes_matiere(uuid, uuid),
  public.moyenne_generale(uuid, uuid),
  public.libelle_tranche(numeric, uuid)
from public, anon;

grant execute on function
  public.saisir_notes(uuid, jsonb),
  public.verifier_evaluation(uuid),
  public.publier_evaluation(uuid),
  public.corriger_note(uuid, public.grade_kind, numeric, uuid, text),
  public.annuler_note(uuid, text),
  public.verifier_bareme(uuid),
  public.moyennes_matiere(uuid, uuid),
  public.moyenne_generale(uuid, uuid),
  public.libelle_tranche(numeric, uuid)
to authenticated;
