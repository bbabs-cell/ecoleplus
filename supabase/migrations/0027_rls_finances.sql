-- =============================================================================
-- 0027 — RLS et opérations financières
-- =============================================================================
-- Trois droits séparés, et cette séparation est le cœur du module :
-- l'agent de caisse encaisse sans pouvoir annuler, et consulter les rapports
-- financiers est encore autre chose (@docs/business-rules/finances.md, §3).
--
-- Aucune table d'argent n'accepte d'écriture directe. Créances, paiements,
-- affectations et reçus passent tous par les fonctions de cette migration,
-- qui seules savent refuser un trop-perçu, numéroter un reçu sous accès
-- concurrent et tracer une annulation.
-- =============================================================================

alter table public.fee_structures      enable row level security;
alter table public.fee_installments    enable row level security;
alter table public.fee_obligations     enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.receipts            enable row level security;
alter table public.receipt_counters    enable row level security;

revoke all on
  public.fee_structures, public.fee_installments, public.fee_obligations,
  public.payments, public.payment_allocations, public.receipts,
  public.receipt_counters
from anon, authenticated;

grant select, insert, update, delete on public.fee_structures   to authenticated;
grant select, insert, update, delete on public.fee_installments to authenticated;
-- L'argent ne s'écrit que par fonction.
grant select on public.fee_obligations     to authenticated;
grant select on public.payments            to authenticated;
grant select on public.payment_allocations to authenticated;
grant select on public.receipts            to authenticated;
-- Le compteur de reçus n'est lisible par personne : c'est de la mécanique
-- interne, et rien dans l'interface n'a à connaître le prochain numéro.

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

create policy fee_structures_select on public.fee_structures
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'finance.read', establishment_id));

create policy fee_structures_ecriture on public.fee_structures
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'finance.configure', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'finance.configure', establishment_id));

create policy fee_installments_select on public.fee_installments
  for select to authenticated
  using (exists (
    select 1 from public.fee_structures f
     where f.id = fee_installments.fee_structure_id
       and ecoleplus.can_read(f.organization_id, 'finance.read', f.establishment_id)));

create policy fee_installments_ecriture on public.fee_installments
  for all to authenticated
  using (exists (
    select 1 from public.fee_structures f
     where f.id = fee_installments.fee_structure_id
       and ecoleplus.can_write(f.organization_id, 'finance.configure', f.establishment_id)))
  with check (exists (
    select 1 from public.fee_structures f
     where f.id = fee_installments.fee_structure_id
       and ecoleplus.can_write(f.organization_id, 'finance.configure', f.establishment_id)));

create policy fee_obligations_select on public.fee_obligations
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'finance.read', establishment_id));

create policy payments_select on public.payments
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'finance.read', establishment_id));

create policy payment_allocations_select on public.payment_allocations
  for select to authenticated
  using (exists (
    select 1 from public.payments p
     where p.id = payment_allocations.payment_id
       and ecoleplus.can_read(p.organization_id, 'finance.read', p.establishment_id)));

create policy receipts_select on public.receipts
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'finance.read', establishment_id));

-- =============================================================================
-- Opérations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Affecter un frais à des inscriptions
-- -----------------------------------------------------------------------------
-- Un frais échelonné produit une créance par échéance. Un frais payable en une
-- fois en produit une seule. L'échéancier est vérifié AVANT : un échéancier
-- dont les parts ne font pas le montant produirait des créances fausses.

create or replace function public.affecter_frais(
  p_fee_structure_id uuid,
  p_enrollment_ids   uuid[]
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_frais   public.fee_structures;
  v_ecart   bigint;
  v_creees  integer := 0;
  v_insc    record;
  v_ech     record;
begin
  select * into v_frais from public.fee_structures where id = p_fee_structure_id;

  if v_frais.id is null
     or v_frais.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_FRAIS_INTROUVABLE: ce frais n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_frais.organization_id, 'finance.assign',
                             v_frais.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: affecter un frais exige la permission finance.assign'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.fee_installments where fee_structure_id = p_fee_structure_id) then
    v_ecart := public.ecart_echeancier(p_fee_structure_id);
    if v_ecart <> 0 then
      raise exception 'ECOLEPLUS_ECHEANCIER_INCOHERENT: les échéances totalisent % de %, écart de %',
        v_frais.amount_minor + v_ecart, v_frais.amount_minor, v_ecart
        using errcode = 'check_violation';
    end if;
  end if;

  for v_insc in
    select e.id, e.establishment_id
      from public.enrollments e
     where e.id = any (p_enrollment_ids)
       and e.establishment_id = v_frais.establishment_id
       and e.academic_year_id = v_frais.academic_year_id
       and e.status in ('PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED')
  loop
    if exists (select 1 from public.fee_installments where fee_structure_id = p_fee_structure_id) then
      for v_ech in
        select * from public.fee_installments
         where fee_structure_id = p_fee_structure_id order by position
      loop
        insert into public.fee_obligations
          (organization_id, establishment_id, enrollment_id, fee_structure_id,
           installment_id, label, due_on, currency, amount_minor)
        values
          (v_frais.organization_id, v_frais.establishment_id, v_insc.id, p_fee_structure_id,
           v_ech.id, v_frais.name || ' — ' || v_ech.label, v_ech.due_on,
           v_frais.currency, v_ech.share_minor)
        on conflict do nothing;
        if found then v_creees := v_creees + 1; end if;
      end loop;
    else
      insert into public.fee_obligations
        (organization_id, establishment_id, enrollment_id, fee_structure_id,
         label, due_on, currency, amount_minor)
      values
        (v_frais.organization_id, v_frais.establishment_id, v_insc.id, p_fee_structure_id,
         v_frais.name, current_date, v_frais.currency, v_frais.amount_minor)
      on conflict do nothing;
      if found then v_creees := v_creees + 1; end if;
    end if;
  end loop;

  perform ecoleplus.write_audit_log(
    'finance.fees_assigned', 'fee_structure', p_fee_structure_id::text,
    v_frais.organization_id, v_frais.establishment_id,
    null, jsonb_build_object('creances', v_creees), null);

  return v_creees;
end;
$$;

-- -----------------------------------------------------------------------------
-- Encaisser un paiement
-- -----------------------------------------------------------------------------
-- Paiement, affectations et reçu naissent dans la MÊME transaction : un
-- encaissement sans reçu, ou un reçu sans encaissement, n'existe jamais.
--
-- Les affectations peuvent être données explicitement :
--   [{"obligation_id": "...", "amount_minor": 25000}, ...]
-- Sinon le montant se répartit sur les créances ouvertes, de la plus ancienne
-- échéance à la plus récente. Cette répartition est une commodité de saisie,
-- pas une confirmation : le paiement lui-même se constate toujours, montant,
-- méthode et date à l'appui.

create or replace function public.encaisser_paiement(
  p_enrollment_id uuid,
  p_amount_minor  bigint,
  p_method_label  text,
  p_reference     text default null,
  p_paid_on       date default null,
  p_notes         text default null,
  p_affectations  jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_insc      public.enrollments;
  v_devise    text;
  v_paiement  uuid;
  v_recu      uuid;
  v_reste     bigint := p_amount_minor;
  v_part      bigint;
  v_ligne     jsonb;
  v_oblig     record;
  v_numero    text;
  v_date      date := coalesce(p_paid_on, current_date);
begin
  select * into v_insc from public.enrollments where id = p_enrollment_id;

  if v_insc.id is null
     or v_insc.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: cette inscription n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_insc.organization_id, 'finance.collect',
                             v_insc.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: encaisser exige la permission finance.collect'
      using errcode = 'insufficient_privilege';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'ECOLEPLUS_MONTANT_INVALIDE: un encaissement porte un montant strictement positif'
      using errcode = 'check_violation';
  end if;

  if length(trim(coalesce(p_method_label, ''))) = 0 then
    raise exception 'ECOLEPLUS_METHODE_REQUISE: un paiement se constate ; précisez son moyen'
      using errcode = 'check_violation';
  end if;

  v_devise := ecoleplus.devise_etablissement(v_insc.establishment_id);

  insert into public.payments
    (organization_id, establishment_id, enrollment_id, amount_minor, currency,
     method_label, reference, paid_on, notes, received_by)
  values
    (v_insc.organization_id, v_insc.establishment_id, p_enrollment_id, p_amount_minor,
     v_devise, trim(p_method_label), nullif(trim(coalesce(p_reference, '')), ''),
     v_date, nullif(trim(coalesce(p_notes, '')), ''), ecoleplus.current_profile_id())
  returning id into v_paiement;

  if p_affectations is not null and jsonb_array_length(p_affectations) > 0 then
    for v_ligne in select * from jsonb_array_elements(p_affectations)
    loop
      v_part := (v_ligne ->> 'amount_minor')::bigint;

      select o.*, o.total_minor - o.paid_minor as reste into v_oblig
        from public.fee_obligations o
       where o.id = (v_ligne ->> 'obligation_id')::uuid
         and o.enrollment_id = p_enrollment_id
         and o.cancelled_at is null
       for update;

      if v_oblig.id is null then
        raise exception 'ECOLEPLUS_CREANCE_INTROUVABLE: créance inconnue ou annulée pour cette inscription'
          using errcode = 'no_data_found';
      end if;

      if v_part > v_oblig.reste then
        raise exception 'ECOLEPLUS_TROP_PERCU: % affectés sur « % » alors qu''il reste % à régler',
          v_part, v_oblig.label, v_oblig.reste
          using errcode = 'check_violation';
      end if;

      insert into public.payment_allocations
        (organization_id, payment_id, obligation_id, amount_minor)
      values (v_insc.organization_id, v_paiement, v_oblig.id, v_part);

      v_reste := v_reste - v_part;
    end loop;

    if v_reste <> 0 then
      raise exception 'ECOLEPLUS_AFFECTATION_INCOMPLETE: % non affectés sur un encaissement de %',
        v_reste, p_amount_minor
        using errcode = 'check_violation';
    end if;
  else
    -- Répartition automatique, de l'échéance la plus ancienne à la plus récente.
    for v_oblig in
      select o.*, o.total_minor - o.paid_minor as reste
        from public.fee_obligations o
       where o.enrollment_id = p_enrollment_id
         and o.cancelled_at is null
         and o.total_minor > o.paid_minor
       order by o.due_on, o.created_at
       for update
    loop
      exit when v_reste <= 0;
      v_part := least(v_reste, v_oblig.reste);

      insert into public.payment_allocations
        (organization_id, payment_id, obligation_id, amount_minor)
      values (v_insc.organization_id, v_paiement, v_oblig.id, v_part);

      v_reste := v_reste - v_part;
    end loop;

    -- Un encaissement qui dépasse ce qui est dû est refusé : le trop-perçu se
    -- traite par un avoir explicite, pas par un solde négatif silencieux.
    if v_reste > 0 then
      raise exception 'ECOLEPLUS_TROP_PERCU: % de plus que le total dû par cet apprenant', v_reste
        using errcode = 'check_violation';
    end if;
  end if;

  v_numero := ecoleplus.prochain_numero_recu(
    v_insc.establishment_id, v_insc.organization_id, extract(year from v_date)::integer);

  insert into public.receipts
    (organization_id, establishment_id, payment_id, number, issued_by)
  values
    (v_insc.organization_id, v_insc.establishment_id, v_paiement, v_numero,
     ecoleplus.current_profile_id())
  returning id into v_recu;

  perform ecoleplus.write_audit_log(
    'finance.payment_received', 'payment', v_paiement::text,
    v_insc.organization_id, v_insc.establishment_id,
    null,
    jsonb_build_object('montant', p_amount_minor, 'devise', v_devise,
                       'methode', trim(p_method_label), 'recu', v_numero),
    null);

  return v_recu;
end;
$$;

-- -----------------------------------------------------------------------------
-- Annuler un reçu
-- -----------------------------------------------------------------------------
-- Permission DISTINCTE de celle qui permet d'encaisser. Si annuler découlait
-- d'encaisser, l'agent de caisse pourrait effacer ses propres encaissements :
-- exactement ce que la séparation est censée empêcher.

create or replace function public.annuler_recu(p_receipt_id uuid, p_raison text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_recu public.receipts;
begin
  select * into v_recu from public.receipts where id = p_receipt_id;

  if v_recu.id is null
     or v_recu.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_RECU_INTROUVABLE: ce reçu n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_recu.organization_id, 'finance.void',
                             v_recu.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: annuler un reçu exige la permission finance.void'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: annuler un reçu exige un motif'
      using errcode = 'check_violation';
  end if;

  if v_recu.voided_at is not null then
    return;
  end if;

  update public.receipts
     set voided_at = now(),
         voided_by = ecoleplus.current_profile_id(),
         void_reason = trim(p_raison)
   where id = p_receipt_id;

  perform ecoleplus.write_audit_log(
    'finance.receipt_voided', 'receipt', p_receipt_id::text,
    v_recu.organization_id, v_recu.establishment_id,
    jsonb_build_object('numero', v_recu.number, 'annule', false),
    jsonb_build_object('numero', v_recu.number, 'annule', true),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Annuler une créance, poser une remise
-- -----------------------------------------------------------------------------

create or replace function public.annuler_creance(p_obligation_id uuid, p_raison text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_oblig public.fee_obligations;
begin
  select * into v_oblig from public.fee_obligations where id = p_obligation_id;

  if v_oblig.id is null
     or v_oblig.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_CREANCE_INTROUVABLE: cette créance n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_oblig.organization_id, 'finance.void',
                             v_oblig.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: annuler une créance exige la permission finance.void'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: annuler une créance exige un motif'
      using errcode = 'check_violation';
  end if;

  -- Une créance déjà réglée ne s'annule pas : il faudrait d'abord annuler les
  -- reçus qui l'ont soldée, et ce geste-là doit rester explicite.
  if v_oblig.paid_minor > 0 then
    raise exception 'ECOLEPLUS_CREANCE_REGLEE: cette créance porte % déjà réglés ; annulez d''abord les reçus', v_oblig.paid_minor
      using errcode = 'check_violation';
  end if;

  update public.fee_obligations
     set cancelled_at = now(),
         cancelled_by = ecoleplus.current_profile_id(),
         cancel_reason = trim(p_raison)
   where id = p_obligation_id;

  perform ecoleplus.write_audit_log(
    'finance.obligation_cancelled', 'fee_obligation', p_obligation_id::text,
    v_oblig.organization_id, v_oblig.establishment_id,
    jsonb_build_object('total', v_oblig.total_minor),
    jsonb_build_object('annulee', true), p_raison);
end;
$$;

create or replace function public.ajuster_creance(
  p_obligation_id  uuid,
  p_discount_minor bigint,
  p_adjustment_minor bigint,
  p_raison         text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_oblig public.fee_obligations;
begin
  select * into v_oblig from public.fee_obligations where id = p_obligation_id;

  if v_oblig.id is null
     or v_oblig.organization_id is distinct from ecoleplus.current_org_id() then
    raise exception 'ECOLEPLUS_CREANCE_INTROUVABLE: cette créance n''existe pas dans votre organisation'
      using errcode = 'no_data_found';
  end if;

  if not ecoleplus.can_write(v_oblig.organization_id, 'finance.assign',
                             v_oblig.establishment_id) then
    raise exception 'ECOLEPLUS_PERMISSION: ajuster une créance exige la permission finance.assign'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_raison, ''))) = 0 then
    raise exception 'ECOLEPLUS_MOTIF_REQUIS: une remise ou un ajustement exige un motif'
      using errcode = 'check_violation';
  end if;

  -- Réduire le dû en dessous de ce qui a déjà été encaissé créerait un
  -- trop-perçu rétroactif.
  if v_oblig.amount_minor - coalesce(p_discount_minor, 0)
     + coalesce(p_adjustment_minor, 0) < v_oblig.paid_minor then
    raise exception 'ECOLEPLUS_AJUSTEMENT_IMPOSSIBLE: le total deviendrait inférieur aux % déjà réglés', v_oblig.paid_minor
      using errcode = 'check_violation';
  end if;

  update public.fee_obligations
     set discount_minor = coalesce(p_discount_minor, 0),
         adjustment_minor = coalesce(p_adjustment_minor, 0)
   where id = p_obligation_id;

  perform ecoleplus.write_audit_log(
    'finance.obligation_adjusted', 'fee_obligation', p_obligation_id::text,
    v_oblig.organization_id, v_oblig.establishment_id,
    jsonb_build_object('remise', v_oblig.discount_minor,
                       'ajustement', v_oblig.adjustment_minor),
    jsonb_build_object('remise', coalesce(p_discount_minor, 0),
                       'ajustement', coalesce(p_adjustment_minor, 0)),
    p_raison);
end;
$$;

-- -----------------------------------------------------------------------------
-- Situation financière
-- -----------------------------------------------------------------------------
-- Le solde est TOUJOURS calculé ici, jamais stocké quelque part comme vérité.

create or replace function public.situation_financiere(p_enrollment_id uuid)
returns table (
  devise        text,
  du_minor      bigint,
  regle_minor   bigint,
  solde_minor   bigint,
  creances      integer,
  en_retard     integer
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_insc public.enrollments;
begin
  select * into v_insc from public.enrollments where id = p_enrollment_id;

  if v_insc.id is null
     or not ecoleplus.can_read(v_insc.organization_id, 'finance.read',
                               v_insc.establishment_id) then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: inscription hors de votre périmètre'
      using errcode = 'no_data_found';
  end if;

  return query
  select o.currency,
         sum(o.total_minor)::bigint,
         sum(o.paid_minor)::bigint,
         sum(o.total_minor - o.paid_minor)::bigint,
         count(*)::integer,
         count(*) filter (
           where o.due_on < current_date and o.total_minor > o.paid_minor)::integer
    from public.fee_obligations o
   where o.enrollment_id = p_enrollment_id
     and o.cancelled_at is null
   group by o.currency;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
-- `prochain_numero_recu` et `recalculer_solde_obligation` restent hors de
-- portée : ce sont des rouages internes, appelés par les opérations ci-dessus.

revoke all on function
  public.affecter_frais(uuid, uuid[]),
  public.encaisser_paiement(uuid, bigint, text, text, date, text, jsonb),
  public.annuler_recu(uuid, text),
  public.annuler_creance(uuid, text),
  public.ajuster_creance(uuid, bigint, bigint, text),
  public.situation_financiere(uuid),
  public.ecart_echeancier(uuid)
from public, anon;

revoke all on function
  ecoleplus.prochain_numero_recu(uuid, uuid, integer),
  ecoleplus.recalculer_solde_obligation(uuid)
from public, anon, authenticated;

grant execute on function
  public.affecter_frais(uuid, uuid[]),
  public.encaisser_paiement(uuid, bigint, text, text, date, text, jsonb),
  public.annuler_recu(uuid, text),
  public.annuler_creance(uuid, text),
  public.ajuster_creance(uuid, bigint, bigint, text),
  public.situation_financiere(uuid),
  public.ecart_echeancier(uuid)
to authenticated;
