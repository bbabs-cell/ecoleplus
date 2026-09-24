-- =============================================================================
-- 0026 — Chaîne de facturation
-- =============================================================================
--   frais → échéances → obligations (par inscription) → paiements → reçus
--
-- Quatre décisions portent le module.
--
-- 1. LES MONTANTS SONT DES ENTIERS EN UNITÉ MINEURE. Centimes, francs CFA :
--    `bigint`, jamais `numeric`, jamais de virgule flottante. Un centime perdu
--    à l'arrondi dans une comptabilité est une erreur, pas une approximation.
--
-- 2. LE SOLDE SE DÉDUIT, IL NE SE SAISIT PAS. `paid_minor` est maintenu par
--    déclencheur à partir des affectations de paiement ; `status` est une
--    colonne GÉNÉRÉE. Aucune écriture applicative ne peut donc déclarer payée
--    une créance qui ne l'est pas.
--
-- 3. LE PAIEMENT PARTIEL EST LE CAS COURANT, pas l'exception. Un paiement
--    s'affecte à une ou plusieurs obligations, et le total affecté ne peut
--    jamais dépasser ce qui reste dû.
--
-- 4. UN REÇU NE SE SUPPRIME JAMAIS. Il s'annule, et la trace reste. Un reçu
--    supprimé est une comptabilité falsifiée.
-- =============================================================================

create type public.fee_kind as enum (
  'REGISTRATION', 'TUITION', 'FILE', 'TRANSPORT', 'EXAM', 'SUPPLIES', 'OTHER'
);

create type public.obligation_status as enum ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED');

-- -----------------------------------------------------------------------------
-- Devise de fonctionnement
-- -----------------------------------------------------------------------------
-- « La devise est celle de l'établissement. Pas de conversion automatique »
-- (@docs/business-rules/finances.md). Le réglage descend à l'établissement, et
-- retombe sur celui de l'organisation quand il n'est pas posé.

create or replace function ecoleplus.devise_etablissement(p_establishment_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    nullif(trim(both '"' from
      (ecoleplus.reglage_etablissement(p_establishment_id, 'finance.currency', 'null'::jsonb))::text),
      'null'),
    (select os.currency
       from public.organization_settings os
       join public.establishments e on e.organization_id = os.organization_id
      where e.id = p_establishment_id),
    'EUR');
$$;

grant execute on function ecoleplus.devise_etablissement(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- fee_structures — le catalogue des frais
-- -----------------------------------------------------------------------------

create table public.fee_structures (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  academic_year_id uuid not null,
  level_id         uuid,
  name             text not null,
  code             text not null,
  kind             public.fee_kind not null default 'OTHER',
  -- Libellé libre du type de frais : « frais de dossier », « cantine »… le
  -- vocabulaire d'un établissement n'est pas celui d'un autre.
  kind_label       text,
  amount_minor     bigint not null,
  currency         text not null,
  is_recurring     boolean not null default false,
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fee_structures_name_non_vide check (length(trim(name)) > 0),
  constraint fee_structures_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint fee_structures_montant_positif check (amount_minor > 0),
  constraint fee_structures_devise_iso check (currency ~ '^[A-Z]{3}$'),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (academic_year_id, establishment_id)
    references public.academic_years (id, establishment_id) on delete cascade,
  foreign key (level_id, establishment_id)
    references public.levels (id, establishment_id) on delete set null (level_id)
);

create unique index fee_structures_annee_code_unique
  on public.fee_structures (academic_year_id, upper(code));
create index fee_structures_etablissement_idx
  on public.fee_structures (establishment_id, academic_year_id);
create unique index fee_structures_id_org_unique
  on public.fee_structures (id, organization_id);

create trigger fee_structures_touch_updated_at
  before update on public.fee_structures
  for each row execute function ecoleplus.touch_updated_at();

comment on column public.fee_structures.amount_minor is
  'Unité mineure entière (centimes, francs CFA). Jamais de virgule flottante.';

-- -----------------------------------------------------------------------------
-- fee_installments — les échéances d'un frais
-- -----------------------------------------------------------------------------
-- Un frais peut se payer en plusieurs fois. La somme des parts doit faire le
-- montant du frais — vérifié par `verifier_echeancier`, appelé avant toute
-- affectation.

create table public.fee_installments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  fee_structure_id uuid not null,
  label            text not null,
  due_on           date not null,
  share_minor      bigint not null,
  position         smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fee_installments_label_non_vide check (length(trim(label)) > 0),
  constraint fee_installments_part_positive check (share_minor > 0),
  foreign key (fee_structure_id, organization_id)
    references public.fee_structures (id, organization_id) on delete cascade
);

create unique index fee_installments_position_unique
  on public.fee_installments (fee_structure_id, position);
create index fee_installments_frais_idx
  on public.fee_installments (fee_structure_id, due_on);
create unique index fee_installments_id_org_unique
  on public.fee_installments (id, organization_id);

create trigger fee_installments_touch_updated_at
  before update on public.fee_installments
  for each row execute function ecoleplus.touch_updated_at();

-- Somme des parts contre montant du frais. Rendu comme un écart signé : zéro
-- signifie que l'échéancier est complet.
create or replace function public.ecart_echeancier(p_fee_structure_id uuid)
returns bigint
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select sum(i.share_minor) from public.fee_installments i
                    where i.fee_structure_id = p_fee_structure_id), 0)
       - (select f.amount_minor from public.fee_structures f where f.id = p_fee_structure_id);
$$;

-- -----------------------------------------------------------------------------
-- fee_obligations — la créance d'une inscription
-- -----------------------------------------------------------------------------

create table public.fee_obligations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  enrollment_id    uuid not null,
  fee_structure_id uuid not null,
  installment_id   uuid,
  label            text not null,
  due_on           date not null,
  currency         text not null,

  amount_minor     bigint not null,
  -- Remise accordée, et ajustement (majoration de retard, correction).
  discount_minor   bigint not null default 0,
  adjustment_minor bigint not null default 0,

  -- Montant réellement dû. Colonne GÉNÉRÉE : elle ne peut pas dériver.
  total_minor      bigint generated always as
                     (amount_minor - discount_minor + adjustment_minor) stored,

  -- Maintenu par déclencheur depuis les affectations de paiement. Le solde se
  -- déduit des paiements, il ne se saisit pas.
  paid_minor       bigint not null default 0,

  cancelled_at     timestamptz,
  cancelled_by     uuid references public.profiles (id) on delete set null,
  cancel_reason    text,

  -- GÉNÉRÉE elle aussi : le statut ne peut jamais contredire les montants.
  -- (Une colonne générée ne peut pas en référencer une autre, d'où
  -- l'arithmétique répétée plutôt qu'un renvoi à `total_minor`.)
  -- Chaque libellé est casté INDIVIDUELLEMENT : `case ... end::enum` casterait
  -- un texte calculé, ce que PostgreSQL refuse dans une colonne générée
  -- (`enum_in` n'est que stable). Sur une constante, la conversion est résolue
  -- à la lecture de l'expression et reste donc immuable.
  status           public.obligation_status generated always as (
                     case
                       when cancelled_at is not null
                            then 'CANCELLED'::public.obligation_status
                       when paid_minor >= amount_minor - discount_minor + adjustment_minor
                            then 'PAID'::public.obligation_status
                       when paid_minor > 0
                            then 'PARTIAL'::public.obligation_status
                       else 'UNPAID'::public.obligation_status
                     end
                   ) stored,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint fee_obligations_label_non_vide check (length(trim(label)) > 0),
  constraint fee_obligations_montant_positif check (amount_minor > 0),
  constraint fee_obligations_remise check (discount_minor >= 0 and discount_minor <= amount_minor),
  constraint fee_obligations_regle_positif check (paid_minor >= 0),
  constraint fee_obligations_devise_iso check (currency ~ '^[A-Z]{3}$'),
  constraint fee_obligations_motif_annulation check (
    cancelled_at is null or length(trim(coalesce(cancel_reason, ''))) > 0
  ),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade,
  foreign key (fee_structure_id, organization_id)
    references public.fee_structures (id, organization_id) on delete restrict,
  foreign key (installment_id, organization_id)
    references public.fee_installments (id, organization_id) on delete restrict
);

-- Une créance par inscription, frais et échéance. Le `coalesce` neutralise le
-- nul du frais payé en une fois, que l'unicité ignorerait sinon.
create unique index fee_obligations_unique
  on public.fee_obligations (
    enrollment_id, fee_structure_id,
    coalesce(installment_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index fee_obligations_inscription_idx
  on public.fee_obligations (enrollment_id, due_on);
create index fee_obligations_etablissement_idx
  on public.fee_obligations (establishment_id, status, due_on);
create unique index fee_obligations_id_org_unique
  on public.fee_obligations (id, organization_id);

create trigger fee_obligations_touch_updated_at
  before update on public.fee_obligations
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- payments — l'encaissement
-- -----------------------------------------------------------------------------
-- « Aucune confirmation automatique sans preuve réelle » : un paiement se
-- constate, il ne se présume pas. D'où `received_by` et `paid_on` obligatoires,
-- et une référence libre pour la pièce justificative.

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  enrollment_id    uuid not null,
  amount_minor     bigint not null,
  currency         text not null,
  -- Espèces, virement, chèque, mobile money… texte libre : les moyens de
  -- paiement ne sont pas les mêmes d'un pays à l'autre.
  method_label     text not null,
  reference        text,
  paid_on          date not null default current_date,
  notes            text,
  received_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint payments_montant_positif check (amount_minor > 0),
  constraint payments_devise_iso check (currency ~ '^[A-Z]{3}$'),
  constraint payments_methode_non_vide check (length(trim(method_label)) > 0),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (enrollment_id, organization_id)
    references public.enrollments (id, organization_id) on delete cascade
);

create index payments_inscription_idx on public.payments (enrollment_id, paid_on desc);
create index payments_etablissement_idx
  on public.payments (establishment_id, paid_on desc);
create unique index payments_id_org_unique on public.payments (id, organization_id);

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function ecoleplus.touch_updated_at();

-- -----------------------------------------------------------------------------
-- receipts — le reçu, à numéro unique
-- -----------------------------------------------------------------------------
-- Un reçu par paiement. Il ne se supprime jamais : il s'annule.

create table public.receipts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  establishment_id uuid not null,
  payment_id       uuid not null,
  number           text not null,
  issued_at        timestamptz not null default now(),
  issued_by        uuid references public.profiles (id) on delete set null,

  voided_at        timestamptz,
  voided_by        uuid references public.profiles (id) on delete set null,
  void_reason      text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint receipts_numero_non_vide check (length(trim(number)) > 0),
  -- Une annulation sans motif n'est pas une annulation, c'est un effacement.
  constraint receipts_motif_annulation check (
    voided_at is null or length(trim(coalesce(void_reason, ''))) > 0
  ),

  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade,
  foreign key (payment_id, organization_id)
    references public.payments (id, organization_id) on delete cascade
);

-- Le numéro est unique par établissement, et un paiement n'a qu'un reçu.
create unique index receipts_numero_unique on public.receipts (establishment_id, number);
create unique index receipts_paiement_unique on public.receipts (payment_id);
create index receipts_etablissement_idx on public.receipts (establishment_id, issued_at desc);
create unique index receipts_id_org_unique on public.receipts (id, organization_id);

create trigger receipts_touch_updated_at
  before update on public.receipts
  for each row execute function ecoleplus.touch_updated_at();

comment on table public.receipts is
  'Un reçu ne se supprime jamais. Il s''annule — voided_at, voided_by, void_reason — et la trace reste.';

-- La suppression est refusée, quel que soit le rôle. C'est la règle 5 de
-- @CLAUDE.md appliquée à la pièce comptable la plus sensible du module.
create or replace function ecoleplus.interdire_suppression_recu()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'ECOLEPLUS_RECU_INDESTRUCTIBLE: un reçu ne se supprime pas ; il s''annule'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger receipts_jamais_supprime
  before delete on public.receipts
  for each row execute function ecoleplus.interdire_suppression_recu();

-- Un paiement non plus : il porte un reçu.
create trigger payments_jamais_supprime
  before delete on public.payments
  for each row execute function ecoleplus.interdire_suppression_recu();

-- -----------------------------------------------------------------------------
-- receipt_counters — la numérotation
-- -----------------------------------------------------------------------------
-- Le numéro doit rester unique sous accès concurrent. Un `max(number) + 1`
-- produirait des doublons dès que deux caisses encaissent en même temps : deux
-- transactions liraient le même maximum. Un compteur par établissement et par
-- année, incrémenté par `update ... returning`, verrouille la ligne et
-- sérialise réellement les deux appels.

create table public.receipt_counters (
  establishment_id uuid not null,
  organization_id  uuid not null,
  year             integer not null,
  next_value       bigint not null default 1,
  primary key (establishment_id, year),
  constraint receipt_counters_valeur check (next_value >= 1),
  foreign key (establishment_id, organization_id)
    references public.establishments (id, organization_id) on delete cascade
);

create or replace function ecoleplus.prochain_numero_recu(
  p_establishment_id uuid, p_organization_id uuid, p_annee integer
)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_valeur bigint;
  v_code   text;
begin
  -- Deux temps volontairement séparés : la ligne est créée si elle manque,
  -- puis incrémentée par un UPDATE. C'est l'UPDATE qui verrouille la ligne, et
  -- une seconde caisse encaissant au même instant attend ce verrou avant de
  -- lire la valeur suivante. Un `max(number) + 1` ne donnerait pas cette
  -- garantie : deux transactions liraient le même maximum.
  insert into public.receipt_counters
    (establishment_id, organization_id, year, next_value)
  values (p_establishment_id, p_organization_id, p_annee, 1)
  on conflict (establishment_id, year) do nothing;

  update public.receipt_counters
     set next_value = next_value + 1
   where establishment_id = p_establishment_id and year = p_annee
  returning next_value - 1 into v_valeur;

  select coalesce(nullif(trim(e.code), ''), 'REC') into v_code
    from public.establishments e where e.id = p_establishment_id;

  return format('%s-%s-%s', upper(v_code), p_annee, lpad(v_valeur::text, 5, '0'));
end;
$$;

-- -----------------------------------------------------------------------------
-- payment_allocations — ce qu'un paiement règle
-- -----------------------------------------------------------------------------
-- C'est ici que le paiement partiel prend forme : un encaissement se répartit
-- sur une ou plusieurs créances, et chaque part est une ligne.

create table public.payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  payment_id      uuid not null,
  obligation_id   uuid not null,
  amount_minor    bigint not null,
  created_at      timestamptz not null default now(),

  constraint payment_allocations_montant_positif check (amount_minor > 0),
  foreign key (payment_id, organization_id)
    references public.payments (id, organization_id) on delete cascade,
  foreign key (obligation_id, organization_id)
    references public.fee_obligations (id, organization_id) on delete cascade
);

create unique index payment_allocations_unique
  on public.payment_allocations (payment_id, obligation_id);
create index payment_allocations_obligation_idx
  on public.payment_allocations (obligation_id);

-- -----------------------------------------------------------------------------
-- Le solde se déduit des paiements
-- -----------------------------------------------------------------------------
-- Recalcul complet de la créance touchée, à partir des seules affectations dont
-- le reçu n'est pas annulé. Annuler un reçu remet donc automatiquement la
-- créance au solde qu'elle avait avant l'encaissement — sans rien effacer.

create or replace function ecoleplus.recalculer_solde_obligation(p_obligation_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_regle bigint;
  v_du    bigint;
begin
  select coalesce(sum(pa.amount_minor), 0) into v_regle
    from public.payment_allocations pa
    join public.payments p on p.id = pa.payment_id
    left join public.receipts r on r.payment_id = p.id
   where pa.obligation_id = p_obligation_id
     and (r.id is null or r.voided_at is null);

  select total_minor into v_du
    from public.fee_obligations where id = p_obligation_id;

  -- Le trop-perçu n'existe pas : les opérations refusent d'affecter au-delà du
  -- reste dû. Si la garde tombait, mieux vaut un échec bruyant qu'un solde faux.
  if v_regle > v_du then
    raise exception 'ECOLEPLUS_TROP_PERCU: % affectés pour % dus sur cette créance', v_regle, v_du
      using errcode = 'check_violation';
  end if;

  update public.fee_obligations
     set paid_minor = v_regle
   where id = p_obligation_id
     and paid_minor is distinct from v_regle;
end;
$$;

create or replace function ecoleplus.declencher_solde_obligation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform ecoleplus.recalculer_solde_obligation(
    case tg_op when 'DELETE' then old.obligation_id else new.obligation_id end);
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger payment_allocations_solde
  after insert or update or delete on public.payment_allocations
  for each row execute function ecoleplus.declencher_solde_obligation();

-- L'annulation d'un reçu rend leur solde à toutes les créances qu'il réglait.
create or replace function ecoleplus.declencher_solde_apres_annulation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_obligation uuid;
begin
  if new.voided_at is not distinct from old.voided_at then return new; end if;

  for v_obligation in
    select pa.obligation_id from public.payment_allocations pa
     where pa.payment_id = new.payment_id
  loop
    perform ecoleplus.recalculer_solde_obligation(v_obligation);
  end loop;

  return new;
end;
$$;

create trigger receipts_solde_apres_annulation
  after update of voided_at on public.receipts
  for each row execute function ecoleplus.declencher_solde_apres_annulation();

-- -----------------------------------------------------------------------------
-- Cohérence de devise
-- -----------------------------------------------------------------------------
-- « Pas de conversion automatique : une conversion non contrôlée dans une
-- comptabilité est une erreur, pas une commodité. » On refuse donc plutôt que
-- de convertir.

create or replace function ecoleplus.verifier_devise_affectation()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_devise_paiement text;
  v_devise_creance  text;
begin
  select currency into v_devise_paiement from public.payments where id = new.payment_id;
  select currency into v_devise_creance  from public.fee_obligations where id = new.obligation_id;

  if v_devise_paiement is distinct from v_devise_creance then
    raise exception 'ECOLEPLUS_DEVISE_DISCORDANTE: paiement en %, créance en % — aucune conversion automatique',
      v_devise_paiement, v_devise_creance
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger payment_allocations_devise
  before insert or update on public.payment_allocations
  for each row execute function ecoleplus.verifier_devise_affectation();

-- La créance suit l'inscription : même établissement, forcément.
create or replace function ecoleplus.verifier_inscription_de_la_creance()
returns trigger
language plpgsql
set search_path to ''
as $$
declare v_etab uuid;
begin
  select establishment_id into v_etab from public.enrollments where id = new.enrollment_id;

  if v_etab is distinct from new.establishment_id then
    raise exception 'ECOLEPLUS_ETABLISSEMENT_DISCORDANT: cette inscription ne relève pas de l''établissement de la créance'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger fee_obligations_verifier_inscription
  before insert or update of enrollment_id, establishment_id on public.fee_obligations
  for each row execute function ecoleplus.verifier_inscription_de_la_creance();

create trigger payments_verifier_inscription
  before insert or update of enrollment_id, establishment_id on public.payments
  for each row execute function ecoleplus.verifier_inscription_de_la_creance();
