-- =============================================================================
-- 0028 — Permissions financières
-- =============================================================================
--   finance.read      — consulter frais, créances, paiements et reçus
--   finance.configure — définir les frais et leurs échéances
--   finance.assign    — affecter un frais, poser une remise ou un ajustement
--   finance.collect   — encaisser un paiement
--   finance.void      — annuler un reçu ou une créance
--   finance.report    — consulter les rapports financiers de l'établissement
--
-- « Enregistrer un paiement, annuler un reçu et consulter les rapports
-- financiers sont trois droits séparés. L'agent de caisse encaisse sans
-- pouvoir annuler » (@docs/business-rules/finances.md, §3).
--
-- L'enseignant n'a AUCUN droit financier. Ce n'est pas un oubli : la situation
-- de paiement d'une famille n'a pas à circuler en salle des professeurs.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('finance.read',      'finance', 'Consulter les frais, les créances, les paiements et les reçus'),
  ('finance.configure', 'finance', 'Définir les frais et leurs échéances'),
  ('finance.assign',    'finance', 'Affecter un frais à une inscription, poser une remise'),
  ('finance.collect',   'finance', 'Encaisser un paiement et émettre le reçu'),
  ('finance.void',      'finance', 'Annuler un reçu ou une créance'),
  ('finance.report',    'finance', 'Consulter les rapports financiers')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and r.is_system
   and p.key = rp.permission_key and p.module = 'finance';

with attributions (role_code, permission_key) as (
  values
    ('OWNER', 'finance.read'),    ('OWNER', 'finance.configure'),
    ('OWNER', 'finance.assign'),  ('OWNER', 'finance.collect'),
    ('OWNER', 'finance.void'),    ('OWNER', 'finance.report'),

    ('SUPER_ADMIN', 'finance.read'),    ('SUPER_ADMIN', 'finance.configure'),
    ('SUPER_ADMIN', 'finance.assign'),  ('SUPER_ADMIN', 'finance.collect'),
    ('SUPER_ADMIN', 'finance.void'),    ('SUPER_ADMIN', 'finance.report'),

    ('ESTABLISHMENT_ADMIN', 'finance.read'),   ('ESTABLISHMENT_ADMIN', 'finance.configure'),
    ('ESTABLISHMENT_ADMIN', 'finance.assign'), ('ESTABLISHMENT_ADMIN', 'finance.collect'),
    ('ESTABLISHMENT_ADMIN', 'finance.void'),   ('ESTABLISHMENT_ADMIN', 'finance.report'),

    -- Le directeur suit les comptes et tranche les annulations, sans redéfinir
    -- la grille tarifaire de l'établissement.
    ('DIRECTOR', 'finance.read'),   ('DIRECTOR', 'finance.assign'),
    ('DIRECTOR', 'finance.void'),   ('DIRECTOR', 'finance.report'),

    -- Le comptable tient la caisse : il affecte, il encaisse, il rend compte.
    -- Il n'annule PAS ses propres reçus — c'est tout le sens de la séparation.
    ('ACCOUNTANT', 'finance.read'),   ('ACCOUNTANT', 'finance.configure'),
    ('ACCOUNTANT', 'finance.assign'), ('ACCOUNTANT', 'finance.collect'),
    ('ACCOUNTANT', 'finance.report'),

    -- Le personnel administratif encaisse au comptoir. Ni annulation, ni
    -- rapports : recevoir un paiement n'est pas tenir la comptabilité.
    ('STAFF', 'finance.read'), ('STAFF', 'finance.collect')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
