'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Coins, Plus, Trash2, UsersRound, X } from 'lucide-react';
import {
  affecterFraisAction,
  ajouterEcheanceAction,
  creerFraisAction,
  definirDeviseAction,
  supprimerEcheanceAction,
} from '@/services/finances.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { Classe, Level } from '@/lib/types/database';
import type { FraisDetaille } from '@/services/finances';
import { formaterMontant } from '@/lib/argent';
import { Bouton } from '@/components/ui/bouton';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({
  libelle,
  enCours,
  variante = 'primaire',
  taille,
}: {
  libelle: string;
  enCours: string;
  variante?: 'primaire' | 'secondaire';
  taille?: 'normale' | 'petite';
}) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variante={variante} taille={taille} disabled={pending}>
      {pending ? enCours : libelle}
    </Bouton>
  );
}

const TYPES_FRAIS: { valeur: string; libelle: string }[] = [
  { valeur: 'REGISTRATION', libelle: 'Inscription' },
  { valeur: 'TUITION', libelle: 'Scolarité' },
  { valeur: 'FILE', libelle: 'Dossier' },
  { valeur: 'TRANSPORT', libelle: 'Transport' },
  { valeur: 'EXAM', libelle: 'Examen' },
  { valeur: 'SUPPLIES', libelle: 'Fournitures' },
  { valeur: 'OTHER', libelle: 'Autre' },
];

/**
 * Devise de fonctionnement.
 *
 * La changer ne convertit rien : les montants déjà enregistrés gardent la leur.
 * Une conversion rétroactive dans une comptabilité serait une falsification.
 */
export function ReglageDevise({ devise }: { devise: string }) {
  const [etat, action] = useActionState(definirDeviseAction, ETAT_INITIAL);

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte className="flex items-center gap-2">
          <Coins className="size-4" aria-hidden="true" />
          Devise de l&apos;établissement
        </TitreCarte>
        <SousTitreCarte>
          Aucune conversion automatique. En changer n&apos;affecte pas les montants déjà
          enregistrés : ils gardent la devise dans laquelle ils ont été saisis.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="flex flex-wrap items-end gap-3">
          {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
          {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

          <Champ label="Code ISO" htmlFor="devise">
            <Saisie
              id="devise"
              name="devise"
              defaultValue={devise}
              maxLength={3}
              className="w-24 uppercase"
              autoComplete="off"
            />
          </Champ>
          <BoutonEnvoi libelle="Enregistrer" enCours="…" variante="secondaire" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function FormulaireFrais({
  anneeId,
  anneeNom,
  devise,
  niveaux,
}: {
  anneeId: string;
  anneeNom: string;
  devise: string;
  niveaux: Level[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(creerFraisAction, ETAT_INITIAL);
  const champs = etat.statut === 'erreur' ? (etat.champs ?? {}) : {};

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton onClick={() => setOuvert(true)} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" />
          Nouveau frais
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <TitreCarte>Nouveau frais · {anneeNom}</TitreCarte>
          <SousTitreCarte>
            Montant en {devise}. Un frais peut ensuite se découper en échéances.
          </SousTitreCarte>
        </div>
        <Bouton variante="discret" taille="petite" onClick={() => setOuvert(false)}>
          <X className="size-4" aria-hidden="true" />
          Annuler
        </Bouton>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="anneeId" value={anneeId} />
          {etat.statut === 'erreur' && !etat.champs ? (
            <Alerte ton="danger">{etat.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Nom" htmlFor="nom" erreur={champs['nom']} obligatoire>
              <Saisie id="nom" name="nom" required placeholder="Scolarité annuelle" autoComplete="off" />
            </Champ>
            <Champ label="Code" htmlFor="code" erreur={champs['code']} obligatoire>
              <Saisie id="code" name="code" required placeholder="SCOL" autoComplete="off" />
            </Champ>

            <Champ label={`Montant (${devise})`} htmlFor="montant" erreur={champs['montant']} obligatoire>
              <Saisie
                id="montant"
                name="montant"
                inputMode="decimal"
                required
                erreur={Boolean(champs['montant'])}
                autoComplete="off"
              />
            </Champ>
            <Champ label="Type" htmlFor="type" erreur={champs['type']} obligatoire>
              <Liste id="type" name="type" required defaultValue="TUITION">
                {TYPES_FRAIS.map((type) => (
                  <option key={type.valeur} value={type.valeur}>
                    {type.libelle}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ
              label="Libellé propre"
              htmlFor="typeLibelle"
              erreur={champs['typeLibelle']}
              aide="Le vocabulaire d'un établissement n'est pas celui d'un autre."
            >
              <Saisie id="typeLibelle" name="typeLibelle" autoComplete="off" />
            </Champ>
            <Champ label="Niveau concerné" htmlFor="niveauId" erreur={champs['niveauId']}>
              <Liste id="niveauId" name="niveauId" defaultValue="">
                <option value="">Tous les niveaux</option>
                {niveaux.map((niveau) => (
                  <option key={niveau.id} value={niveau.id}>
                    {niveau.name}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>

          <label className="flex items-center gap-2 text-sm text-encre">
            <input type="checkbox" name="recurrent" className="size-4 rounded border-bordure" />
            Frais récurrent
          </label>

          <BoutonEnvoi libelle="Créer le frais" enCours="Création…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

export function CarteFrais({
  frais,
  classes,
  peutConfigurer,
  peutAffecter,
}: {
  frais: FraisDetaille;
  classes: Pick<Classe, 'id' | 'name'>[];
  peutConfigurer: boolean;
  peutAffecter: boolean;
}) {
  const [etatAjout, actionAjout] = useActionState(ajouterEcheanceAction, ETAT_INITIAL);
  const [etatRetrait, actionRetrait] = useActionState(supprimerEcheanceAction, ETAT_INITIAL);
  const [etatAffectation, actionAffectation] = useActionState(affecterFraisAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  const type = TYPES_FRAIS.find((t) => t.valeur === frais.kind)?.libelle ?? 'Autre';

  return (
    <Carte>
      <EnTeteCarte className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TitreCarte className="flex flex-wrap items-center gap-2">
            {frais.name}
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
              {frais.code}
            </span>
          </TitreCarte>
          <SousTitreCarte>
            {[
              formaterMontant(frais.amount_minor, frais.currency),
              frais.kind_label || type,
              frais.niveau?.name,
              frais.is_recurring ? 'récurrent' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </SousTitreCarte>
        </div>
        {frais.echeances.length > 0 ? (
          frais.ecart === 0 ? (
            <Etiquette ton="succes">Échéancier complet</Etiquette>
          ) : (
            <Etiquette ton="danger">
              Écart de {formaterMontant(frais.ecart, frais.currency)}
            </Etiquette>
          )
        ) : (
          <Etiquette>Payable en une fois</Etiquette>
        )}
      </EnTeteCarte>

      <CorpsCarte className="space-y-4">
        {frais.echeances.length > 0 && frais.ecart !== 0 ? (
          <Alerte ton="danger" titre="Échéancier incohérent">
            Les échéances totalisent{' '}
            {formaterMontant(frais.amount_minor + frais.ecart, frais.currency)} au lieu de{' '}
            {formaterMontant(frais.amount_minor, frais.currency)}. L&apos;affectation sera refusée
            tant que l&apos;écart subsiste.
          </Alerte>
        ) : null}

        {frais.echeances.length > 0 ? (
          <ul className="space-y-1.5">
            {frais.echeances.map((echeance) => (
              <li
                key={echeance.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-douce border border-bordure px-3 py-2 text-sm"
              >
                <span className="font-medium text-encre">{echeance.label}</span>
                <span className="tabular-nums text-encre-douce">
                  {echeance.due_on} · {formaterMontant(echeance.share_minor, frais.currency)}
                </span>
                {peutConfigurer ? (
                  <form action={actionRetrait}>
                    <input type="hidden" name="echeanceId" value={echeance.id} />
                    <Bouton
                      variante="discret"
                      taille="petite"
                      type="submit"
                      aria-label={`Retirer ${echeance.label}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Bouton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {etatRetrait.statut === 'erreur' ? (
          <Alerte ton="danger">{etatRetrait.message}</Alerte>
        ) : null}

        {peutConfigurer ? (
          ouvert ? (
            <form action={actionAjout} className="space-y-3 border-t border-bordure pt-4" noValidate>
              <input type="hidden" name="fraisId" value={frais.id} />
              <input type="hidden" name="devise" value={frais.currency} />
              {etatAjout.statut === 'erreur' ? (
                <Alerte ton="danger">{etatAjout.message}</Alerte>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Champ label="Libellé" htmlFor={`libelle-${frais.id}`} obligatoire>
                  <Saisie id={`libelle-${frais.id}`} name="libelle" required autoComplete="off" />
                </Champ>
                <Champ label="Exigible le" htmlFor={`date-${frais.id}`} obligatoire>
                  <Saisie id={`date-${frais.id}`} name="date" type="date" required />
                </Champ>
                <Champ label={`Part (${frais.currency})`} htmlFor={`part-${frais.id}`} obligatoire>
                  <Saisie
                    id={`part-${frais.id}`}
                    name="montant"
                    inputMode="decimal"
                    required
                    autoComplete="off"
                  />
                </Champ>
              </div>

              <div className="flex gap-2">
                <BoutonEnvoi libelle="Ajouter l'échéance" enCours="Ajout…" taille="petite" />
                <Bouton variante="discret" taille="petite" type="button" onClick={() => setOuvert(false)}>
                  Annuler
                </Bouton>
              </div>
            </form>
          ) : (
            <Bouton variante="secondaire" taille="petite" onClick={() => setOuvert(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Ajouter une échéance
            </Bouton>
          )
        ) : null}

        {peutAffecter && classes.length > 0 ? (
          <form action={actionAffectation} className="space-y-3 border-t border-bordure pt-4">
            <input type="hidden" name="fraisId" value={frais.id} />
            {etatAffectation.statut === 'erreur' ? (
              <Alerte ton="danger">{etatAffectation.message}</Alerte>
            ) : null}
            {etatAffectation.statut === 'succes' ? (
              <Alerte ton="succes">{etatAffectation.message}</Alerte>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <Champ label="Affecter à la classe" htmlFor={`classe-${frais.id}`}>
                <Liste id={`classe-${frais.id}`} name="classeId" defaultValue="">
                  <option value="" disabled>
                    Sélectionnez
                  </option>
                  {classes.map((classe) => (
                    <option key={classe.id} value={classe.id}>
                      {classe.name}
                    </option>
                  ))}
                </Liste>
              </Champ>
              <BoutonEnvoi libelle="Affecter" enCours="Affectation…" variante="secondaire" />
            </div>
            <p className="text-xs text-encre-douce">
              Crée une créance par apprenant inscrit — et par échéance s&apos;il y en a. Un frais
              déjà affecté ne se duplique pas.
            </p>
          </form>
        ) : null}
      </CorpsCarte>
    </Carte>
  );
}

/** Choix de la classe dont on regarde les soldes. */
export function SelecteurClasseSoldes({
  classes,
  classeActive,
}: {
  classes: Pick<Classe, 'id' | 'name'>[];
  classeActive: string;
}) {
  const router = useRouter();

  return (
    <Champ label="Soldes de la classe" htmlFor="classeSoldes">
      <Liste
        id="classeSoldes"
        value={classeActive}
        onChange={(evenement) =>
          router.push(
            evenement.target.value ? `/finances?classe=${evenement.target.value}` : '/finances',
          )
        }
      >
        <option value="">Sélectionnez une classe</option>
        {classes.map((classe) => (
          <option key={classe.id} value={classe.id}>
            {classe.name}
          </option>
        ))}
      </Liste>
    </Champ>
  );
}

export function EnTeteSoldes() {
  return (
    <p className="flex items-center gap-2 text-sm text-encre-douce">
      <UsersRound className="size-4" aria-hidden="true" />
      Le solde de chaque apprenant se déduit de ses paiements.
    </p>
  );
}
