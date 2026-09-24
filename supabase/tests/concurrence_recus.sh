#!/usr/bin/env bash
# =============================================================================
# Unicité du numéro de reçu sous accès réellement concurrent
# =============================================================================
#   PGHOST=... PGPORT=... PGUSER=... bash supabase/tests/concurrence_recus.sh
#
# Les suites `.sql` s'exécutent dans une transaction unique et se terminent par
# un ROLLBACK : elles ne peuvent pas éprouver la concurrence, une transaction ne
# se concurrençant pas elle-même. Ce harnais ouvre donc N connexions qui
# encaissent AU MÊME INSTANT, et vérifie que les N reçus portent N numéros
# distincts.
#
# C'est le scénario « numéro de reçu unique sous accès concurrent » de
# @docs/business-rules/finances.md §4.
#
# Il crée sa PROPRE base jetable et la supprime à la fin : il ne touche jamais
# une base existante.
# =============================================================================
set -u

CAISSES="${CAISSES:-12}"
BASE="ecoleplus_concurrence_$$"
RACINE="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Base jetable : $BASE — $CAISSES caisses simultanées"

nettoyer() { psql -q -d postgres -c "drop database if exists $BASE" >/dev/null 2>&1; }
trap nettoyer EXIT

psql -q -d postgres -c "create database $BASE" || { echo "ECHEC: création de la base"; exit 1; }

# Rôles Supabase et schéma auth minimal.
psql -q -d "$BASE" -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || { echo "ECHEC: socle"; exit 1; }
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin; end if;
end $$;
create schema auth authorization supabase_auth_admin;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now());
grant usage on schema auth to postgres, authenticated, service_role;
grant select on auth.users to postgres, service_role;
SQL

for f in "$RACINE"/supabase/migrations/0*.sql; do
  psql -q -d "$BASE" -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 \
    || { echo "ECHEC: migration $(basename "$f")"; exit 1; }
done

# Fixture : une organisation, un établissement, un apprenant, et autant de
# créances que de caisses — chacune sera réglée par une connexion distincte.
psql -q -d "$BASE" -v ON_ERROR_STOP=1 -v caisses="$CAISSES" >/dev/null <<'SQL' || { echo "ECHEC: fixture"; exit 1; }
insert into auth.users (email, raw_user_meta_data)
values ('caisse@test', '{"given_name":"Caisse","family_name":"Test"}');

select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email='caisse@test'))::text, false);
set role authenticated;
select public.creer_organisation('Concurrence', 'SN', 'Africa/Dakar', 'XOF', 'fr');
reset role;

insert into public.establishments (organization_id, name, code)
select id, 'Etablissement', 'ETB' from public.organizations;

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on, is_current)
select e.organization_id, e.id, '2026-2027', date '2026-10-01', date '2027-07-10', true
  from public.establishments e;

-- Les claims se posent AVANT de prendre le rôle : `auth.users` n'est pas
-- lisible par `authenticated`, et c'est voulu.
select set_config('request.jwt.claims',
  (ecoleplus.custom_access_token_hook(jsonb_build_object(
     'user_id', u.id,
     'claims', jsonb_build_object('sub', u.id::text,
                                  'iat', extract(epoch from now())::bigint)))
   -> 'claims')::text, false)
  from auth.users u where u.email = 'caisse@test';
set role authenticated;

select public.inscrire_apprenant(
  (select id from public.establishments),
  (select id from public.academic_years),
  'Awa', 'Sow', null, null, null, null, 'A1', null, null,
  'ACTIVE'::public.enrollment_status);
reset role;

-- Un frais échelonné en autant de parts que de caisses : l'unicité des
-- créances porte sur (inscription, frais, échéance), il faut donc des
-- échéances distinctes et non des créances répétées.
insert into public.fee_structures
  (organization_id, establishment_id, academic_year_id, name, code, amount_minor, currency)
select e.organization_id, e.id, y.id, 'Frais', 'FR', 1000 * :caisses, 'XOF'
  from public.establishments e join public.academic_years y on y.establishment_id = e.id;

insert into public.fee_installments
  (organization_id, fee_structure_id, label, due_on, share_minor, position)
select f.organization_id, f.id, 'Echeance ' || g, current_date, 1000, g
  from public.fee_structures f cross join generate_series(1, :caisses) g;

-- Une créance par caisse : chaque connexion en règle une, et toutes émettent
-- leur reçu en même temps.
insert into public.fee_obligations
  (organization_id, establishment_id, enrollment_id, fee_structure_id,
   installment_id, label, due_on, currency, amount_minor)
select f.organization_id, f.establishment_id, en.id, f.id,
       i.id, i.label, i.due_on, 'XOF', i.share_minor
  from public.fee_structures f
  join public.fee_installments i on i.fee_structure_id = f.id
  cross join public.enrollments en;
SQL

# Les caisses. Chacune ouvre sa propre connexion, attend le même instant de
# départ, puis encaisse.
DEPART=$(date +%s)
DEPART=$((DEPART + 3))

for i in $(seq 1 "$CAISSES"); do
  (
    psql -q -d "$BASE" -v ON_ERROR_STOP=1 -v rang="$i" -v depart="$DEPART" >/dev/null 2>&1 <<'SQL'
select set_config('request.jwt.claims',
  (ecoleplus.custom_access_token_hook(jsonb_build_object(
     'user_id', u.id,
     'claims', jsonb_build_object('sub', u.id::text,
                                  'iat', extract(epoch from now())::bigint)))
   -> 'claims')::text, false)
  from auth.users u where u.email = 'caisse@test';
set role authenticated;

-- Toutes les caisses se synchronisent sur la même seconde : c'est ce qui rend
-- la concurrence réelle plutôt que théorique.
select pg_sleep(greatest(0, :depart - extract(epoch from clock_timestamp())));

select public.encaisser_paiement(
  (select id from public.enrollments), 1000, 'Especes', 'CAISSE-' || :rang,
  null, null,
  jsonb_build_array(jsonb_build_object(
    'obligation_id', (select o.id from public.fee_obligations o
                       where o.label = 'Echeance ' || :rang),
    'amount_minor', 1000)));
SQL
  ) &
done
wait

LIGNES=$(psql -Atq -d "$BASE" -c "
  select count(*) || '|' || count(distinct number) from public.receipts;")
EMIS="${LIGNES%%|*}"
DISTINCTS="${LIGNES##*|}"

echo "Reçus émis : $EMIS — numéros distincts : $DISTINCTS"

if [ "$EMIS" = "$CAISSES" ] && [ "$DISTINCTS" = "$CAISSES" ]; then
  echo "  OK    $CAISSES caisses simultanées, $CAISSES numéros distincts"
  exit 0
fi

echo "ECHEC: $EMIS reçus pour $DISTINCTS numéros distincts (attendu $CAISSES et $CAISSES)"
psql -Atq -d "$BASE" -c "
  select number, count(*) from public.receipts
   group by number having count(*) > 1;"
exit 1
