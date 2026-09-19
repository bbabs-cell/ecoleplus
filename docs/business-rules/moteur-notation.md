# Moteur de notation — spécification (phase 3)

> Repris et adapté d'une conception antérieure du même projet (stack Laravel/Angular,
> abandonnée). Les concepts et les règles métier sont conservés ; les noms de tables
> suivent @docs/architecture.md, et les mécanismes suivent PostgreSQL/RLS.

Objectif : un moteur **configurable**, valable au Sénégal comme en France, en
contexte anglophone ou arabophone. Aucun système de notation n'est imposé, aucun
n'est considéré comme la référence par défaut.

## 1. Quatre familles de notation

| Type | Exemples |
|---|---|
| `NUMERIC` | sur 10, sur 20, sur 100, échelle libre |
| `LETTER` | A, B, C, D… adossées à des tranches |
| `MASTERY` | niveaux de maîtrise : acquis, en cours d'acquisition, non acquis |
| `CUSTOM` | appréciations, barèmes maison |

Plusieurs systèmes coexistent dans une même organisation et jusque dans un même
établissement : une classe peut être notée sur 20 pendant qu'une formation
professionnelle fonctionne par niveaux de maîtrise.

## 2. Tables

- **`grading_systems`** — `name`, `type`, `min_value`, `max_value`, `unit`,
  `pass_threshold`, `rounding_mode` (`ROUND|FLOOR|CEIL`), `decimals`, `status`,
  `valid_from`, `valid_until`, `version`.
- **`grading_scales`** — tranches d'un système : `label`, `min_score`,
  `max_score`, `position`, `color`. Exemple : A = 16→20, B = 13→15.99.
- **`grading_categories`** — catégories d'évaluation (contrôle continu, examen…)
  avec leur poids.
- **`assessments`** — évaluations : classe, matière, enseignant, catégorie,
  date, coefficient, système de notation, statut.
- **`assessment_results`** — la note : `raw_value` (saisie), `value`
  (normalisée), `status`, `comment`, `entered_by`. Unique par (évaluation, inscription).
- **`assessment_result_histories`** — `action`, `old_value`, `new_value`,
  `reason`, `changed_by`. Ne se purge jamais.

Le barème, les coefficients et les poids sont des **données**, jamais des
constantes du code.

## 3. Ce qu'une note peut être, et qu'il ne faut jamais confondre

C'est le cœur de la règle 4 de @CLAUDE.md. Neuf situations distinctes :

non saisie · saisie · validée · publiée · **absence** · **absence justifiée** ·
**dispense** · invalidée · **zéro réel**

> **Une note manquante n'est jamais convertie en zéro automatiquement.**

Le traitement se règle explicitement, par `missing_grade_policy` :

| Valeur | Effet sur la moyenne |
|---|---|
| `SKIP` | la note est ignorée, la moyenne porte sur les notes présentes |
| `ZERO` | comptée comme zéro — choix explicite, jamais implicite |
| `EXCLUDED` | l'évaluation ne concerne pas cet apprenant (dispense) |

Défaut proposé : `SKIP`. Réglable par évaluation.

Un zéro saisi est un **résultat**, pas une absence de résultat : les deux ne
doivent jamais produire le même affichage ni le même calcul.

## 4. Cycle de vie d'une note

```
draft → captured → verified → published → corrected | cancelled → archived
```

- La publication **fige**. Une note publiée ne se modifie pas silencieusement :
  permission dédiée + motif obligatoire + entrée d'historique.
- Toute transition est journalisée dans `assessment_result_histories` **et**
  dans `audit_logs`.

## 5. Calculs

- Moyenne d'évaluation : somme pondérée ÷ somme des coefficients.
- Moyenne de catégorie : appliquer le poids de la catégorie.
- Moyenne de matière, puis moyenne générale sur le barème de la classe.
- Lettres et niveaux de maîtrise : conversion par les tranches, sur valeur
  normalisée.
- Arrondi configurable (mode + décimales) appliqué au dernier moment.
- Conversion entre échelles : proportionnelle, sauf règle explicite contraire.

**Erreurs de configuration à détecter avant publication** : `min > max`,
tranches qui se chevauchent ou laissent un trou, seuil de réussite hors échelle.
La détection se fait à la prévisualisation, pas au moment du bulletin.

Le recalcul ne touche jamais un résultat publié : celui-ci vit dans le snapshot
du bulletin.

## 6. Bulletins

- Prévisualisation, vérification puis publication sont trois permissions
  distinctes.
- Publier crée un **snapshot JSON figé** dans `report_cards`. Republier crée une
  **nouvelle version** (`report_card_publications`), sans écraser la précédente.
- **Le rang est optionnel**, activé par paramètre d'établissement. Il n'est
  jamais imposé : de nombreux systèmes éducatifs le proscrivent.
- Langue, format de date et devise du bulletin suivent les réglages de
  l'établissement.

## 7. Prévu, non développé

Unités d'enseignement, crédits, semestres, sessions de rattrapage, compensation,
validation de diplôme, mentions. L'architecture les autorise — une table de
règles portant une `formula_key` et ses paramètres suffit à les accueillir — mais
rien de tout cela n'est construit avant d'être demandé.

## 8. Scénarios de test obligatoires

Barème sur 20, sur 100, lettres A–F, niveaux de maîtrise · coefficients matière
· poids de catégorie · les trois politiques de note manquante · arrondis
`ROUND|FLOOR|CEIL` et décimales · conversion d'échelle · tranches chevauchantes
refusées · modification d'une note publiée sans permission refusée et tracée ·
moyenne générale · rang activé puis désactivé.

Deux jeux d'exemple en développement : barème français sur 20 (admission ≥ 10)
et barème sénégalais, **sans traiter l'un des deux comme la norme**.
