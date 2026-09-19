# Présences — spécification (phase 3)

> Repris et adapté d'une conception antérieure du même projet.

## 1. Les statuts sont des données, pas une énumération

`attendance_statuses` est une table, par organisation et éventuellement par
établissement : `name`, `code`, `color`, `position`, et deux drapeaux qui portent
toute la logique de calcul :

- **`is_present`** — l'apprenant était-il là ? Un retard l'est, une absence
  justifiée ne l'est pas.
- **`counts_absent`** — l'événement alimente-t-il le décompte d'absences ? Une
  absence justifiée peut compter ou non selon l'établissement.

Présent, absent, retard, excusé, exclu, sortie anticipée : aucun de ces termes
n'a la même définition ni les mêmes conséquences d'un pays à l'autre. Les figer
dans un type PostgreSQL reviendrait à choisir pour le client (@CLAUDE.md, règle 2).

## 2. Tables

- **`attendance_sessions`** — la séance : classe, groupe, matière, enseignant,
  date, horaires, `kind` (séance, journée, atelier — texte libre).
- **`attendance_records`** — un enregistrement par apprenant et par séance :
  statut, commentaire, justificatif, `recorded_by`, `recorded_at`.
  **Unique (session, inscription)** : l'appel ne peut pas produire de doublon.
- **`attendance_corrections`** — `old_status_id`, `new_status_id`, `reason`,
  `changed_by`. Une correction ne remplace pas l'historique, elle s'y ajoute.

L'enregistrement pointe vers l'**inscription**, non vers l'apprenant : c'est elle
qui porte l'année, l'établissement et la classe.

## 3. Verrouillage

Une séance validée se ferme. La rouvrir exige une permission distincte de celle
qui permet de faire l'appel, et chaque modification postérieure passe par
`attendance_corrections` avec un motif.

Justification : l'appel est une pièce administrative, parfois opposable.

## 4. Interface

L'appel se fait **debout, en classe, sur téléphone**. C'est le seul écran de
l'application dont la version mobile est la version principale : grandes cibles
tactiles, un geste par apprenant, aucun défilement horizontal, fonctionnement sur
connexion instable.

## 5. Scénarios de test

Statuts personnalisés créés puis utilisés · double appel sur la même séance
refusé · correction après validation refusée sans permission, puis tracée avec
motif · décompte d'absences respectant `counts_absent` · enseignant limité à ses
propres classes · appel sur une classe d'un autre établissement refusé.
