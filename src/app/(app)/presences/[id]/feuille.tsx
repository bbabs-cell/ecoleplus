'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCheck, Lock, PenLine, Unlock } from 'lucide-react';
import {
  corrigerPresenceAction,
  enregistrerAppelAction,
  rouvrirSeanceAction,
  validerSeanceAction,
} from '@/services/presences.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import type { AttendanceStatus, NameDisplayFormat } from '@/lib/types/database';
import type { LigneAppel } from '@/services/presences';
import { nomAffiche } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Liste, Saisie } from '@/components/ui/champ';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? enCours : libelle}
    </Bouton>
  );
}

/**
 * Feuille d'appel.
 *
 * Seul écran de l'application dont la version mobile est la version principale :
 * l'appel se fait debout, en classe, sur un téléphone. D'où les grandes cibles
 * tactiles, un geste par apprenant, et l'envoi de la feuille entière en une
 * seule requête — un aller-retour par élève serait intenable sur une connexion
 * médiocre.
 *
 * Le formulaire reste fonctionnel sans JavaScript : chaque statut est un
 * `<input type="radio">` classique.
 */
export function FeuilleDAppel({
  seanceId,
  lignes,
  statuts,
  format,
  close,
  peutSaisir,
}: {
  seanceId: string;
  lignes: LigneAppel[];
  statuts: AttendanceStatus[];
  format: NameDisplayFormat;
  close: boolean;
  peutSaisir: boolean;
}) {
  const [etat, action] = useActionState(enregistrerAppelAction, ETAT_INITIAL);
  const [choix, setChoix] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lignes.filter((l) => l.statutId).map((l) => [l.enrollmentId, l.statutId as string]),
    ),
  );

  const statutPresent = useMemo(
    () => statuts.find((s) => s.is_present && !s.counts_absent) ?? statuts[0],
    [statuts],
  );

  const manquants = lignes.filter((ligne) => !choix[ligne.enrollmentId]).length;

  if (lignes.length === 0) {
    return (
      <Alerte ton="alerte" titre="Aucun apprenant dans cette classe">
        Inscrivez des apprenants dans la classe avant de faire l&apos;appel.
      </Alerte>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="seanceId" value={seanceId} />

      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}

      {peutSaisir && !close ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-douce border border-bordure bg-carte px-4 py-3">
          <p className="text-sm text-encre-douce">
            {manquants === 0 ? (
              <span className="font-medium text-succes">Feuille complète</span>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-encre">{manquants}</span> apprenant
                {manquants > 1 ? 's' : ''} sans statut
              </>
            )}
          </p>
          {statutPresent ? (
            <Bouton
              type="button"
              variante="secondaire"
              taille="petite"
              onClick={() =>
                setChoix(
                  Object.fromEntries(lignes.map((l) => [l.enrollmentId, statutPresent.id])),
                )
              }
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Tout marquer « {statutPresent.name} »
            </Bouton>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-2">
        {lignes.map((ligne) => {
          const nom = nomAffiche(ligne.apprenant, format);
          const actuel = choix[ligne.enrollmentId] ?? '';

          return (
            <li
              key={ligne.enrollmentId}
              className="rounded-douce border border-bordure bg-carte p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-encre">{nom || 'Sans nom'}</p>
                {ligne.apprenant.learner_code ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
                    {ligne.apprenant.learner_code}
                  </span>
                ) : null}
                {ligne.corrections > 0 ? (
                  <span className="text-xs text-encre-douce">
                    {ligne.corrections} correction{ligne.corrections > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>

              <fieldset className="mt-2" disabled={close || !peutSaisir}>
                <legend className="sr-only">Statut de {nom}</legend>
                <div className="flex flex-wrap gap-2">
                  {statuts.map((statut) => {
                    const choisi = actuel === statut.id;
                    return (
                      <label
                        key={statut.id}
                        className={cn(
                          // Cible tactile confortable : 44px de haut minimum.
                          'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-douce border px-3 text-sm font-medium transition-colors sm:flex-none',
                          choisi
                            ? 'border-transparent text-white'
                            : 'border-bordure bg-surface-2 text-encre-douce hover:text-encre',
                          (close || !peutSaisir) && 'cursor-not-allowed opacity-70',
                        )}
                        style={choisi && statut.color ? { backgroundColor: statut.color } : undefined}
                      >
                        <input
                          type="radio"
                          name={`statut:${ligne.enrollmentId}`}
                          value={statut.id}
                          checked={choisi}
                          onChange={() =>
                            setChoix((precedent) => ({
                              ...precedent,
                              [ligne.enrollmentId]: statut.id,
                            }))
                          }
                          className="sr-only"
                        />
                        {statut.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {peutSaisir && !close ? (
        <div className="sticky bottom-4 flex justify-end">
          <BoutonEnvoi libelle="Enregistrer l'appel" enCours="Enregistrement…" />
        </div>
      ) : null}
    </form>
  );
}

export function ActionsSeance({
  seanceId,
  close,
  peutValider,
  peutCorriger,
}: {
  seanceId: string;
  close: boolean;
  peutValider: boolean;
  peutCorriger: boolean;
}) {
  const [etatValidation, actionValidation] = useActionState(validerSeanceAction, ETAT_INITIAL);
  const [etatReouverture, actionReouverture] = useActionState(rouvrirSeanceAction, ETAT_INITIAL);
  const [motifOuvert, setMotifOuvert] = useState(false);

  const erreur =
    etatValidation.statut === 'erreur'
      ? etatValidation.message
      : etatReouverture.statut === 'erreur'
        ? etatReouverture.message
        : null;

  return (
    <div className="space-y-2">
      {erreur ? <Alerte ton="danger">{erreur}</Alerte> : null}

      {!close && peutValider ? (
        <form action={actionValidation}>
          <input type="hidden" name="seanceId" value={seanceId} />
          <Bouton variante="secondaire" type="submit">
            <Lock className="size-4" aria-hidden="true" />
            Valider et clore la feuille
          </Bouton>
        </form>
      ) : null}

      {close && peutCorriger ? (
        motifOuvert ? (
          <form action={actionReouverture} className="space-y-2">
            <input type="hidden" name="seanceId" value={seanceId} />
            <Champ label="Motif de réouverture" htmlFor="raison-reouverture" obligatoire>
              <Saisie id="raison-reouverture" name="raison" required placeholder="Erreur de saisie constatée" />
            </Champ>
            <div className="flex gap-2">
              <Bouton variante="secondaire" type="submit">
                Rouvrir
              </Bouton>
              <Bouton variante="discret" type="button" onClick={() => setMotifOuvert(false)}>
                Annuler
              </Bouton>
            </div>
          </form>
        ) : (
          <Bouton variante="secondaire" onClick={() => setMotifOuvert(true)}>
            <Unlock className="size-4" aria-hidden="true" />
            Rouvrir la séance
          </Bouton>
        )
      ) : null}
    </div>
  );
}

/**
 * Correction d'une présence sur une feuille close.
 *
 * Passe par une permission distincte de celle de l'appel : celui qui a saisi ne
 * réécrit pas sa saisie sans trace. Le motif est obligatoire et conservé.
 */
export function CorrectionPresence({
  seanceId,
  lignes,
  statuts,
  format,
}: {
  seanceId: string;
  lignes: LigneAppel[];
  statuts: AttendanceStatus[];
  format: NameDisplayFormat;
}) {
  const [etat, action] = useActionState(corrigerPresenceAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);

  const corrigeables = lignes.filter((ligne) => ligne.recordId);
  if (corrigeables.length === 0) return null;

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.statut === 'succes' ? <Alerte ton="succes">{etat.message}</Alerte> : null}
        <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
          <PenLine className="size-4" aria-hidden="true" />
          Corriger une présence
        </Bouton>
      </div>
    );
  }

  return (
    <Carte>
      <EnTeteCarte>
        <TitreCarte>Corriger une présence</TitreCarte>
        <SousTitreCarte>
          La correction s&apos;ajoute à l&apos;historique sans le réécrire. Le motif est conservé.
        </SousTitreCarte>
      </EnTeteCarte>
      <CorpsCarte>
        <form action={action} className="space-y-4">
          <input type="hidden" name="seanceId" value={seanceId} />
          {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Apprenant" htmlFor="recordId" obligatoire>
              <Liste id="recordId" name="recordId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {corrigeables.map((ligne) => (
                  <option key={ligne.recordId} value={ligne.recordId ?? ''}>
                    {nomAffiche(ligne.apprenant, format)}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Nouveau statut" htmlFor="statutId" obligatoire>
              <Liste id="statutId" name="statutId" required defaultValue="">
                <option value="" disabled>
                  Sélectionnez
                </option>
                {statuts.map((statut) => (
                  <option key={statut.id} value={statut.id}>
                    {statut.name}
                  </option>
                ))}
              </Liste>
            </Champ>
          </div>

          <Champ
            label="Motif"
            htmlFor="raison"
            aide="Conservé dans l'historique des corrections et dans le journal d'audit."
            obligatoire
          >
            <Saisie id="raison" name="raison" required placeholder="Justificatif reçu le lendemain" />
          </Champ>

          <div className="flex gap-2">
            <BoutonEnvoi libelle="Enregistrer la correction" enCours="Enregistrement…" />
            <Bouton variante="secondaire" type="button" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
          </div>
        </form>
      </CorpsCarte>
    </Carte>
  );
}
