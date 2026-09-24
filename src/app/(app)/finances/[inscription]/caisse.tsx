'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Ban, Banknote, PenLine, Receipt as RecuIcone } from 'lucide-react';
import {
  ajusterCreanceAction,
  annulerCreanceAction,
  encaisserPaiementAction,
} from '@/services/finances.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { CreanceDetaillee } from '@/services/finances';
import { formaterMontant, versChampSaisie } from '@/lib/argent';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Saisie } from '@/components/ui/champ';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? enCours : libelle}
    </Bouton>
  );
}

const MOYENS = ['Espèces', 'Virement', 'Chèque', 'Mobile money', 'Carte'];

/**
 * Encaissement au comptoir.
 *
 * Le paiement partiel est le cas courant, pas l'exception : le montant proposé
 * est le solde, mais rien n'oblige à le régler d'un coup. Sans répartition
 * explicite, l'encaissement solde les échéances les plus anciennes d'abord.
 *
 * Aucun calcul de monnaie ici : le montant saisi part en unité mineure entière
 * et c'est PostgreSQL qui refuse le trop-perçu.
 */
export function Caisse({
  inscriptionId,
  creances,
  devise,
  solde,
  dateDuJour,
  peutRepartir,
}: {
  inscriptionId: string;
  creances: CreanceDetaillee[];
  devise: string;
  solde: number;
  dateDuJour: string;
  peutRepartir: boolean;
}) {
  const [etat, action] = useActionState(encaisserPaiementAction, ETAT_INITIAL);
  const [repartition, setRepartition] = useState(false);

  const ouvertes = useMemo(
    () =>
      creances.filter(
        (creance) => creance.cancelled_at === null && (creance.total_minor ?? 0) > creance.paid_minor,
      ),
    [creances],
  );

  const recuEmis = etat.statut === 'succes' ? etat.donnees?.['recuId'] : undefined;

  if (solde <= 0) {
    return (
      <>
        {etat.statut === 'succes' ? (
          <Alerte ton="succes" titre={etat.message}>
            {recuEmis ? (
              <Link href={`/recus/${recuEmis}`} className="font-medium text-primaire">
                Ouvrir le reçu
              </Link>
            ) : null}
          </Alerte>
        ) : (
          <Alerte ton="succes" titre="Rien à encaisser">
            Toutes les créances de cet apprenant sont soldées.
          </Alerte>
        )}
      </>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte className="flex items-center gap-2">
          <Banknote className="size-4" aria-hidden="true" />
          Encaisser un paiement
        </TitreCarte>
        <SousTitreCarte>
          Solde dû : <strong className="text-encre">{formaterMontant(solde, devise)}</strong>. Un
          paiement partiel est parfaitement admis — le reste reste dû.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <input type="hidden" name="devise" value={devise} />

          {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
          {etat.statut === 'succes' ? (
            <Alerte ton="succes" titre={etat.message}>
              {recuEmis ? (
                <Link href={`/recus/${recuEmis}`} className="font-medium text-primaire">
                  Ouvrir le reçu
                </Link>
              ) : null}
            </Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ
              label={`Montant (${devise})`}
              htmlFor="montant"
              erreur={etat.statut === 'erreur' ? etat.champs?.['montant'] : undefined}
              obligatoire
            >
              <Saisie
                id="montant"
                name="montant"
                inputMode="decimal"
                required
                defaultValue={versChampSaisie(solde, devise)}
                className="min-h-11 text-lg tabular-nums"
                autoComplete="off"
              />
            </Champ>

            <Champ label="Moyen de paiement" htmlFor="methode" obligatoire>
              <Saisie
                id="methode"
                name="methode"
                required
                list="moyens-paiement"
                placeholder="Espèces"
                className="min-h-11"
                autoComplete="off"
              />
              <datalist id="moyens-paiement">
                {MOYENS.map((moyen) => (
                  <option key={moyen} value={moyen} />
                ))}
              </datalist>
            </Champ>

            <Champ label="Date" htmlFor="date" obligatoire>
              <Saisie
                id="date"
                name="date"
                type="date"
                required
                defaultValue={dateDuJour}
                className="min-h-11"
              />
            </Champ>

            <Champ
              label="Référence"
              htmlFor="reference"
              aide="Numéro de bordereau, de chèque, de transaction…"
            >
              <Saisie id="reference" name="reference" className="min-h-11" autoComplete="off" />
            </Champ>
          </div>

          {peutRepartir ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-encre">
                <input
                  type="checkbox"
                  checked={repartition}
                  onChange={(evenement) => setRepartition(evenement.target.checked)}
                  className="size-4 rounded border-bordure"
                />
                Répartir moi-même sur les échéances
              </label>

              {repartition ? (
                <div className="space-y-2 rounded-douce border border-bordure p-3">
                  <p className="text-xs text-encre-douce">
                    Laissez vide pour ne rien affecter. La somme des parts doit faire le montant
                    encaissé, et aucune part ne peut dépasser ce qui reste dû.
                  </p>
                  {ouvertes.map((creance) => {
                    const reste = (creance.total_minor ?? 0) - creance.paid_minor;
                    return (
                      <div
                        key={creance.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <label
                          htmlFor={`part-${creance.id}`}
                          className="min-w-0 flex-1 text-sm text-encre"
                        >
                          {creance.label}
                          <span className="ml-2 text-xs text-encre-douce">
                            reste {formaterMontant(reste, devise)}
                          </span>
                        </label>
                        <Saisie
                          id={`part-${creance.id}`}
                          name={`part:${creance.id}`}
                          inputMode="decimal"
                          placeholder="0"
                          className="min-h-11 w-32 tabular-nums"
                          autoComplete="off"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-encre-douce">
                  Sans répartition, le montant solde les échéances les plus anciennes d&apos;abord.
                </p>
              )}
            </div>
          ) : null}

          <Champ label="Observation" htmlFor="notes">
            <Saisie id="notes" name="notes" className="min-h-11" autoComplete="off" />
          </Champ>

          <BoutonEnvoi libelle="Enregistrer le paiement" enCours="Enregistrement…" />
        </form>
      </CorpsCarte>
    </Carte>
  );
}

/**
 * Remise, ajustement, annulation d'une créance.
 *
 * Chaque geste exige un motif, conservé au journal d'audit. Une créance déjà
 * réglée ne s'annule pas : il faut d'abord annuler les reçus qui l'ont soldée.
 */
export function AjusterCreance({
  inscriptionId,
  creances,
  devise,
  peutAnnuler,
}: {
  inscriptionId: string;
  creances: CreanceDetaillee[];
  devise: string;
  peutAnnuler: boolean;
}) {
  const [etatAjust, actionAjust] = useActionState(ajusterCreanceAction, ETAT_INITIAL);
  const [etatAnnul, actionAnnul] = useActionState(annulerCreanceAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  const vivantes = creances.filter((creance) => creance.cancelled_at === null);
  if (vivantes.length === 0) return null;

  const succes =
    etatAjust.statut === 'succes'
      ? etatAjust.message
      : etatAnnul.statut === 'succes'
        ? etatAnnul.message
        : null;

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {succes ? <Alerte ton="succes">{succes}</Alerte> : null}
        <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
          <PenLine className="size-4" aria-hidden="true" />
          Remise, ajustement ou annulation
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Remise, ajustement ou annulation</TitreCarte>
        <SousTitreCarte>
          Chaque geste exige un motif, conservé au journal d&apos;audit.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte className="space-y-6">
        <form action={actionAjust} className="space-y-4" noValidate>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <input type="hidden" name="devise" value={devise} />
          {etatAjust.statut === 'erreur' ? (
            <Alerte ton="danger">{etatAjust.message}</Alerte>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Créance" htmlFor="creanceId" obligatoire>
              <select
                id="creanceId"
                name="creanceId"
                required
                defaultValue=""
                className="w-full rounded-douce border border-bordure bg-carte px-3 py-2 text-sm text-encre"
              >
                <option value="" disabled>
                  Sélectionnez
                </option>
                {vivantes.map((creance) => (
                  <option key={creance.id} value={creance.id}>
                    {creance.label} — {formaterMontant(creance.total_minor, devise)}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label={`Remise (${devise})`} htmlFor="remise" aide="Réduit le montant dû.">
              <Saisie id="remise" name="remise" inputMode="decimal" placeholder="0" />
            </Champ>
            <Champ
              label={`Ajustement (${devise})`}
              htmlFor="ajustement"
              aide="Majoration de retard, correction."
            >
              <Saisie id="ajustement" name="ajustement" inputMode="decimal" placeholder="0" />
            </Champ>
          </div>

          <Champ label="Motif" htmlFor="raison" obligatoire>
            <Saisie id="raison" name="raison" required placeholder="Bourse partielle accordée" />
          </Champ>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Enregistrer l'ajustement" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setOuvert(false)}>
              Fermer
            </Bouton>
          </div>
        </form>

        {peutAnnuler ? (
          <div className="border-t border-bordure pt-6">
            <form action={actionAnnul} className="space-y-4" noValidate>
              <input type="hidden" name="inscriptionId" value={inscriptionId} />
              {etatAnnul.statut === 'erreur' ? (
                <Alerte ton="danger">{etatAnnul.message}</Alerte>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Champ label="Annuler la créance" htmlFor="creanceIdAnnul" obligatoire>
                  <select
                    id="creanceIdAnnul"
                    name="creanceId"
                    required
                    defaultValue=""
                    className="w-full rounded-douce border border-bordure bg-carte px-3 py-2 text-sm text-encre"
                  >
                    <option value="" disabled>
                      Sélectionnez
                    </option>
                    {vivantes
                      .filter((creance) => creance.paid_minor === 0)
                      .map((creance) => (
                        <option key={creance.id} value={creance.id}>
                          {creance.label}
                        </option>
                      ))}
                  </select>
                </Champ>
                <Champ
                  label="Motif"
                  htmlFor="raisonAnnul"
                  aide="Seules les créances sans règlement peuvent être annulées."
                  obligatoire
                >
                  <Saisie id="raisonAnnul" name="raison" required placeholder="Frais non applicable" />
                </Champ>
              </div>

              <Bouton variante="danger" type="submit">
                <Ban className="size-4" aria-hidden="true" />
                Annuler la créance
              </Bouton>
            </form>
          </div>
        ) : null}
      </CorpsCarte>
    </Carte>
  );
}

export function LienRecu({ recuId, numero, annule }: { recuId: string; numero: string; annule: boolean }) {
  return (
    <Link
      href={`/recus/${recuId}`}
      className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primaire hover:underline"
    >
      <RecuIcone className="size-3.5" aria-hidden="true" />
      {numero}
      {annule ? <span className="font-sans text-danger">(annulé)</span> : null}
    </Link>
  );
}
