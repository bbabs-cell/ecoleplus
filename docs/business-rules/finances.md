# Finances — spécification (phase 4)

> Repris et adapté d'une conception antérieure du même projet.

## 1. Chaîne de facturation

```
fee_structures → échéances → obligations (par inscription) → payments → receipts
```

- **`fee_structures`** — frais : nom, type (inscription, scolarité, dossier,
  transport, libre), montant, devise, année, ponctuel ou récurrent.
- **échéances** — un frais peut se payer en plusieurs fois : libellé, date
  d'exigibilité, part du montant.
- **obligations** — la créance d'une inscription : montant, remise, ajustement,
  total, montant réglé, statut (`UNPAID|PARTIAL|PAID|CANCELLED`).
- **`payments`** — encaissement : montant, méthode, référence, date, `received_by`.
- **`receipts`** — reçu à numéro unique.

Les montants sont stockés en **unité mineure entière** (centimes, francs CFA).
Aucun calcul d'argent en virgule flottante.

## 2. Règles non négociables

**Un reçu ne se supprime jamais.** Il s'annule : `voided_at`, `voided_by`,
`void_reason`, et la trace reste. Un reçu supprimé est une comptabilité falsifiée.

**Le paiement partiel est prévu dès le départ**, pas ajouté après coup : c'est le
cas courant, pas l'exception. Le solde se déduit des paiements, il ne se saisit pas.

**Aucune confirmation automatique sans preuve réelle** (@docs/architecture.md).
Un paiement se constate, il ne se présume pas.

**La devise est celle de l'établissement.** Pas de conversion automatique : une
conversion non contrôlée dans une comptabilité est une erreur, pas une commodité.
Le multidevise viendra avec des taux explicites et datés, ou ne viendra pas.

## 3. Permissions distinctes

Enregistrer un paiement, annuler un reçu et consulter les rapports financiers
sont trois droits séparés. L'agent de caisse encaisse sans pouvoir annuler.

## 4. Scénarios de test

Paiement partiel puis solde · paiement excédentaire refusé · annulation de reçu
sans permission refusée et tracée · numéro de reçu unique sous accès concurrent ·
reçu d'un autre établissement inaccessible · montants en unité mineure sans perte
d'arrondi.
