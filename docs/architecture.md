# Architecture EcolePlus

## Hiérarchie SaaS

```
Plateforme EcolePlus
├── Organisation cliente (établissement indépendant, groupe, réseau, université, centre de formation…)
│   └── Établissement(s)
│       ├── Campus
│       ├── Années académiques / semestres / trimestres (configurable)
│       ├── Niveaux, classes, groupes
│       ├── Enseignants
│       └── Apprenants (élève, étudiant, stagiaire, participant)
└── Super Administration EcolePlus
```

Un utilisateur multi-établissement a un **contexte d'établissement actif**, changé côté serveur uniquement.

## Rôles (extensibles sans réécriture — RBAC + permissions granulaires)

Super Admin EcolePlus (plateforme, pas d'accès client illimité non tracé) · Propriétaire d'organisation · Administrateur d'établissement · Directeur/responsable · Enseignant · Comptable/financier · Personnel administratif · Parent/tuteur · Apprenant.

Détail des permissions par rôle : voir cahier des charges original section 7 si besoin de granularité fine — à modéliser en tables `roles` / `permissions` / `role_permissions`, pas en checks hardcodés dans le code.

## Modèle de données (indicatif, à affiner après inspection réelle des besoins)

`organizations`, `organization_settings`, `campuses`, `academic_years`, `academic_terms`, `users`, `organization_members`, `roles`, `permissions`, `role_permissions`, `user_roles`, `learners`, `guardians`, `learner_guardians`, `enrollments`, `levels`, `classes`, `groups`, `class_members`, `teachers`, `subjects`, `teaching_assignments`, `attendance_sessions`, `attendance_records`, `grading_systems`, `grading_scales`, `grading_categories`, `assessments`, `assessment_results`, `report_cards`, `report_card_publications`, `fee_structures`, `invoices`, `payments`, `payment_allocations`, `receipts`, `files`, `notifications`, `audit_logs`, `subscriptions`, `subscription_plans`, `usage_limits`.

Chaque table : identifiants robustes, clés étrangères explicites, index adaptés, timestamps, `organization_id`/`establishment_id` selon contexte, contraintes anti-doublon. JSONB seulement si réelle valeur ajoutée + validation.

## Modules MVP (ordre de priorité — voir @docs/roadmap.md)

1. Inscription & dossier apprenant (statuts : préinscrit, inscrit, actif, suspendu, transféré, diplômé, abandonné, archivé)
2. Classes, groupes, enseignants, matières, années académiques
3. Présences (présent/absent/retard/excusé configurable, verrouillage après validation)
4. Notes & bulletins — barèmes multiples (numérique /10 /20 /100, alphabétique, appréciations, coefficients, formules configurables), architecture prête pour extensions universitaires (UE, crédits, semestres, compensation) sans les développer au MVP
5. Paiements manuels & reçus (frais, échéances, soldes, reçu unique, jamais de confirmation auto sans preuve réelle)
6. Tableau de bord filtré par rôle/contexte actif

## Modules futurs (préparer l'architecture, ne pas développer prématurément)

Portails parents/élèves, communication/notifications (SMS/WhatsApp), emploi du temps, transport, bibliothèque, RH/salaires/congés, certificats, gestion universitaire avancée, paiements en ligne, facturation SaaS/abonnements, reporting avancé, mobile/PWA, API publique.

## Internationalisation

Langues prioritaires : FR, EN, AR (RTL), ES. Traduction centralisée, dates/nombres/devises localisés, fuseau horaire configurable, aucun système de notation/calendrier/format supposé universel.

## Sécurité

- RLS sur toute table exposée : appartenance organisation, accès établissement, rôle/permission — jamais confiance au frontend.
- Journalisation (`audit_logs`) de toute opération sensible.
- Fichiers R2 : validation type/taille/MIME, clé de stockage imprévisible, URL signée, jamais d'accès par simple connaissance de l'URL.
- Tests de sécurité à couvrir régulièrement : isolation cross-org, accès établissement non autorisé, modification note/paiement sans permission, contournement API, escalade de privilèges, accès fichier privé, compte désactivé.

## Stack fichiers/déploiement

Cloudflare R2 privé par défaut + métadonnées PostgreSQL. Vercel avec env dev/preview/prod, pas de fichiers persistants sur le filesystem serverless.
