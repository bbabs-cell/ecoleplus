-- =============================================================================
-- 0016 — RLS, permissions et opérations des présences
-- =============================================================================
-- Nouveauté par rapport aux phases précédentes : une portée SUPPLÉMENTAIRE.
--
-- Jusqu'ici, appartenir à un établissement suffisait à voir ses données. Pour
-- l'appel, ce n'est plus vrai : un enseignant ne fait l'appel que dans SES
-- classes. La portée établissement reste nécessaire, elle n'est plus suffisante.
-- =============================================================================

alter table public.attendance_statuses    enable row level security;
alter table public.attendance_sessions    enable row level security;
alter table public.attendance_records     enable row level security;
alter table public.attendance_corrections enable row level security;

revoke all on
  public.attendance_statuses, public.attendance_sessions,
  public.attendance_records, public.attendance_corrections
from anon, authenticated;

grant select, insert, update, delete on public.attendance_statuses to authenticated;
grant select, insert, update          on public.attendance_sessions to authenticated;
grant select                          on public.attendance_records to authenticated;
grant select                          on public.attendance_corrections to authenticated;

-- -----------------------------------------------------------------------------
-- Portée « mes classes »
-- -----------------------------------------------------------------------------
-- Un rôle ENSEIGNANT doit être rattaché à la classe, soit comme professeur
-- principal, soit par une affectation matière. Les autres rôles ne sont pas
-- restreints par l'affectation : un administrateur d'établissement ou le
-- personnel administratif appelle n'importe quelle classe de son périmètre.
--
-- Échec fermé : un compte de rôle TEACHER sans fiche enseignant rattachée ne
-- passe aucune classe.

create or replace function ecoleplus.classe_enseignee(p_class_id uuid)
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
                       where ta.class_id = p_class_id and ta.teacher_id = t.id)
         )
    )
  end;
$$;

grant execute on function ecoleplus.classe_enseignee(uuid) to authenticated;

-- Raccourci de lecture : la séance est-elle dans mon périmètre ?
create or replace function ecoleplus.seance_accessible(p_session_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.attendance_sessions s
     where s.id = p_session_id
       and ecoleplus.can_read(s.organization_id, p_permission, s.establishment_id)
       and ecoleplus.classe_enseignee(s.class_id)
  );
$$;

grant execute on function ecoleplus.seance_accessible(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- Les statuts sont du paramétrage : tout membre pouvant lire les présences doit
-- les voir, sinon l'interface ne sait pas quoi afficher.
create policy attendance_statuses_select on public.attendance_statuses
  for select to authenticated
  using (organization_id = (select ecoleplus.current_org_id()));

create policy attendance_statuses_ecriture on public.attendance_statuses
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'attendance.configure', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'attendance.configure', establishment_id));

create policy attendance_sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    ecoleplus.can_read(organization_id, 'attendance.read', establishment_id)
    and ecoleplus.classe_enseignee(class_id)
  );

create policy attendance_sessions_insert on public.attendance_sessions
  for insert to authenticated
  with check (
    ecoleplus.can_write(organization_id, 'attendance.record', establishment_id)
    and ecoleplus.classe_enseignee(class_id)
  );

-- La séance se modifie tant qu'elle est ouverte. La valider et la rouvrir
-- passent par les fonctions ci-dessous, qui exigent d'autres permissions.
create policy attendance_sessions_update on public.attendance_sessions
  for update to authenticated
  using (
    status = 'OPEN'
    and ecoleplus.can_write(organization_id, 'attendance.record', establishment_id)
    and ecoleplus.classe_enseignee(class_id)
  )
  with check (
    status = 'OPEN'
    and ecoleplus.can_write(organization_id, 'attendance.record', establishment_id)
  );

create policy attendance_records_select on public.attendance_records
  for select to authenticated
  using (ecoleplus.seance_accessible(session_id, 'attendance.read'));

-- Aucune policy d'écriture sur `attendance_records` : l'appel, la validation et
-- la correction passent tous par les fonctions de cette migration, qui
-- contrôlent le verrouillage de la séance et tracent les corrections.

create policy attendance_corrections_select on public.attendance_corrections
  for select to authenticated
  using (exists (
    select 1 from public.attendance_records r
     where r.id = attendance_corrections.record_id
       and ecoleplus.seance_accessible(r.session_id, 'attendance.read')
  ));

-- =============================================================================
-- Opérations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Faire l'appel
-- -----------------------------------------------------------------------------
-- Prend la feuille entière d'un coup. L'appel se fait debout en classe, souvent
-- sur une connexion instable : un aller-retour par apprenant serait intenable.
--
-- Le format attendu :
--   [{"enrollment_id": "...", "status_id": "...", "comment": "..."}, ...]

create or replace function public.enregistrer_appel(
  p_session_id uuid,
  p_lignes     jsonb
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_seance public.attendance_sessions;
  v_nombre integer;
begin
  select * into v_seance from public.attendance_sessions where id = p_session_id;

  if v_seance.id is null
     or v_seance.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_SEANCE_INTROUVABLE: cette séance n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_seance.organization_id, 'attendance.record',
                             v_seance.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: faire l''appel exige la permission attendance.record'
      using errcode = 'insufficient_privilege';
  end if;

  if not ecoleplus.classe_enseignee(v_seance.class_id) then
    raise exception 'ECOLEPLUS_HORS_MES_CLASSES: vous n''enseignez pas dans cette classe'
      using errcode = 'insufficient_privilege';
  end if;

  if v_seance.status = 'VALIDATED' then
    raise exception 'ECOLEPLUS_SEANCE_VALIDEE: cette séance est close ; passez par une correction'
      using errcode = 'insufficient_privilege';
  end if;

  -- Réécriture de la feuille : l'appel est idempotent, le rejouer corrige une
  -- saisie partielle sans créer de doublon (l'unicité la refuserait de toute façon).
  insert into public.attendance_records
    (organization_id, session_id, enrollment_id, status_id, comment, recorded_by)
  select v_seance.organization_id, p_session_id,
         (ligne ->> 'enrollment_id')::uuid,
         (ligne ->> 'status_id')::uuid,
         nullif(trim(coalesce(ligne ->> 'comment', '')), ''),
         ecoleplus.current_profile_id()
    from jsonb_array_elements(p_lignes) as ligne
  on conflict (session_id, enrollment_id) do update
    set status_id   = excluded.status_id,
        comment     = excluded.comment,
        recorded_by = excluded.recorded_by,
        recorded_at = now();

  get diagnostics v_nombre = row_count;

  perform ecoleplus.write_audit_log(
    'attendance.recorded', 'attendance_session', p_session_id::text,
    v_seance.organization_id, v_seance.establishment_id,
    null, jsonb_build_object('lignes', v_nombre), null);

  return v_nombre;
end;
$$;

-- -----------------------------------------------------------------------------
-- Valider / rouvrir une séance
-- -----------------------------------------------------------------------------

create or replace function public.valider_seance(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_seance public.attendance_sessions;
  v_appeles integer;
  v_attendus integer;
begin
  select * into v_seance from public.attendance_sessions where id = p_session_id;

  if v_seance.id is null
     or v_seance.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_SEANCE_INTROUVABLE: cette séance n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_seance.organization_id, 'attendance.validate',
                             v_seance.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: valider exige la permission attendance.validate'
      using errcode = 'insufficient_privilege';
  end if;

  if v_seance.status = 'VALIDATED' then
    return;
  end if;

  -- Une feuille incomplète ne se valide pas : un apprenant sans statut n'est
  -- ni présent ni absent, et cette ambiguïté ne doit pas être figée.
  select count(*) into v_appeles
    from public.attendance_records where session_id = p_session_id;

  select count(*) into v_attendus
    from public.enrollments e
   where e.class_id = v_seance.class_id
     and e.status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED');

  if v_appeles < v_attendus then
    raise exception 'ECOLEPLUS_APPEL_INCOMPLET: % apprenant(s) sur % sans statut', v_attendus - v_appeles, v_attendus
      using errcode = 'check_violation';
  end if;

  update public.attendance_sessions
     set status = 'VALIDATED',
         validated_by = ecoleplus.current_profile_id(),
         validated_at = now()
   where id = p_session_id;

  perform ecoleplus.write_audit_log(
    'attendance.validated', 'attendance_session', p_session_id::text,
    v_seance.organization_id, v_seance.establishment_id,
    null, jsonb_build_object('appeles', v_appeles), null);
end;
$$;

create or replace function public.rouvrir_seance(p_session_id uuid, p_raison text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_seance public.attendance_sessions;
begin
  select * into v_seance from public.attendance_sessions where id = p_session_id;

  if v_seance.id is null
     or v_seance.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_SEANCE_INTROUVABLE: cette séance n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  -- Rouvrir exige une permission DISTINCTE de celle qui permet l'appel : c'est
  -- ce qui donne sa valeur au verrouillage.
  if not ecoleplus.can_write(v_seance.organization_id, 'attendance.correct',
                             v_seance.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: rouvrir une séance exige la permission attendance.correct'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: rouvrir une séance close exige un motif'
      using errcode = 'check_violation';
  end if;

  update public.attendance_sessions
     set status = 'OPEN', validated_by = null, validated_at = null
   where id = p_session_id;

  perform ecoleplus.write_audit_log(
    'attendance.reopened', 'attendance_session', p_session_id::text,
    v_seance.organization_id, v_seance.establishment_id,
    jsonb_build_object('status', 'VALIDATED'), jsonb_build_object('status', 'OPEN'),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Corriger une présence
-- -----------------------------------------------------------------------------
-- Seule voie de modification d'un enregistrement, séance close ou non. Le motif
-- est obligatoire et la trace ne se purge pas.

create or replace function public.corriger_presence(
  p_record_id     uuid,
  p_new_status_id uuid,
  p_raison        text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_record public.attendance_records;
  v_seance public.attendance_sessions;
begin
  select * into v_record from public.attendance_records where id = p_record_id;

  if v_record.id is null
     or v_record.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_PRESENCE_INTROUVABLE: cet enregistrement n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  select * into v_seance from public.attendance_sessions where id = v_record.session_id;

  if not ecoleplus.can_write(v_seance.organization_id, 'attendance.correct',
                             v_seance.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: corriger exige la permission attendance.correct'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: une correction de présence exige un motif'
      using errcode = 'check_violation';
  end if;

  if v_record.status_id = p_new_status_id then
    return;
  end if;

  update public.attendance_records
     set status_id = p_new_status_id, recorded_by = ecoleplus.current_profile_id()
   where id = p_record_id;

  insert into public.attendance_corrections
    (organization_id, record_id, old_status_id, new_status_id, reason, changed_by)
  values
    (v_record.organization_id, p_record_id, v_record.status_id, p_new_status_id,
     trim(p_raison), ecoleplus.current_profile_id());

  perform ecoleplus.write_audit_log(
    'attendance.corrected', 'attendance_record', p_record_id::text,
    v_seance.organization_id, v_seance.establishment_id,
    jsonb_build_object('status_id', v_record.status_id),
    jsonb_build_object('status_id', p_new_status_id),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------

revoke all on function
  public.enregistrer_appel(uuid, jsonb),
  public.valider_seance(uuid),
  public.rouvrir_seance(uuid, text),
  public.corriger_presence(uuid, uuid, text)
from public, anon;

grant execute on function
  public.enregistrer_appel(uuid, jsonb),
  public.valider_seance(uuid),
  public.rouvrir_seance(uuid, text),
  public.corriger_presence(uuid, uuid, text)
to authenticated;
