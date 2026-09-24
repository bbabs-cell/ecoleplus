# Reprise d'une conception antérieure

Une première version du projet existait, conduite avec une autre stack
(Angular + Laravel 12 + MySQL + Spatie + Sanctum, déploiement Railway). Ce
document dit ce qui en a été repris, ce qui ne pouvait pas l'être, et ce que sa
lecture révèle comme manques dans la version actuelle.

## Ce qui n'était pas reprenable

**Aucune ligne de code.** Le modèle de sécurité y reposait sur les *policies*
Laravel, c'est-à-dire sur du code applicatif : l'autorisation vivait dans le
serveur PHP. Ici elle vit dans PostgreSQL, en RLS, et le serveur n'est qu'une
seconde barrière. Transposer les policies aurait produit l'inverse de ce que
@CLAUDE.md demande — une vérification uniquement applicative.

Angular, Eloquent, Spatie, Sanctum : sans objet sur Next.js/Supabase.

## Ce qui a été repris

Les **règles métier**, qui elles ne dépendent d'aucune technologie, et qui
représentaient l'essentiel de la valeur accumulée :

- @docs/business-rules/moteur-notation.md — la spécification complète du moteur
  de notation, y compris les neuf états distincts d'une note et les trois
  politiques de note manquante.
- @docs/business-rules/presences.md — statuts de présence configurables,
  verrouillage après validation, corrections tracées.
- @docs/business-rules/finances.md — chaîne frais → obligation → paiement →
  reçu, reçu jamais supprimé, paiement partiel de série.

Et quelques décisions structurantes, déjà appliquées ou désormais actées :

| Décision | État ici |
|---|---|
| Table `learners`, pas `students` — couvre élève, étudiant, stagiaire | déjà fait (phase 2) |
| Un établissement indépendant = organisation à un seul établissement | déjà fait |
| Le rang au bulletin est optionnel et configurable | à appliquer en phase 3 |
| Une note publiée ne se modifie que par procédure tracée | à appliquer en phase 3 |
| Un reçu s'annule, ne se supprime pas | déjà fait (phase 4) |
| Devise de fonctionnement par établissement, sans conversion automatique | déjà fait (phase 4) |

Une piste retenue pour la phase 5 : l'internationalisation y était faite sans
bibliothèque, la **clé de traduction étant la chaîne française exacte**, avec
repli sur la clé. L'interface reste donc lisible même quand une traduction
manque — propriété que peu de solutions offrent. **Reprise telle quelle en
phase 5** : `src/i18n/dictionnaires.ts` n'a pas de dictionnaire `fr`, puisque
la clé EST le français.

## Manques que cette lecture révèle dans la version actuelle

À trancher avant ou pendant la phase 3 :

1. **Responsables légaux** (`guardians`, `guardian_learner`). Absents ici, la
   feuille de route ne les plaçant pas en phase 2. La conception antérieure les
   y mettait. Un dossier apprenant sans contact parent est incomplet en pratique.
2. **Parcours et filières** (`programs`, `program_subjects`). C'est là que
   vivaient les coefficients par matière. Sans eux, les coefficients devront se
   poser ailleurs en phase 3.
3. **Pondération des périodes** (`academic_terms.weight`). Un trimestre peut
   peser plus qu'un autre dans la moyenne annuelle. La colonne manque.
4. **Chaînage des inscriptions** (`parent_enrollment_id`). Une réinscription ou
   un transfert pointerait vers l'inscription qu'il prolonge. Aujourd'hui le lien
   est implicite — déduit de l'apprenant et des dates.
5. **Numéro d'inscription** distinct du matricule apprenant, unique par
   établissement et par année.
6. **Historique des changements de classe en cours d'année.** La classe est ici
   une colonne de l'inscription : le changement est tracé dans `audit_logs`, mais
   il n'existe pas de table d'affectations successives. Suffisant pour consulter
   l'historique, insuffisant pour dire « dans quelle classe était-il le 12 mars ».
   À reconsidérer si les présences ou les bulletins doivent être rattachés à la
   classe du moment.
7. **Réglages par établissement en clé/valeur.** Les réglages actuels sont des
   colonnes fixes au niveau organisation. La phase 3 en ajoutera plusieurs (rang
   activé, politique de note manquante par défaut) qui gagneraient à être
   surchargeables par établissement.

## Scénarios de sécurité : couverture actuelle

La conception antérieure listait douze scénarios obligatoires. Sept sont déjà
couverts par @supabase/tests, cinq relèvent de phases non construites.

| # | Scénario | État |
|---|---|---|
| 1 | Accès à une autre organisation | couvert |
| 2 | Accès à un établissement non autorisé | couvert |
| 3 | Modification d'une note sans permission | phase 3 |
| 4 | Modification d'une note publiée hors procédure | phase 3 |
| 5 | Annulation de reçu sans permission | phase 4 |
| 6 | Accès avec compte désactivé | couvert (révocation de session) |
| 7 | Téléchargement d'un document non autorisé | phase 5 |
| 8 | Contournement par charge utile ajoutée | couvert (clés composites) |
| 9 | Admin d'établissement sur un autre établissement | couvert |
| 10 | Barème modifié après publication | phase 3 |
| 11 | Manipulation d'identifiant dans l'URL | couvert |
| 12 | Escalade de privilèges | couvert |

## Avertissement de sécurité

L'archive fournie contenait un fichier `backend/.env` avec 45 clés renseignées,
dont `APP_KEY`, les identifiants de base de données, `MAIL_PASSWORD` et
`REDIS_PASSWORD`. Aucune valeur n'a été lue, copiée ni introduite dans ce dépôt.

**Ces identifiants sont à considérer comme exposés** et à révoquer si l'archive a
circulé ou a été versionnée.

## Mise à jour — fin de la phase 3

Trois des sept manques relevés plus haut sont désormais comblés, et les cinq
scénarios de sécurité qui relevaient de phases non construites sont passés à
trois.

| # | Manque | État |
|---|---|---|
| 2 | Coefficients par matière | comblé : `class_subjects` (phase 3b) |
| 3 | Pondération des périodes | comblé : `academic_terms.weight` (phase 3a) |
| 7 | Réglages par établissement | comblé : `establishment_settings` (phase 3b) |
| 1 | Responsables légaux | à trancher |
| 4 | Chaînage des inscriptions | à trancher |
| 5 | Numéro d'inscription | à trancher |
| 6 | Historique des changements de classe | à trancher |

| # | Scénario | État |
|---|---|---|
| 3 | Modification d'une note sans permission | couvert (`securite_notation`) |
| 4 | Modification d'une note publiée hors procédure | couvert (`securite_notation`) |
| 10 | Barème modifié après publication | couvert (`securite_notation`) |
| 5 | Annulation de reçu sans permission | phase 4 |
| 7 | Téléchargement d'un document non autorisé | phase 5 |

Le manque n° 2 a été comblé sans attendre les parcours : `class_subjects`
rattache le coefficient à la classe. Quand `programs` arrivera, la table se
laissera surcharger sans migration destructrice.

## Mise à jour — fin de la phase 4

Le scénario n° 5 est couvert à son tour : quatre scénarios sur douze relevaient
de phases non construites, il n'en reste qu'un.

| # | Scénario | État |
|---|---|---|
| 5 | Annulation de reçu sans permission | couvert (`securite_finances`) |
| 7 | Téléchargement d'un document non autorisé | phase 5 |

La devise de fonctionnement passe par `establishment_settings`, la table
clé/valeur posée en phase 3b : le manque n° 7 avait déjà ouvert la voie.

Deux garanties de la phase 4 méritent d'être notées, parce qu'aucune n'est
vérifiable par une suite `.sql` ordinaire :

- **Unicité du numéro de reçu sous accès concurrent.** Une suite qui
  s'exécute en une transaction ne peut pas se concurrencer elle-même. Le
  harnais `supabase/tests/concurrence_recus.sh` ouvre donc N connexions qui
  encaissent au même instant, sur une base jetable qu'il crée et supprime.
  Avec une numérotation naïve (`max + 1`), 3 reçus sur 12 seulement
  aboutissent — les neuf autres tombent sur l'index d'unicité.
- **Conversion des montants.** `src/lib/argent.ts` est le seul endroit où
  l'argent change de forme, et `npm test` l'éprouve : conversions exactes,
  refus d'une saisie plus précise que la devise, et aller-retour sans dérive
  sur des dizaines de milliers de montants.

## Mise à jour — fin de la phase 5

Le scénario n° 7 est couvert. **Les douze scénarios de sécurité de la
conception antérieure le sont désormais tous.**

| # | Scénario | État |
|---|---|---|
| 7 | Téléchargement d'un document non autorisé | couvert (`securite_fichiers`) |

Trois barrières le ferment, dans cet ordre : la RLS rend le fichier invisible,
`fichier_telechargeable` refuse de livrer sa clé, et l'URL signée ne vaut
qu'une minute. Le message d'erreur ne distingue jamais « inexistant » de
« interdit » — confirmer qu'un document existe ailleurs est déjà une fuite.

Une décision à noter : **la signature SigV4 est écrite à la main**, plutôt que
tirée du SDK AWS. L'algorithme est entièrement spécifié, il tient en une
centaine de lignes, et AWS publie un vecteur de test qui permet de prouver
l'implémentation exacte — ce que `src/lib/__tests__/signature.test.ts` fait.
Réimplémenter de la cryptographie ne se justifie que si l'on peut démontrer
qu'on l'a réimplémentée juste.

Reste en suspens, hors des scénarios : le dépôt réel dans R2 n'a pas été
éprouvé de bout en bout, faute d'identification Cloudflare dans
l'environnement de développement. L'interface le dit plutôt que de le taire.
